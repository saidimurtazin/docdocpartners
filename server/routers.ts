import { AGENT_COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, agentProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { SignJWT } from "jose";
import { notifyNewDeviceLogin } from "./telegram-notifications";
import { calculateWithdrawalTax } from "./payout-calculator";

/**
 * Определить эффективную ставку комиссии для агента за конкретный месяц.
 * Читает глобальные тиры из app_settings["agentCommissionTiers"].
 * Возвращает null если тиры не настроены (используется ставка клиники).
 */
async function getAgentEffectiveCommissionRate(agentId: number, treatmentMonth: string): Promise<number | null> {
  const globalJson = await db.getAppSetting("agentCommissionTiers");
  if (!globalJson) return null;

  let tiers: { minMonthlyRevenue: number; commissionRate: number }[] = [];
  try { tiers = JSON.parse(globalJson); } catch { return null; }
  if (tiers.length === 0) return null;

  // Revenue за конкретный месяц (по treatmentMonth)
  const monthlyRevenue = await db.getAgentMonthlyRevenueByTreatmentMonth(agentId, treatmentMonth);

  // Sort descending by threshold, pick the first matching tier
  const sorted = [...tiers].sort((a, b) => b.minMonthlyRevenue - a.minMonthlyRevenue);
  for (const tier of sorted) {
    if (monthlyRevenue >= tier.minMonthlyRevenue) {
      return tier.commissionRate;
    }
  }

  return tiers[0]?.commissionRate || null;
}

/**
 * Парсит дату визита в формат "YYYY-MM" для treatmentMonth.
 * Поддерживает: "DD.MM.YYYY", "YYYY-MM-DD", generic Date.
 */
function parseTreatmentMonth(visitDate: string): string | null {
  // DD.MM.YYYY (Русский формат, самый частый)
  const ruMatch = visitDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ruMatch) {
    return `${ruMatch[3]}-${ruMatch[2].padStart(2, '0')}`;
  }
  // YYYY-MM-DD (ISO)
  const isoMatch = visitDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}`;
  }
  // Fallback — generic Date parse
  const d = new Date(visitDate);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  return null;
}

/**
 * Пересчитать комиссию для ВСЕХ referrals агента за конкретный месяц.
 * Вызывается после утверждения нового отчёта, потому что суммарная выручка за месяц
 * могла изменить тир и комиссию для ВСЕХ referrals этого месяца.
 */
async function recalculateMonthlyCommissions(agentId: number, treatmentMonth: string): Promise<void> {
  const effectiveRate = await getAgentEffectiveCommissionRate(agentId, treatmentMonth);
  if (effectiveRate === null) return; // нет глобальных тиров — не пересчитываем

  const monthReferrals = await db.getReferralsByAgentAndMonth(agentId, treatmentMonth);
  if (monthReferrals.length === 0) return;

  for (const ref of monthReferrals) {
    const newCommission = Math.round((ref.treatmentAmount || 0) * effectiveRate / 100);
    const oldCommission = ref.commissionAmount || 0;

    if (newCommission !== oldCommission) {
      // updateReferralAmounts применяет дельту к agent.totalEarnings
      await db.updateReferralAmounts(ref.id, ref.treatmentAmount || 0, newCommission);
    }
  }
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "JWT_SECRET is not configured",
    });
  }
  return new TextEncoder().encode(secret);
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(async (opts) => {
      // Check session first (Email/OTP or Telegram login)
      if (opts.ctx.session) {
        const { session } = opts.ctx;

        // Handle admin session
        if (session.role === "admin" && session.userId) {
          const adminUser = await db.getUserById(session.userId);
          if (adminUser) {
            return {
              openId: adminUser.openId,
              appId: process.env.VITE_APP_ID || '',
              name: adminUser.name,
              email: adminUser.email,
              role: "admin",
              userId: adminUser.id,
            };
          }
        }

        // Handle agent session
        if (session.role === "agent" && session.agentId) {
          const agent = await db.getAgentById(session.agentId);
          if (agent) {
            return {
              openId: `agent_${agent.id}`,
              appId: process.env.VITE_APP_ID || '',
              name: agent.fullName,
              email: agent.email,
              role: agent.role,
              agentId: agent.id,
            };
          }
        }
      }

      // Fallback for backward compatibility
      if (opts.ctx.agentId) {
        const agent = await db.getAgentById(opts.ctx.agentId);
        if (agent) {
          return {
            openId: `agent_${agent.id}`,
            appId: process.env.VITE_APP_ID || '',
            name: agent.fullName,
            email: agent.email,
            role: agent.role,
            agentId: agent.id,
          };
        }
      }

      // Otherwise return OAuth admin user
      return opts.ctx.user;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(AGENT_COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),

    // Email + OTP Login
    requestOtp: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        // PRIORITY 1: Check if user is admin
        const adminUser = await db.getUserByEmail(input.email);

        if (adminUser && adminUser.role === "admin") {
          // Admin found - check if they have Telegram configured
          if (!adminUser.telegramId) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "Telegram не настроен для администратора. Обратитесь в поддержку.",
            });
          }

          // Generate OTP for admin
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
          // OTP code logged only in dev
          if (process.env.NODE_ENV !== "production") console.log('[RequestOTP] Admin code generated for', input.email);

          // Save OTP to database
          const dbInstance = await db.getDb();
          if (!dbInstance) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Database connection error",
            });
          }

          const { otpCodes: otpCodesTable } = await import("../drizzle/schema");
          await dbInstance.insert(otpCodesTable).values({
            email: input.email,
            code,
            expiresAt,
            used: "no",
          });

          // Send OTP to admin via Telegram (non-blocking — login proceeds even if Telegram fails)
          try {
            const { notifyAgent } = await import("./telegram-bot-webhook");
            await notifyAgent(
              adminUser.telegramId,
              `🔐 <b>Код для входа в админ-панель:</b>\n\n<code>${code}</code>\n\nКод действителен 5 минут.\n\n⚠️ Никому не сообщайте этот код!`
            );
          } catch (err) {
            console.error("[RequestOTP] Failed to send Telegram notification to admin:", err);
            // Don't throw — OTP saved to DB, admin can still check logs in dev
          }

          return { success: true };
        }

        // PRIORITY 2: Check agents (existing logic)
        const agent = await db.getAgentByEmail(input.email);

        if (!agent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Пользователь не найден. Зарегистрируйтесь в Telegram-боте.",
          });
        }

        if (agent.status !== "active") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Ваш аккаунт не активирован. Обратитесь в поддержку.",
          });
        }

        // Generate OTP code for agent
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        if (process.env.NODE_ENV !== "production") console.log('[RequestOTP] Agent code generated for', input.email);

        // Save OTP to database
        const dbInstance = await db.getDb();
        if (!dbInstance) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database connection error",
          });
        }

        const { otpCodes: otpCodesTable } = await import("../drizzle/schema");
        await dbInstance.insert(otpCodesTable).values({
          email: input.email,
          code,
          expiresAt,
          used: "no",
        });

        // Send OTP via Telegram bot to agent (non-blocking — login proceeds even if Telegram fails)
        try {
          const { notifyAgent } = await import("./telegram-bot-webhook");
          await notifyAgent(
            agent.telegramId,
            `🔐 <b>Код для входа в личный кабинет:</b>\n\n<code>${code}</code>\n\nКод действителен 5 минут.\n\n⚠️ Никому не сообщайте этот код!`
          );
        } catch (err) {
          console.error("[RequestOTP] Failed to send Telegram notification to agent:", err);
          // Don't throw — OTP saved to DB, user can retry
        }

        return { success: true };
      }),
    
    verifyOtp: publicProcedure
      .input(z.object({
        email: z.string().email(),
        code: z.string().regex(/^\d{6}$/, "OTP must be 6 digits")
      }))
      .mutation(async ({ input, ctx }) => {
        if (process.env.NODE_ENV !== "production") console.log("[VerifyOTP] Attempt for:", input.email);

        const dbInstance = await db.getDb();
        if (!dbInstance) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database connection error",
          });
        }

        const { otpCodes: otpCodesTable, users: usersTable } = await import("../drizzle/schema");
        const { and, eq, sql } = await import("drizzle-orm");

        // Find valid OTP
        const [otpRecord] = await dbInstance
          .select()
          .from(otpCodesTable)
          .where(
            and(
              eq(otpCodesTable.email, input.email),
              eq(otpCodesTable.code, input.code),
              eq(otpCodesTable.used, "no"),
              sql`${otpCodesTable.expiresAt} > NOW()`
            )
          )
          .limit(1);

        if (!otpRecord) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Неверный или истекший код",
          });
        }

        // Mark OTP as used
        await dbInstance
          .update(otpCodesTable)
          .set({ used: "yes" })
          .where(eq(otpCodesTable.id, otpRecord.id));

        // Check if user is admin first
        const [adminUser] = await dbInstance
          .select()
          .from(usersTable)
          .where(
            and(
              eq(usersTable.email, input.email),
              eq(usersTable.role, "admin")
            )
          )
          .limit(1);

        if (adminUser) {

          // Create admin session token
          const secret = getJwtSecret();
          const token = await new SignJWT({
            userId: adminUser.id,
            role: "admin",
            email: adminUser.email,
          })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("30d")
            .sign(secret);

          // Set session cookie
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(AGENT_COOKIE_NAME, token, {
            ...cookieOptions,
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          });


          return {
            success: true,
            role: "admin",
            user: {
              id: adminUser.id,
              name: adminUser.name,
              email: adminUser.email,
            }
          };
        }

        // Find agent
        const agent = await db.getAgentByEmail(input.email);
        if (!agent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Agent not found",
          });
        }

        // Create session token
        const secret = getJwtSecret();
        const token = await new SignJWT({
          userId: agent.id,
          agentId: agent.id,
          role: "agent",
          telegramId: agent.telegramId,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("30d")
          .sign(secret);

        // Set session cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(AGENT_COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });

        // Create session record in database
        const deviceInfo = ctx.req.headers["user-agent"] || null;
        const ipAddress = (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
                          (ctx.req.headers["x-real-ip"] as string) ||
                          ctx.req.socket.remoteAddress || null;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

        await db.createSession({
          agentId: agent.id,
          sessionToken: token,
          deviceInfo,
          ipAddress,
          loginMethod: "email_otp",
          lastActivityAt: new Date(),
          expiresAt,
          isRevoked: "no",
        });

        return {
          success: true,
          role: "agent",
          user: {
            id: agent.id,
            name: agent.fullName,
            email: agent.email,
          }
        };
      }),

  }),

  // AI Assistant for DocDocPartner agents
  ai: router({
    ask: publicProcedure
      .input(z.object({ question: z.string() }))
      .mutation(async ({ input }) => {
        const systemPrompt = `Ты — AI-ассистент программы DocDocPartner с доступом к поиску в интернете. Отвечай на русском языке.

**О программе:**
DocDocPartner — B2B-платформа агентских рекомендаций в здравоохранении. Врачи-агенты направляют пациентов в проверенные клиники и получают вознаграждение.

**Ключевые факты:**
- Вознаграждение: 10% от суммы лечения (агенту), 5% DocDocPartner
- Средний чек: 50 000 ₽
- Минимальная выплата: 1 000 ₽
- Выплаты: 3-5 рабочих дней на карту
- Роли агентов: Врач, Фитнес-тренер, Консультант, Координатор, Другое

**Клиники-партнеры:**
1. MEDSI (Москва) — многопрофильная, JCI-сертификация, с 1996 г. | Сайт: medsi.ru
2. MIBS (Санкт-Петербург) — онкология, радиохирургия, с 2003 г. | Сайт: mibs.ru
3. Olymp Clinic (Москва) — гинекология, стоматология, пластическая хирургия, с 2021 г. | Сайт: olympclinic.ru
4. Millenium clinic (Казань) — стоматология, неврология, эндокринология, с 2017 г. | Сайт: millenium-clinic.ru

**Процесс:**
1. Регистрация в Telegram-боте (5 минут)
2. Отправка данных пациента (ФИО + дата рождения)
3. Пациент получает лечение
4. Агент получает 10% вознаграждения

**Реферальная программа:** 2% от заработка приглашённых врачей пожизненно.

**Легальность:** Официальный договор оферты, прозрачная схема, соответствие законодательству РФ.

**ВАЖНО:** Если спрашивают о конкретных врачах, отделениях, услугах клиник — используй поиск в интернете для получения актуальной информации с официальных сайтов клиник.

Отвечай кратко, по делу, дружелюбно.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input.question }
          ]
        });

        const answer = response.choices[0]?.message?.content || "Извините, не смог обработать ваш вопрос.";
        return { answer };
      })
  }),

  // Admin panel router (admin only)
  admin: router({
    // Check if user is admin
    checkAdmin: protectedProcedure.query(({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      return { isAdmin: true };
    }),

    // AGENTS
    agents: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return db.getAllAgents();
      }),
      getById: protectedProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          return db.getAgentById(input.id);
        }),
      updateStatus: protectedProcedure
        .input(z.object({
          id: z.number(),
          status: z.enum(["pending", "active", "rejected", "blocked"])
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          await db.updateAgentStatus(input.id, input.status);
          return { success: true };
        }),
      updateExcludedClinics: protectedProcedure
        .input(z.object({
          agentId: z.number(),
          clinicIds: z.array(z.number()),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          await db.updateAgentExcludedClinics(input.agentId, input.clinicIds);
          return { success: true };
        }),
      removeExcludedClinic: protectedProcedure
        .input(z.object({
          agentId: z.number(),
          clinicId: z.number(),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          await db.removeAgentExcludedClinic(input.agentId, input.clinicId);
          return { success: true };
        }),

      // Jump.Finance: verify self-employment via force-identify
      verifyViaJump: protectedProcedure
        .input(z.object({ agentId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          const { jumpFinance, parseAgentName, getLegalFormId } = await import("./jump-finance");

          if (!jumpFinance.isConfigured) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Jump.Finance API не настроен" });
          }

          const agent = await db.getAgentById(input.agentId);
          if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Агент не найден" });
          if (!agent.inn) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "У агента не указан ИНН" });
          if (!agent.phone) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "У агента не указан телефон" });

          // Create contractor in Jump if not exists
          if (!agent.jumpContractorId) {
            const { firstName, lastName, middleName } = parseAgentName(agent.fullName);
            const result = await jumpFinance.createContractor({
              phone: agent.phone,
              firstName,
              lastName,
              middleName,
              legalFormId: getLegalFormId(agent.isSelfEmployed),
              tin: agent.inn,
            });
            await db.updateAgentJumpData(agent.id, { jumpContractorId: result.item.id });
            agent.jumpContractorId = result.item.id;
          }

          // Force-identify to check self-employment
          await jumpFinance.forceIdentify(agent.jumpContractorId);
          await db.updateAgentJumpData(agent.id, { jumpIdentified: false });

          return { success: true, message: "Проверка запущена. Результат появится в течение нескольких минут." };
        }),

      // Jump.Finance: toggle self-employment manually
      updateSelfEmployment: protectedProcedure
        .input(z.object({
          agentId: z.number(),
          isSelfEmployed: z.enum(["yes", "no", "unknown"]),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          await db.updateAgentRequisites(input.agentId, { isSelfEmployed: input.isSelfEmployed });
          return { success: true };
        }),

      // Hard-delete agent and all related records
      hardDelete: protectedProcedure
        .input(z.object({ agentId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          const result = await db.hardDeleteAgent(input.agentId);
          if (!result.deleted) {
            throw new TRPCError({ code: "NOT_FOUND", message: result.reason });
          }
          return result;
        }),

      // Commission tiers removed from per-agent — now in global settings only
    }),

    // REFERRALS
    referrals: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return db.getAllReferrals();
      }),
      getById: protectedProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          return db.getReferralById(input.id);
        }),
      updateStatus: protectedProcedure
        .input(z.object({
          id: z.number(),
          status: z.enum(["new", "in_progress", "contacted", "scheduled", "visited", "paid", "duplicate", "no_answer", "cancelled"])
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

          // Get referral before update for notification
          const referral = await db.getReferralById(input.id);
          if (!referral) throw new TRPCError({ code: "NOT_FOUND", message: "Рекомендация не найдена" });
          const oldStatus = referral.status;

          await db.updateReferralStatus(input.id, input.status);

          // Send Telegram notification to agent about status change
          if (oldStatus !== input.status) {
            try {
              const agent = await db.getAgentById(referral.agentId);
              if (agent?.telegramId) {
                const { notifyReferralStatusChange } = await import("./telegram-notifications");
                await notifyReferralStatusChange(agent.telegramId, {
                  id: referral.id,
                  patientFullName: referral.patientFullName,
                  oldStatus,
                  newStatus: input.status,
                  clinic: referral.clinic,
                  treatmentAmount: referral.treatmentAmount ?? undefined,
                  commissionAmount: referral.commissionAmount ?? undefined,
                });
              }
            } catch (err) {
              console.error("[Admin] Failed to send referral status notification:", err);
            }
          }

          return { success: true };
        }),
      updateAmounts: protectedProcedure
        .input(z.object({ 
          id: z.number(),
          treatmentAmount: z.number().min(0),
          commissionAmount: z.number().min(0)
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          await db.updateReferralAmounts(input.id, input.treatmentAmount, input.commissionAmount);
          return { success: true };
        }),
    }),

    // PAYMENTS
    payments: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return db.getAllPayments();
      }),
      updateStatus: protectedProcedure
        .input(z.object({
          id: z.number(),
          status: z.enum(["pending", "act_generated", "sent_for_signing", "signed", "ready_for_payment", "processing", "completed", "failed"]),
          transactionId: z.string().optional()
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          await db.updatePaymentStatus(input.id, input.status, input.transactionId);

          // Send Telegram notification to agent about payment status change
          try {
            const payment = await db.getPaymentById(input.id);
            if (payment) {
              const agent = await db.getAgentById(payment.agentId);
              if (agent?.telegramId) {
                const { notifyPaymentProcessed } = await import("./telegram-notifications");
                await notifyPaymentProcessed(agent.telegramId, {
                  id: payment.id,
                  amount: payment.amount,
                  status: input.status,
                  method: payment.method,
                  transactionId: input.transactionId || payment.transactionId,
                });
              }
            }
          } catch (err) {
            console.error("[Admin] Failed to send payment status notification:", err);
          }

          return { success: true };
        }),
      generateAct: protectedProcedure
        .input(z.object({ paymentId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          const { generateAct } = await import("./payment-act-service");
          return generateAct(input.paymentId);
        }),
      sendForSigning: protectedProcedure
        .input(z.object({ actId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          const { sendActSigningOtp } = await import("./payment-act-service");
          return sendActSigningOtp(input.actId);
        }),
      regenerateAct: protectedProcedure
        .input(z.object({ paymentId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          const { regenerateAct } = await import("./payment-act-service");
          return regenerateAct(input.paymentId);
        }),
      getAct: protectedProcedure
        .input(z.object({ paymentId: z.number() }))
        .query(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          return db.getPaymentActByPaymentId(input.paymentId);
        }),
      batchMarkCompleted: protectedProcedure
        .input(z.object({ paymentIds: z.array(z.number()) }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          for (const id of input.paymentIds) {
            await db.updatePaymentStatus(id, "completed");
          }
          return { success: true, count: input.paymentIds.length };
        }),

      // Jump.Finance: pay out via Jump (manual admin button)
      payViaJump: protectedProcedure
        .input(z.object({ paymentId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          const { processJumpPayment } = await import("./jump-payout");

          const result = await processJumpPayment(input.paymentId);
          if (!result.success) {
            throw new TRPCError({ code: "BAD_REQUEST", message: result.error || "Jump payment failed" });
          }

          return { success: true, jumpPaymentId: result.jumpPaymentId };
        }),

      // Jump.Finance: retry failed payment
      retryJumpPayment: protectedProcedure
        .input(z.object({ paymentId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          const { jumpFinance, JUMP_STATUS } = await import("./jump-finance");

          const payment = await db.getPaymentById(input.paymentId);
          if (!payment?.jumpPaymentId) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Jump-платёж не найден" });
          }
          if (payment.jumpStatus !== JUMP_STATUS.ERROR) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Повторить можно только платежи со статусом Error" });
          }

          const result = await jumpFinance.repeatPayment(payment.jumpPaymentId);
          await db.updatePaymentJumpData(payment.id, {
            jumpStatus: result.item.status.id,
            jumpStatusText: result.item.status.title,
            status: "processing",
          });

          return { success: true };
        }),
    }),

    // DOCTORS
    doctors: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return db.getAllDoctors();
      }),
      getById: protectedProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          return db.getDoctorById(input.id);
        }),
      create: protectedProcedure
        .input(z.object({
          fullName: z.string(),
          specialization: z.string(),
          clinic: z.string(),
          clinicLocation: z.string().optional(),
          experience: z.number().optional(),
          education: z.string().optional(),
          achievements: z.string().optional(),
          services: z.string().optional(),
          phone: z.string().optional(),
          email: z.string().optional(),
          bio: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          const id = await db.createDoctor(input);
          return { id, success: true };
        }),
      update: protectedProcedure
        .input(z.object({
          id: z.number(),
          fullName: z.string().optional(),
          specialization: z.string().optional(),
          clinic: z.string().optional(),
          clinicLocation: z.string().optional(),
          experience: z.number().optional(),
          education: z.string().optional(),
          achievements: z.string().optional(),
          services: z.string().optional(),
          phone: z.string().optional(),
          email: z.string().optional(),
          bio: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          const { id, ...data } = input;
          await db.updateDoctor(id, data);
          return { success: true };
        }),
      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          await db.deleteDoctor(input.id);
          return { success: true };
        }),
      search: protectedProcedure
        .input(z.object({
          clinic: z.string().optional(),
          specialization: z.string().optional(),
          name: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          return db.searchDoctors(input);
        }),
    }),

    // CLINICS
    clinics: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return db.getAllClinicsAdmin();
      }),
      getById: protectedProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          return db.getClinicById(input.id);
        }),
      create: protectedProcedure
        .input(z.object({
          name: z.string().min(2),
          type: z.string().optional(),
          ownership: z.string().optional(),
          city: z.string().optional(),
          address: z.string().optional(),
          phone: z.string().optional(),
          email: z.string().optional(),
          website: z.string().optional(),
          specializations: z.string().optional(),
          certifications: z.string().optional(),
          description: z.string().optional(),
          commissionRate: z.number().optional(),
          averageCheck: z.number().optional(),
          foundedYear: z.number().optional(),
          languages: z.string().optional(),
          imageUrl: z.string().optional(),
          reportEmails: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          const id = await db.createClinic(input);
          return { id, success: true };
        }),
      update: protectedProcedure
        .input(z.object({
          id: z.number(),
          name: z.string().min(2).optional(),
          type: z.string().optional(),
          ownership: z.string().optional(),
          city: z.string().optional(),
          address: z.string().optional(),
          phone: z.string().optional(),
          email: z.string().optional(),
          website: z.string().optional(),
          specializations: z.string().optional(),
          certifications: z.string().optional(),
          description: z.string().optional(),
          commissionRate: z.number().optional(),
          averageCheck: z.number().optional(),
          foundedYear: z.number().optional(),
          languages: z.string().optional(),
          imageUrl: z.string().optional(),
          reportEmails: z.string().optional(),
          isActive: z.enum(["yes", "no"]).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          const { id, ...data } = input;
          await db.updateClinic(id, data);
          return { success: true };
        }),
      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          await db.deleteClinic(input.id);
          return { success: true };
        }),
    }),

    // STATISTICS
    statistics: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return db.getStatistics();
    }),

    // APP SETTINGS (global commission tiers, etc.)
    settings: router({
      get: protectedProcedure
        .input(z.object({ key: z.string() }))
        .query(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          return db.getAppSetting(input.key);
        }),
      set: protectedProcedure
        .input(z.object({ key: z.string(), value: z.string() }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          await db.setAppSetting(input.key, input.value);
          return { success: true };
        }),

      // Commission tiers management
      getCommissionTiers: protectedProcedure
        .query(async ({ ctx }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          const raw = await db.getAppSetting("agentCommissionTiers");
          if (!raw) return [];
          try { return JSON.parse(raw) as { minMonthlyRevenue: number; commissionRate: number }[]; }
          catch { return []; }
        }),

      setCommissionTiers: protectedProcedure
        .input(z.object({
          tiers: z.array(z.object({
            minMonthlyRevenue: z.number().min(0),
            commissionRate: z.number().min(0).max(100),
          })),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          // Сортировать по порогу и проверить на дубликаты
          const sorted = [...input.tiers].sort((a, b) => a.minMonthlyRevenue - b.minMonthlyRevenue);
          const thresholds = sorted.map(t => t.minMonthlyRevenue);
          if (new Set(thresholds).size !== thresholds.length) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Дублирующиеся пороги недопустимы" });
          }
          await db.setAppSetting("agentCommissionTiers", JSON.stringify(sorted));
          return { success: true };
        }),
    }),

    // EXPORT
    export: router({
      referrals: protectedProcedure
        .input(z.object({
          agentId: z.number().optional(),
          status: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          const { exportReferralsToExcel } = await import("./export");
          const buffer = await exportReferralsToExcel(input);
          return { data: buffer.toString('base64') };
        }),
      payments: protectedProcedure
        .input(z.object({
          agentId: z.number().optional(),
          status: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          const { exportPaymentsToExcel } = await import("./export");
          const buffer = await exportPaymentsToExcel(input);
          return { data: buffer.toString('base64') };
        }),
      agents: protectedProcedure
        .input(z.object({
          status: z.string().optional(),
          city: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          const { exportAgentsToExcel } = await import("./export");
          const buffer = await exportAgentsToExcel(input);
          return { data: buffer.toString('base64') };
        }),
      paymentRegistry: protectedProcedure
        .input(z.object({
          periodStart: z.string(),
          periodEnd: z.string(),
          status: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          const { exportPaymentRegistryToExcel } = await import("./export");
          const buffer = await exportPaymentRegistryToExcel(input);
          return { data: buffer.toString('base64') };
        }),
      signedActsRegistry: protectedProcedure
        .input(z.object({
          periodStart: z.string(),
          periodEnd: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          const { exportSignedActsRegistryToExcel } = await import("./export");
          const buffer = await exportSignedActsRegistryToExcel(input);
          return { data: buffer.toString('base64') };
        }),
    }),

    // CLINIC REPORTS
    clinicReports: router({
      list: protectedProcedure
        .input(z.object({
          status: z.string().optional(),
          search: z.string().optional(),
          page: z.number().default(1),
          pageSize: z.number().default(20),
        }).optional())
        .query(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          return db.getAllClinicReports(input || undefined);
        }),

      getById: protectedProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          return db.getClinicReportById(input.id);
        }),

      stats: protectedProcedure.query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return db.getClinicReportsStats();
      }),

      approve: protectedProcedure
        .input(z.object({
          id: z.number(),
          referralId: z.number().optional(),
          treatmentAmount: z.number().optional(), // kopecks
          notes: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

          const report = await db.getClinicReportById(input.id);
          if (!report) throw new TRPCError({ code: "NOT_FOUND" });

          // Update report status
          await db.updateClinicReportStatus(input.id, "approved", ctx.user.id, input.notes);

          // Link to referral if provided
          const refId = input.referralId || report.referralId;
          if (refId) {
            await db.linkClinicReportToReferral(input.id, refId);

            const amount = input.treatmentAmount || report.treatmentAmount || 0;
            if (amount > 0) {
              const referral = await db.getReferralById(refId);
              if (!referral) throw new TRPCError({ code: "NOT_FOUND", message: "Referral not found" });

              // Определить treatmentMonth из visitDate отчёта
              let treatmentMonth: string | null = null;
              if (report.visitDate) {
                treatmentMonth = parseTreatmentMonth(report.visitDate);
              }
              if (!treatmentMonth) {
                // Fallback: текущий месяц
                const now = new Date();
                treatmentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              }

              // Установить treatmentMonth на referral
              await db.setReferralTreatmentMonth(refId, treatmentMonth);

              // 1. Базовая ставка клиники (default 10%)
              let commissionRate = 10;
              if (referral.clinic) {
                const clinic = await db.getClinicByName(referral.clinic);
                if (clinic?.commissionRate) commissionRate = clinic.commissionRate;
              }

              // 2. Проверить глобальные тиры
              const tierRate = await getAgentEffectiveCommissionRate(referral.agentId, treatmentMonth);
              if (tierRate !== null) commissionRate = tierRate;

              // 3. Обновить суммы этого referral
              const commission = Math.round(amount * commissionRate / 100);
              await db.updateReferralAmounts(refId, amount, commission);
              await db.updateReferralStatus(refId, "visited");

              // 4. Пересчитать ВСЕ referrals этого месяца (новая выручка может изменить тир)
              await recalculateMonthlyCommissions(referral.agentId, treatmentMonth);
            }
          }

          return { success: true };
        }),

      reject: protectedProcedure
        .input(z.object({
          id: z.number(),
          notes: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          await db.updateClinicReportStatus(input.id, "rejected", ctx.user.id, input.notes);
          return { success: true };
        }),

      update: protectedProcedure
        .input(z.object({
          id: z.number(),
          patientName: z.string().optional(),
          visitDate: z.string().optional(),
          treatmentAmount: z.number().optional(),
          services: z.string().optional(),
          clinicName: z.string().optional(),
          referralId: z.number().nullable().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          const { id, ...data } = input;
          await db.updateClinicReport(id, data);
          return { success: true };
        }),

      linkToReferral: protectedProcedure
        .input(z.object({
          id: z.number(),
          referralId: z.number(),
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          await db.linkClinicReportToReferral(input.id, input.referralId);
          return { success: true };
        }),

      triggerPoll: protectedProcedure.mutation(async ({ ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { processNewClinicEmails } = await import("./clinic-report-processor");
        return processNewClinicEmails();
      }),

      searchReferrals: protectedProcedure
        .input(z.object({
          search: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          const allRefs = await db.getAllReferrals();
          if (!input?.search) return allRefs.slice(0, 20);
          const term = input.search.toLowerCase();
          return allRefs
            .filter(r => r.patientFullName.toLowerCase().includes(term) || (r.clinic && r.clinic.toLowerCase().includes(term)))
            .slice(0, 20);
        }),
    }),
  }),

  // Public endpoints
  public: router({
    clinics: publicProcedure.query(async () => {
      return db.getAllClinics();
    }),
    stats: publicProcedure.query(async () => {
      return db.getPublicStats();
    }),
  }),

  // BOT API - Public endpoints for Telegram bot integration
  bot: router({
    // Register new agent
    registerAgent: publicProcedure
      .input(z.object({
        telegramId: z.string(),
        fullName: z.string(),
        email: z.string().email(),
        phone: z.string(),
        role: z.string(),
        city: z.string(),
        specialization: z.string().optional(),
        referredBy: z.string().optional(),
        excludedClinics: z.string().optional(), // JSON array of clinic IDs
      }))
      .mutation(async ({ input }) => {
        // Generate referralCode if not present
        const crypto = await import("crypto");
        const referralCode = crypto.randomBytes(6).toString("hex");
        const agent = await db.createAgent({ ...input, referralCode });
        return { success: true, agent };
      }),

    // Create referral and send email notification
    createReferral: publicProcedure
      .input(z.object({
        telegramId: z.string(),
        patientFullName: z.string(),
        patientBirthdate: z.string(),
        patientCity: z.string().optional(),
        patientPhone: z.string().optional(),
        patientEmail: z.string().optional(),
        clinic: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Find agent by telegram ID
        const agent = await db.getAgentByTelegramId(input.telegramId);
        if (!agent) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
        }

        // Create referral
        const referralId = await db.createReferral({
          agentId: agent.id,
          patientFullName: input.patientFullName,
          patientBirthdate: input.patientBirthdate,
          patientCity: input.patientCity,
          patientPhone: input.patientPhone,
          patientEmail: input.patientEmail,
          clinic: input.clinic,
        });

        // Send email notification to clinic
        const { sendReferralNotification } = await import("./email");
        await sendReferralNotification({
          to: "said.murtazin@mail.ru",
          referralId,
          agentName: agent.fullName,
          patientName: input.patientFullName,
          patientBirthdate: input.patientBirthdate,
          patientCity: input.patientCity,
          patientPhone: input.patientPhone,
          patientEmail: input.patientEmail,
          clinic: input.clinic,
        });

        return { success: true, referralId };
      }),

    // Get agent by telegram ID
    getAgent: publicProcedure
      .input(z.object({ telegramId: z.string() }))
      .query(async ({ input }) => {
        const agent = await db.getAgentByTelegramId(input.telegramId);
        return { agent };
      }),

    // Update agent requisites (INN, bank details, card, SBP)
    updateRequisites: publicProcedure
      .input(z.object({
        telegramId: z.string(),
        inn: z.string(),
        isSelfEmployed: z.enum(["yes", "no", "unknown"]),
        payoutMethod: z.enum(["card", "sbp", "bank_account"]).optional(),
        cardNumber: z.string().optional(),
        bankName: z.string().optional(),
        bankAccount: z.string().optional(),
        bankBik: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const agent = await db.getAgentByTelegramId(input.telegramId);
        if (!agent) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
        }

        await db.updateAgentRequisites(agent.id, {
          inn: input.inn,
          isSelfEmployed: input.isSelfEmployed,
          ...(input.payoutMethod && { payoutMethod: input.payoutMethod }),
          ...(input.cardNumber && { cardNumber: input.cardNumber }),
          ...(input.bankName && { bankName: input.bankName }),
          ...(input.bankAccount && { bankAccount: input.bankAccount }),
          ...(input.bankBik && { bankBik: input.bankBik }),
        });

        return { success: true };
      }),

    // Get agent referrals
    getAgentReferrals: publicProcedure
      .input(z.object({ telegramId: z.string() }))
      .query(async ({ input }) => {
        const agent = await db.getAgentByTelegramId(input.telegramId);
        if (!agent) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
        }

        const referrals = await db.getReferralsByAgentId(agent.id);
        return { referrals };
      }),

    // Get agent payments
    getAgentPayments: publicProcedure
      .input(z.object({ telegramId: z.string() }))
      .query(async ({ input }) => {
        const agent = await db.getAgentByTelegramId(input.telegramId);
        if (!agent) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
        }

        const payments = await db.getPaymentsByAgentId(agent.id);
        return { payments };
      }),

    // Request payout
    requestPayout: publicProcedure
      .input(z.object({
        telegramId: z.string(),
        amount: z.number(),
      }))
      .mutation(async ({ input }) => {
        const agent = await db.getAgentByTelegramId(input.telegramId);
        if (!agent) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
        }

        // Check if agent has complete requisites
        if (!agent.inn || !agent.bankAccount || !agent.bankName || !agent.bankBik) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Заполните все реквизиты (ИНН, банк, счёт, БИК) перед запросом выплаты"
          });
        }

        // Check minimum amount
        if (input.amount < 100000) { // 1000 RUB in kopecks
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "Minimum payout amount is 1000 RUB" 
          });
        }

        const paymentId = await db.createPayment({
          agentId: agent.id,
          amount: input.amount,
          status: "pending",
        });

        return { success: true, paymentId };
      }),

    // Get agent statistics
    getAgentStatistics: publicProcedure
      .input(z.object({ telegramId: z.string() }))
      .query(async ({ input }) => {
        const agent = await db.getAgentByTelegramId(input.telegramId);
        if (!agent) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
        }

        const stats = await db.getAgentStatistics(agent.id);
        return { statistics: stats };
      }),
  }),

  // Agent-specific endpoints (requires agent authentication)
  agent: router({
    getSessions: agentProcedure.query(async ({ ctx }) => {
      return db.getSessionsByAgentId(ctx.agentId);
    }),

    revokeSession: agentProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const sessions = await db.getSessionsByAgentId(ctx.agentId);
        const ownSession = sessions.find(s => s.id === input.sessionId);
        if (!ownSession) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Сессия не принадлежит вам" });
        }
        await db.revokeSession(input.sessionId);
        return { success: true };
      }),

    revokeAllOtherSessions: agentProcedure.mutation(async ({ ctx }) => {
      const sessionToken = ctx.req.cookies[AGENT_COOKIE_NAME];
      if (!sessionToken) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Нет активной сессии" });
      }
      await db.revokeAllSessionsExceptCurrent(ctx.agentId, sessionToken);
      return { success: true };
    }),
  }),

  // Agent Dashboard Router (for logged-in agents)
  dashboard: router({
    stats: agentProcedure.query(async ({ ctx }) => {
      const agent = await db.getAgentById(ctx.agentId);
      if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Агент не найден" });

      const referrals = await db.getReferralsByAgentId(ctx.agentId);
      const activeReferrals = referrals.filter(r => ["new", "in_progress", "contacted", "scheduled"].includes(r.status));
      const completedReferrals = referrals.filter(r => r.status === "paid" || r.status === "visited");

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthEarnings = referrals
        .filter(r => new Date(r.createdAt) >= firstDayOfMonth && (r.status === "paid" || r.status === "visited"))
        .reduce((sum, r) => sum + (r.commissionAmount || 0), 0);

      const conversionRate = referrals.length > 0
        ? Math.round((completedReferrals.length / referrals.length) * 100)
        : 0;

      // Bonus info
      const paidReferralCount = referrals.filter(r => r.status === "paid").length;
      const pendingPaymentsSum = await db.getAgentPendingPaymentsSum(ctx.agentId);
      const completedPaymentsSum = await db.getAgentCompletedPaymentsSum(ctx.agentId);

      // Referral program: count agents invited by this agent
      const { agents: agentsTable } = await import("../drizzle/schema");
      const { eq: eqOp } = await import("drizzle-orm");
      const database = await db.getDb();
      let referredAgentsCount = 0;
      if (database) {
        const referred = await database.select({ id: agentsTable.id }).from(agentsTable).where(eqOp(agentsTable.referredBy, ctx.agentId));
        referredAgentsCount = referred.length;
      }

      return {
        totalEarnings: agent.totalEarnings || 0,
        availableBalance: Math.max(0, (agent.totalEarnings || 0) - completedPaymentsSum - pendingPaymentsSum),
        completedPaymentsSum,
        activeReferrals: activeReferrals.length,
        conversionRate,
        thisMonthEarnings,
        totalReferrals: referrals.length,
        completedReferrals: completedReferrals.length,
        bonusPoints: agent.bonusPoints || 0,
        paidReferralCount,
        bonusUnlockThreshold: 10,
        referredAgentsCount,
        referralLink: `https://t.me/docpartnerbot?start=ref_${ctx.agentId}`,
        isSelfEmployed: agent.isSelfEmployed || "unknown",
      };
    }),

    monthlyEarnings: agentProcedure.query(async ({ ctx }) => {
      const referrals = await db.getReferralsByAgentId(ctx.agentId);
      const now = new Date();
      const months = [];

      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = date.toLocaleDateString('ru-RU', { month: 'short' });
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);

        const earnings = referrals
          .filter(r => {
            if (!(r.status === "paid" || r.status === "visited")) return false;
            // Prefer treatmentMonth, fallback to createdAt for old data
            if ((r as any).treatmentMonth) {
              return (r as any).treatmentMonth === monthKey;
            }
            const createdAt = new Date(r.createdAt);
            return createdAt >= date && createdAt < nextMonth;
          })
          .reduce((sum, r) => sum + (r.commissionAmount || 0), 0);

        months.push({ month: monthName, earnings: earnings / 100 });
      }
      return months;
    }),

    referralsByStatus: agentProcedure.query(async ({ ctx }) => {
      const referrals = await db.getReferralsByAgentId(ctx.agentId);
      const statusCounts: Record<string, number> = { new: 0, in_progress: 0, contacted: 0, scheduled: 0, visited: 0, paid: 0, duplicate: 0, no_answer: 0, cancelled: 0 };
      referrals.forEach(r => {
        if (r.status in statusCounts) statusCounts[r.status]++;
      });
      return [
        { status: 'Новая', count: statusCounts.new },
        { status: 'В работе', count: statusCounts.in_progress },
        { status: 'Связались', count: statusCounts.contacted },
        { status: 'Записан', count: statusCounts.scheduled },
        { status: 'Приём состоялся', count: statusCounts.visited },
        { status: 'Оплачено', count: statusCounts.paid },
        { status: 'Дубликат', count: statusCounts.duplicate },
        { status: 'Не дозвонились', count: statusCounts.no_answer },
        { status: 'Отменена', count: statusCounts.cancelled },
      ];
    }),

    referrals: agentProcedure.query(async ({ ctx }) => {
      return db.getReferralsByAgentId(ctx.agentId);
    }),

    createReferral: agentProcedure
      .input(z.object({
        patientFullName: z.string().min(3, "ФИО должно содержать минимум 3 символа"),
        patientBirthdate: z.string().regex(/^\d{2}\.\d{2}\.\d{4}$/, "Формат даты: ДД.ММ.ГГГГ"),
        patientCity: z.string().optional(),
        patientPhone: z.string().optional(),
        patientEmail: z.string().email("Некорректный email").optional().or(z.literal("")),
        clinic: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const agent = await db.getAgentById(ctx.agentId);
        if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Агент не найден" });
        if (agent.status !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "Аккаунт не активен" });

        // Validate name has at least 2 words
        const nameWords = input.patientFullName.trim().split(/\s+/);
        if (nameWords.length < 2) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Укажите фамилию и имя (минимум 2 слова)" });
        }

        const referralId = await db.createReferral({
          agentId: ctx.agentId,
          patientFullName: input.patientFullName.trim(),
          patientBirthdate: input.patientBirthdate,
          patientCity: input.patientCity || undefined,
          patientPhone: input.patientPhone || undefined,
          patientEmail: input.patientEmail || undefined,
          clinic: input.clinic || undefined,
        });

        // Send email notification
        try {
          const { sendReferralNotification } = await import("./email");
          await sendReferralNotification({
            to: "said.murtazin@mail.ru",
            referralId,
            agentName: agent.fullName,
            patientName: input.patientFullName,
            patientBirthdate: input.patientBirthdate,
            patientCity: input.patientCity,
            patientPhone: input.patientPhone,
            patientEmail: input.patientEmail,
            clinic: input.clinic,
          });
        } catch (emailError) {
          console.error("[Dashboard] Email notification failed:", emailError);
        }

        return { success: true, referralId };
      }),

    profile: agentProcedure.query(async ({ ctx }) => {
      const agent = await db.getAgentById(ctx.agentId);
      if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Агент не найден" });
      return agent;
    }),

    updateProfile: agentProcedure
      .input(z.object({
        inn: z.string().regex(/^\d{12}$/, "ИНН должен содержать 12 цифр").optional(),
        isSelfEmployed: z.enum(["yes", "no", "unknown"]).optional(),
        payoutMethod: z.enum(["card", "sbp", "bank_account"]).optional(),
        cardNumber: z.string().optional(),
        bankAccount: z.string().regex(/^\d{20}$/, "Расчётный счёт должен содержать 20 цифр").optional(),
        bankName: z.string().min(2, "Укажите название банка").max(255).optional(),
        bankBik: z.string().regex(/^\d{9}$/, "БИК должен содержать 9 цифр").optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Validate card number if provided (MIR only + Luhn)
        if (input.cardNumber) {
          const { validateCardNumberDetailed } = await import("./jump-finance");
          const cardCheck = validateCardNumberDetailed(input.cardNumber);
          if (!cardCheck.valid) {
            throw new TRPCError({ code: "BAD_REQUEST", message: cardCheck.error || "Некорректный номер карты" });
          }
        }
        await db.updateAgentRequisites(ctx.agentId, input);
        return { success: true };
      }),

    payments: agentProcedure.query(async ({ ctx }) => {
      return db.getPaymentsByAgentId(ctx.agentId);
    }),

    updatePersonalInfo: agentProcedure
      .input(z.object({
        fullName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        city: z.string().optional(),
        specialization: z.string().optional(),
        role: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateAgentPersonalInfo(ctx.agentId, input);
        return { success: true };
      }),

    clinics: agentProcedure.query(async () => {
      return db.getAllClinics();
    }),

    requestPayment: agentProcedure
      .input(z.object({
        amount: z.number().min(100000, "Минимальная сумма — 1 000 ₽"),
        isSelfEmployed: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check for pending payment requests (deduplication)
        const existingPayments = await db.getPaymentsByAgentId(ctx.agentId);
        const hasPendingPayment = existingPayments.some(p => p.status === "pending" || p.status === "processing");
        if (hasPendingPayment) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "У вас уже есть необработанная заявка на выплату. Дождитесь её обработки.",
          });
        }

        // Check agent has filled requisites
        const agent = await db.getAgentById(ctx.agentId);
        if (!agent?.inn) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Заполните ИНН в профиле перед запросом выплаты.",
          });
        }

        const pm = agent.payoutMethod || "card";
        if (pm === "card" && !agent.cardNumber) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Укажите номер карты в профиле перед запросом выплаты.",
          });
        }
        if (pm === "sbp" && !agent.phone) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Укажите номер телефона для выплаты по СБП.",
          });
        }
        if (pm === "bank_account" && (!agent.bankAccount || !agent.bankName || !agent.bankBik)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Заполните все банковские реквизиты (счёт, банк, БИК) в профиле.",
          });
        }

        // If agent's isSelfEmployed is "unknown", update it now
        if (agent.isSelfEmployed === "unknown") {
          await db.updateAgentRequisites(ctx.agentId, {
            isSelfEmployed: input.isSelfEmployed ? "yes" : "no",
          });
        }

        // Calculate tax breakdown
        const breakdown = calculateWithdrawalTax(input.amount, input.isSelfEmployed);

        // Validate amount against available balance (earnings minus already paid and pending)
        // Balance check uses GROSS amount (what's deducted from totalEarnings)
        const pendingSum = await db.getAgentPendingPaymentsSum(ctx.agentId);
        const completedSum = await db.getAgentCompletedPaymentsSum(ctx.agentId);
        const availableBalance = (agent.totalEarnings || 0) - completedSum - pendingSum;
        if (input.amount > availableBalance) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Недостаточно средств. Доступно: ${(availableBalance / 100).toLocaleString("ru-RU")} ₽`,
          });
        }

        const paymentId = await db.createPaymentRequest(ctx.agentId, {
          amount: breakdown.grossAmount,
          grossAmount: breakdown.grossAmount,
          netAmount: breakdown.netAmount,
          taxAmount: breakdown.taxAmount,
          socialContributions: breakdown.socialContributions,
          isSelfEmployedSnapshot: input.isSelfEmployed ? "yes" : "no",
        });

        // Auto-submit to Jump Finance if configured
        let jumpResult: { success: boolean; jumpPaymentId?: string; error?: string } | null = null;
        try {
          const { processJumpPayment } = await import("./jump-payout");
          jumpResult = await processJumpPayment(paymentId);
          if (!jumpResult.success) {
            console.warn(`[requestPayment] Jump auto-submit failed for payment ${paymentId}: ${jumpResult.error}`);
          }
        } catch (err) {
          console.error(`[requestPayment] Jump auto-submit error for payment ${paymentId}:`, err);
        }

        return { success: true, jumpSubmitted: jumpResult?.success ?? false };
      }),

    // Payment act signing
    getPaymentAct: agentProcedure
      .input(z.object({ paymentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const payment = await db.getPaymentById(input.paymentId);
        if (!payment || payment.agentId !== ctx.agentId) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        const { getActWithDownloadUrl } = await import("./payment-act-service");
        const act = await db.getPaymentActByPaymentId(input.paymentId);
        if (!act) return null;
        return getActWithDownloadUrl(act.id);
      }),

    signAct: agentProcedure
      .input(z.object({
        actId: z.number(),
        code: z.string().regex(/^\d{6}$/, "Код должен содержать 6 цифр"),
      }))
      .mutation(async ({ ctx, input }) => {
        const act = await db.getPaymentActById(input.actId);
        if (!act || act.agentId !== ctx.agentId) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        const { verifyActOtp } = await import("./payment-act-service");
        const ip = (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
                   ctx.req.socket?.remoteAddress || "";
        const ua = ctx.req.headers["user-agent"] || "";
        const success = await verifyActOtp(input.actId, input.code, ip, ua);
        if (!success) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Неверный или истекший код" });
        }
        return { success: true };
      }),

    resendActOtp: agentProcedure
      .input(z.object({ actId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const act = await db.getPaymentActById(input.actId);
        if (!act || act.agentId !== ctx.agentId) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        const { resendActOtp } = await import("./payment-act-service");
        return resendActOtp(input.actId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
