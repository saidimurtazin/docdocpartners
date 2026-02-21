import { AGENT_COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, agentProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { SignJWT, jwtVerify } from "jose";
import { notifyNewDeviceLogin } from "./telegram-notifications";
import { calculateWithdrawalTax } from "./payout-calculator";

// ==================== RATE LIMITING ====================
const otpRateLimits = new Map<string, { count: number; resetAt: number }>();
const otpVerifyAttempts = new Map<string, { count: number; blockedUntil: number }>();

/** Rate limit OTP requests: max 5 per email per 10 minutes */
function checkOtpRateLimit(email: string): void {
  const key = email.toLowerCase();
  const now = Date.now();
  const entry = otpRateLimits.get(key);

  if (!entry || now > entry.resetAt) {
    otpRateLimits.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return;
  }

  if (entry.count >= 5) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Слишком много запросов. Попробуйте через 10 минут.",
    });
  }

  entry.count++;
}

/** Rate limit OTP verification: max 5 attempts per email, block for 15 min after */
function checkOtpVerifyLimit(email: string): void {
  const key = email.toLowerCase();
  const now = Date.now();
  const entry = otpVerifyAttempts.get(key);

  if (entry && now < entry.blockedUntil) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Слишком много попыток. Аккаунт временно заблокирован на 15 минут.",
    });
  }

  if (!entry || now > entry.blockedUntil) {
    otpVerifyAttempts.set(key, { count: 1, blockedUntil: 0 });
    return;
  }

  entry.count++;
  if (entry.count >= 5) {
    entry.blockedUntil = now + 15 * 60 * 1000;
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Слишком много неверных попыток. Попробуйте через 15 минут.",
    });
  }
}

/** Clear verify attempts on successful OTP verification */
function clearOtpVerifyLimit(email: string): void {
  otpVerifyAttempts.delete(email.toLowerCase());
}

// Cleanup rate limit maps every 30 minutes
setInterval(() => {
  const now = Date.now();
  otpRateLimits.forEach((v, k) => { if (now > v.resetAt) otpRateLimits.delete(k); });
  otpVerifyAttempts.forEach((v, k) => { if (now > v.blockedUntil + 60000) otpVerifyAttempts.delete(k); });
}, 30 * 60 * 1000);

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

/** Staff roles that can access admin panel */
const STAFF_ROLES = ["admin", "support", "accountant"] as const;
type StaffRole = typeof STAFF_ROLES[number];

/** Check if user has one of the required roles. Throws FORBIDDEN if not. */
function checkRole(ctx: { user: any }, ...roles: StaffRole[]) {
  if (!ctx.user || !roles.includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Недостаточно прав" });
  }
}

/**
 * Auto-create a task when referral status changes.
 * Skips if a pending task of the same type already exists for this referral.
 */
async function autoCreateTaskForReferral(
  referralId: number,
  newStatus: string,
  referral: { patientFullName: string; agentId: number }
) {
  const taskMap: Record<string, { type: string; title: string }> = {
    new: { type: "contact_patient", title: `Связаться с пациентом ${referral.patientFullName}` },
    contacted: { type: "schedule_appointment", title: `Записать пациента ${referral.patientFullName} на приём` },
    scheduled: { type: "confirm_visit", title: `Подтвердить визит пациента ${referral.patientFullName}` },
  };
  const taskDef = taskMap[newStatus];
  if (!taskDef) return;

  const exists = await db.hasPendingTaskForReferral(referralId, taskDef.type);
  if (exists) return;

  await db.createTask({
    type: taskDef.type,
    title: taskDef.title,
    referralId,
    agentId: referral.agentId,
    priority: "normal",
  });
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

        // Handle staff session (admin/support/accountant)
        const staffRoles = ["admin", "support", "accountant"];
        if (staffRoles.includes(session.role) && session.userId) {
          const staffUser = await db.getUserById(session.userId);
          if (staffUser) {
            return {
              openId: staffUser.openId,
              appId: process.env.VITE_APP_ID || '',
              name: staffUser.name,
              email: staffUser.email,
              role: staffUser.role,
              userId: staffUser.id,
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
      .input(z.object({
        email: z.string().email(),
        channel: z.enum(["email", "telegram"]).optional().default("email"),
      }))
      .mutation(async ({ input }) => {
        // Rate limit OTP requests
        checkOtpRateLimit(input.email);

        // PRIORITY 1: Check if user is staff (admin/support/accountant)
        const staffUser = await db.getUserByEmail(input.email);

        if (staffUser && STAFF_ROLES.includes(staffUser.role as StaffRole)) {
          // Generate OTP for staff
          const crypto = await import("crypto");
          const code = crypto.randomInt(100000, 1000000).toString();
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
          if (process.env.NODE_ENV !== "production") console.log('[RequestOTP] Staff code generated for', input.email);

          // Save OTP to database
          const dbInstance = await db.getDb();
          if (!dbInstance) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Database connection error",
            });
          }

          const { otpCodes: otpCodesTable } = await import("../drizzle/schema");
          const { eq: eqOtp, and: andOtp } = await import("drizzle-orm");

          // Invalidate existing unused OTPs for this email
          await dbInstance.update(otpCodesTable)
            .set({ used: "yes" })
            .where(andOtp(eqOtp(otpCodesTable.email, input.email), eqOtp(otpCodesTable.used, "no")));

          await dbInstance.insert(otpCodesTable).values({
            email: input.email,
            code,
            expiresAt,
            used: "no",
          });

          let telegramSent = false;
          let emailSent = false;

          // All staff: send via Telegram if configured
          if (staffUser.telegramId) {
            try {
              const { notifyAgent } = await import("./telegram-bot-webhook");
              await notifyAgent(
                staffUser.telegramId,
                `🔐 <b>Код для входа в панель:</b>\n\n<code>${code}</code>\n\nКод действителен 10 минут.\n\n⚠️ Никому не сообщайте этот код!`
              );
              telegramSent = true;
              console.log("[RequestOTP] Telegram OTP sent to staff:", input.email);
            } catch (err) {
              console.error("[RequestOTP] Failed to send Telegram to staff:", input.email, err);
            }
          }

          // All staff: send OTP via email
          try {
            const { sendOTPEmail } = await import("./email");
            console.log("[RequestOTP] Sending OTP email to staff:", input.email, "role:", staffUser.role);
            emailSent = await sendOTPEmail(input.email, code, 'login');
            console.log("[RequestOTP] sendOTPEmail result for staff:", emailSent, "email:", input.email);
          } catch (err) {
            console.error("[RequestOTP] Failed to send email OTP to staff:", input.email, "role:", staffUser.role, "error:", err);
          }

          // If neither channel worked, throw error
          if (!emailSent && !telegramSent) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Не удалось отправить код. Проверьте email и попробуйте позже.",
            });
          }

          return { success: true };
        }

        // PRIORITY 2: Check agents (existing logic)
        const agent = await db.getAgentByEmail(input.email);

        if (!agent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Пользователь не найден. Зарегистрируйтесь на сайте или в Telegram-боте.",
          });
        }

        if (agent.status !== "active") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Ваш аккаунт не активирован. Обратитесь в поддержку.",
          });
        }

        // Channel: "telegram" — send OTP only via Telegram
        if (input.channel === "telegram") {
          if (!agent.telegramId) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "Telegram не привязан к вашему аккаунту. Используйте вход через Email.",
            });
          }

          // Generate & save OTP to DB
          const { generateOTP } = await import("./email");
          const code = generateOTP();
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
          const dbInstance = await db.getDb();
          if (!dbInstance) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection error" });
          }
          const { otpCodes: otpCodesTable } = await import("../drizzle/schema");
          await dbInstance.insert(otpCodesTable).values({
            email: input.email,
            code,
            expiresAt,
            used: "no",
          });

          // Send via Telegram
          try {
            const { notifyAgent } = await import("./telegram-bot-webhook");
            await notifyAgent(
              agent.telegramId,
              `🔐 <b>Код для входа в личный кабинет:</b>\n\n<code>${code}</code>\n\nКод действителен 10 минут.\n\n⚠️ Никому не сообщайте этот код!`
            );
          } catch (err) {
            console.error("[RequestOTP] Failed to send Telegram OTP:", err);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Не удалось отправить код в Telegram. Попробуйте позже.",
            });
          }

          return { success: true };
        }

        // Channel: "email" — send OTP via email (+ Telegram as secondary)
        const { createAndSendOTP } = await import("./otp");
        const sent = await createAndSendOTP(input.email, 'login');
        if (!sent) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Не удалось отправить код на email. Попробуйте позже.",
          });
        }

        // Also send OTP via Telegram if agent has telegramId (secondary channel)
        if (agent.telegramId) {
          try {
            // Read the last OTP code from DB for this email to send via Telegram
            const dbInstance = await db.getDb();
            if (dbInstance) {
              const { otpCodes: otpCodesTable } = await import("../drizzle/schema");
              const { and, eq, sql, desc } = await import("drizzle-orm");
              const [lastOtp] = await dbInstance
                .select()
                .from(otpCodesTable)
                .where(and(eq(otpCodesTable.email, input.email), eq(otpCodesTable.used, "no")))
                .orderBy(desc(otpCodesTable.id))
                .limit(1);
              if (lastOtp) {
                const { notifyAgent } = await import("./telegram-bot-webhook");
                await notifyAgent(
                  agent.telegramId,
                  `🔐 <b>Код для входа в личный кабинет:</b>\n\n<code>${lastOtp.code}</code>\n\nКод действителен 10 минут.\n\n⚠️ Никому не сообщайте этот код!`
                );
              }
            }
          } catch (err) {
            console.error("[RequestOTP] Failed to send Telegram notification to agent:", err);
            // Non-blocking — email is the primary channel
          }
        }

        return { success: true };
      }),
    
    verifyOtp: publicProcedure
      .input(z.object({
        email: z.string().email(),
        code: z.string().regex(/^\d{6}$/, "OTP must be 6 digits")
      }))
      .mutation(async ({ input, ctx }) => {
        // Rate limit OTP verification attempts
        checkOtpVerifyLimit(input.email);

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

        // Atomic: Mark OTP as used only if it's still unused (prevents race condition)
        const updateResult = await dbInstance
          .update(otpCodesTable)
          .set({ used: "yes" })
          .where(
            and(
              eq(otpCodesTable.id, otpRecord.id),
              eq(otpCodesTable.used, "no")
            )
          );

        // Check if the update actually affected a row (Drizzle MySQL returns [ResultSetHeader])
        const affectedRows = (updateResult as any)?.[0]?.affectedRows ?? (updateResult as any)?.rowCount ?? 1;
        if (affectedRows === 0) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Код уже использован. Запросите новый.",
          });
        }

        // Clear rate limit on successful verification
        clearOtpVerifyLimit(input.email);

        // Check if user is staff (admin/support/accountant)
        const [staffUser] = await dbInstance
          .select()
          .from(usersTable)
          .where(
            and(
              eq(usersTable.email, input.email),
              sql`${usersTable.role} IN ('admin', 'support', 'accountant')`
            )
          )
          .limit(1);

        if (staffUser) {
          // Create staff session token with actual role
          const secret = getJwtSecret();
          const token = await new SignJWT({
            userId: staffUser.id,
            role: staffUser.role,
            email: staffUser.email,
          })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("30d")
            .sign(secret);

          // Create staff session record in DB (for revocation)
          const staffDeviceInfo = ctx.req.headers["user-agent"] || null;
          const staffIpAddress = (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
                                 (ctx.req.headers["x-real-ip"] as string) ||
                                 ctx.req.socket.remoteAddress || null;
          const staffExpiresAt = new Date();
          staffExpiresAt.setDate(staffExpiresAt.getDate() + 30);

          await db.createSession({
            userId: staffUser.id,
            sessionToken: token,
            deviceInfo: staffDeviceInfo,
            ipAddress: staffIpAddress,
            loginMethod: "email_otp",
            lastActivityAt: new Date(),
            expiresAt: staffExpiresAt,
            isRevoked: "no",
          });

          // Set session cookie
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(AGENT_COOKIE_NAME, token, {
            ...cookieOptions,
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          });

          return {
            success: true,
            role: staffUser.role,
            user: {
              id: staffUser.id,
              name: staffUser.name,
              email: staffUser.email,
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

        // Check agent status — only active agents can log in
        if (agent.status !== "active") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: agent.status === "pending"
              ? "Ваш аккаунт ещё не активирован администратором. Ожидайте подтверждения."
              : "Ваш аккаунт заблокирован. Обратитесь в поддержку.",
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

    // ===== WEB REGISTRATION =====

    requestRegistrationOtp: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        // Check email not already registered as agent
        const existingAgent = await db.getAgentByEmail(input.email);
        if (existingAgent) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Этот email уже зарегистрирован. Войдите в личный кабинет.",
          });
        }

        // Check email not admin
        const adminUser = await db.getUserByEmail(input.email);
        if (adminUser) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Этот email уже используется.",
          });
        }

        // Send OTP via email
        const { createAndSendOTP } = await import("./otp");
        const sent = await createAndSendOTP(input.email);
        if (!sent) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Не удалось отправить код. Попробуйте позже.",
          });
        }

        return { success: true };
      }),

    verifyRegistrationOtp: publicProcedure
      .input(z.object({
        email: z.string().email(),
        code: z.string().regex(/^\d{6}$/, "Код должен состоять из 6 цифр"),
      }))
      .mutation(async ({ input }) => {
        const { verifyOTP } = await import("./otp");
        const valid = await verifyOTP(input.email, input.code);
        if (!valid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Неверный или истекший код",
          });
        }

        // Create short-lived registration token (15 min)
        const secret = getJwtSecret();
        const regToken = await new SignJWT({
          email: input.email,
          purpose: "registration",
        })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("15m")
          .sign(secret);

        return { success: true, registrationToken: regToken };
      }),

    register: publicProcedure
      .input(z.object({
        registrationToken: z.string(),
        fullName: z.string().min(3).max(150),
        phone: z.string().min(11).max(20),
        role: z.string().min(1),
        specialization: z.string().optional(),
        city: z.string().min(2).max(50),
        excludedClinics: z.array(z.number()).optional(),
        referralCode: z.string().optional(),
        contractAccepted: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 1. Verify registration token
        const secret = getJwtSecret();
        let email: string;
        try {
          const { payload } = await jwtVerify(input.registrationToken, secret);
          if (payload.purpose !== "registration") {
            throw new Error("Invalid token purpose");
          }
          email = payload.email as string;
        } catch {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Токен регистрации истёк. Начните заново.",
          });
        }

        // 2. Validate contract acceptance
        if (!input.contractAccepted) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Необходимо принять условия договора.",
          });
        }

        // 3. Server-side validation
        const { validateFullName, validatePhoneAdvanced, validateCity, capitalizeWords } = await import("./validation");

        const nameCheck = validateFullName(input.fullName);
        if (!nameCheck.valid) {
          throw new TRPCError({ code: "BAD_REQUEST", message: nameCheck.error || "Неверное ФИО" });
        }

        const phoneCheck = validatePhoneAdvanced(input.phone);
        if (!phoneCheck.valid) {
          throw new TRPCError({ code: "BAD_REQUEST", message: phoneCheck.error || "Неверный телефон" });
        }

        const cityCheck = validateCity(input.city);
        if (!cityCheck.valid) {
          throw new TRPCError({ code: "BAD_REQUEST", message: cityCheck.error || "Неверный город" });
        }

        // 4. Check email not already taken (race condition guard)
        const existingAgent = await db.getAgentByEmail(email);
        if (existingAgent) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Этот email уже зарегистрирован.",
          });
        }

        // 4b. Check phone not already taken
        const existingByPhone = await db.getAgentByPhone(phoneCheck.normalized || input.phone);
        if (existingByPhone) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Этот номер телефона уже зарегистрирован. Войдите в личный кабинет или используйте другой номер.",
          });
        }

        // 5. Generate referral code
        const crypto = await import("crypto");
        const referralCode = crypto.randomBytes(6).toString("hex");

        // 6. Resolve referredBy (only active agents can be referrers)
        let referredByAgentId: number | null = null;
        if (input.referralCode && input.referralCode.trim()) {
          const code = input.referralCode.trim();
          // First: try as hex referral code from database
          const referrer = await db.getAgentByReferralCode(code);
          if (referrer && referrer.status === 'active') {
            referredByAgentId = referrer.id;
          } else if (referrer) {
            console.warn(`[Register] Referrer ${referrer.id} is not active (status: ${referrer.status}), skipping`);
          } else {
            // Second: try as agent ID — supports "4", "ref_4", "ref4" formats
            const cleanedId = code.replace(/^ref[_-]?/i, '');
            const parsedId = parseInt(cleanedId, 10);
            if (!isNaN(parsedId) && parsedId > 0) {
              const agentById = await db.getAgentById(parsedId);
              if (agentById && agentById.status === 'active') {
                referredByAgentId = agentById.id;
              } else if (agentById) {
                console.warn(`[Register] Referrer ${parsedId} is not active (status: ${agentById.status}), skipping`);
              }
            }
          }
        }

        // 7. Prepare excluded clinics
        const excludedClinicsJson = input.excludedClinics?.length
          ? JSON.stringify(input.excludedClinics)
          : null;

        // 8. Create agent (telegramId is null for web registration)
        let agentId: number;
        try {
          agentId = await db.createAgent({
            telegramId: null,
            fullName: capitalizeWords(input.fullName),
            email,
            phone: phoneCheck.normalized || input.phone,
            role: input.role,
            specialization: input.specialization || null,
            city: capitalizeWords(input.city),
            status: "pending",
            referralCode,
            referredBy: referredByAgentId,
            excludedClinics: excludedClinicsJson,
          });
        } catch (dbError: any) {
          // Handle MySQL duplicate key errors (from UNIQUE constraints)
          if (dbError?.code === 'ER_DUP_ENTRY' || dbError?.message?.includes('Duplicate entry')) {
            const msg = dbError.message || '';
            if (msg.includes('email')) {
              throw new TRPCError({ code: "CONFLICT", message: "Этот email уже зарегистрирован." });
            }
            if (msg.includes('phone')) {
              throw new TRPCError({ code: "CONFLICT", message: "Этот номер телефона уже зарегистрирован." });
            }
            throw new TRPCError({ code: "CONFLICT", message: "Данные уже используются другим аккаунтом." });
          }
          throw dbError;
        }

        // 9. Send registration confirmation email to agent
        try {
          const { sendRegistrationConfirmation } = await import("./email");
          await sendRegistrationConfirmation({
            to: email,
            agentName: capitalizeWords(input.fullName),
          });
        } catch (err) {
          console.error("[Register] Failed to send confirmation email:", err);
        }

        // 10. Credit referral bonus to inviting agent
        if (referredByAgentId) {
          await db.addBonusPoints(referredByAgentId, 100000); // 1,000₽

          // Notify inviter via Telegram if they have telegramId
          try {
            const inviter = await db.getAgentById(referredByAgentId);
            if (inviter?.telegramId) {
              const { notifyAgent } = await import("./telegram-bot-webhook");
              await notifyAgent(
                inviter.telegramId,
                `🎉 <b>Новый реферал!</b>\n\n` +
                `Агент <b>${capitalizeWords(input.fullName)}</b> зарегистрировался по вашей ссылке.\n\n` +
                `💰 Вам начислен бонус: <b>1 000 ₽</b>\n` +
                `📊 Бонус будет доступен после 10 оплаченных направлений.`
              );
            }
          } catch (err) {
            console.error("[Register] Failed to notify referrer:", err);
          }
        }

        // 10. Notify admin about new registration
        try {
          const { notifyAgent } = await import("./telegram-bot-webhook");
          // Find first admin user to notify
          const adminEmail = process.env.ADMIN_EMAIL || "said.i.murtazin@gmail.com";
          const admin = await db.getUserByEmail(adminEmail);
          if (admin?.telegramId) {
            await notifyAgent(
              admin.telegramId,
              `📋 <b>Новая заявка на регистрацию (веб)</b>\n\n` +
              `👤 ${capitalizeWords(input.fullName)}\n` +
              `📧 ${email}\n` +
              `📱 ${phoneCheck.normalized || input.phone}\n` +
              `🏷 ${input.role}${input.specialization ? ` — ${input.specialization}` : ''}\n` +
              `🏙 ${capitalizeWords(input.city)}`
            );
          }
        } catch (err) {
          console.error("[Register] Failed to notify admin:", err);
        }

        // No auto-login for pending agents — they must wait for admin activation
        // and then log in via the normal OTP flow
        return { success: true, agentId };
      }),

  }),

  // AI Assistant for DocPartner agents (requires agent login)
  ai: router({
    ask: agentProcedure
      .input(z.object({ question: z.string() }))
      .mutation(async ({ input }) => {
        const systemPrompt = `Ты — AI-ассистент программы DocPartner с доступом к поиску в интернете. Отвечай на русском языке.

**О программе:**
DocPartner — B2B-платформа агентских рекомендаций в здравоохранении. Врачи-агенты направляют пациентов в проверенные клиники и получают вознаграждение.

**Ключевые факты:**
- Вознаграждение: 10% от суммы лечения (агенту), 5% DocPartner
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
    // Check if user is staff (admin/support/accountant)
    checkAdmin: protectedProcedure.query(({ ctx }) => {
      checkRole(ctx, "admin", "support", "accountant");
      return { isAdmin: true, role: ctx.user.role };
    }),

    // AGENTS
    agents: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        checkRole(ctx, "admin", "support");
        return db.getAllAgents();
      }),
      getById: protectedProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "support");
          return db.getAgentById(input.id);
        }),
      updateStatus: protectedProcedure
        .input(z.object({
          id: z.number(),
          status: z.enum(["pending", "active", "rejected", "blocked"])
        }))
        .mutation(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "support");
          await db.updateAgentStatus(input.id, input.status);
          return { success: true };
        }),
      updateExcludedClinics: protectedProcedure
        .input(z.object({
          agentId: z.number(),
          clinicIds: z.array(z.number()),
        }))
        .mutation(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "support");
          await db.updateAgentExcludedClinics(input.agentId, input.clinicIds);
          return { success: true };
        }),
      removeExcludedClinic: protectedProcedure
        .input(z.object({
          agentId: z.number(),
          clinicId: z.number(),
        }))
        .mutation(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "support");
          await db.removeAgentExcludedClinic(input.agentId, input.clinicId);
          return { success: true };
        }),

      // Jump.Finance: verify self-employment via force-identify
      verifyViaJump: protectedProcedure
        .input(z.object({ agentId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "support");
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
          checkRole(ctx, "admin", "support");
          await db.updateAgentRequisites(input.agentId, { isSelfEmployed: input.isSelfEmployed });
          return { success: true };
        }),

      // Hard-delete agent and all related records
      hardDelete: protectedProcedure
        .input(z.object({ agentId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          checkRole(ctx, "admin");
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
        checkRole(ctx, "admin", "support");
        return db.getAllReferrals();
      }),
      getById: protectedProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "support");
          return db.getReferralById(input.id);
        }),
      updateStatus: protectedProcedure
        .input(z.object({
          id: z.number(),
          status: z.enum(["new", "in_progress", "contacted", "scheduled", "visited", "paid", "duplicate", "no_answer", "cancelled"])
        }))
        .mutation(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "support");

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

            // Auto-create tasks based on new status
            try {
              await autoCreateTaskForReferral(input.id, input.status, referral);
            } catch (err) {
              console.error("[Admin] Failed to auto-create task:", err);
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
          checkRole(ctx, "admin", "support");
          await db.updateReferralAmounts(input.id, input.treatmentAmount, input.commissionAmount);
          return { success: true };
        }),
    }),

    // PAYMENTS
    payments: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        checkRole(ctx, "admin", "accountant");
        return db.getAllPayments();
      }),
      updateStatus: protectedProcedure
        .input(z.object({
          id: z.number(),
          status: z.enum(["pending", "act_generated", "sent_for_signing", "signed", "ready_for_payment", "processing", "completed", "failed"]),
          transactionId: z.string().optional()
        }))
        .mutation(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "accountant");
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
          checkRole(ctx, "admin", "accountant");
          const { generateAct } = await import("./payment-act-service");
          return generateAct(input.paymentId);
        }),
      sendForSigning: protectedProcedure
        .input(z.object({ actId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "accountant");
          const { sendActSigningOtp } = await import("./payment-act-service");
          return sendActSigningOtp(input.actId);
        }),
      regenerateAct: protectedProcedure
        .input(z.object({ paymentId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "accountant");
          const { regenerateAct } = await import("./payment-act-service");
          return regenerateAct(input.paymentId);
        }),
      getAct: protectedProcedure
        .input(z.object({ paymentId: z.number() }))
        .query(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "accountant");
          return db.getPaymentActByPaymentId(input.paymentId);
        }),
      batchMarkCompleted: protectedProcedure
        .input(z.object({ paymentIds: z.array(z.number()) }))
        .mutation(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "accountant");
          for (const id of input.paymentIds) {
            await db.updatePaymentStatus(id, "completed");
          }
          return { success: true, count: input.paymentIds.length };
        }),

      // Jump.Finance: pay out via Jump (manual admin button)
      payViaJump: protectedProcedure
        .input(z.object({ paymentId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "accountant");
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
          checkRole(ctx, "admin", "accountant");
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
        checkRole(ctx, "admin", "accountant");
        return db.getAllDoctors();
      }),
      getById: protectedProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "accountant");
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
          checkRole(ctx, "admin", "accountant");
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
          checkRole(ctx, "admin", "accountant");
          const { id, ...data } = input;
          await db.updateDoctor(id, data);
          return { success: true };
        }),
      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "accountant");
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
          checkRole(ctx, "admin", "accountant");
          return db.searchDoctors(input);
        }),
    }),

    // CLINICS
    clinics: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        checkRole(ctx, "admin");
        return db.getAllClinicsAdmin();
      }),
      getById: protectedProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ ctx, input }) => {
          checkRole(ctx, "admin");
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
          checkRole(ctx, "admin");
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
          checkRole(ctx, "admin");
          const { id, ...data } = input;
          await db.updateClinic(id, data);
          return { success: true };
        }),
      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
          checkRole(ctx, "admin");
          await db.deleteClinic(input.id);
          return { success: true };
        }),
    }),

    // STATISTICS
    statistics: protectedProcedure.query(async ({ ctx }) => {
      checkRole(ctx, "admin");
      return db.getStatistics();
    }),

    // APP SETTINGS (global commission tiers, etc.)
    settings: router({
      get: protectedProcedure
        .input(z.object({ key: z.string() }))
        .query(async ({ ctx, input }) => {
          checkRole(ctx, "admin");
          return db.getAppSetting(input.key);
        }),
      set: protectedProcedure
        .input(z.object({ key: z.string(), value: z.string() }))
        .mutation(async ({ ctx, input }) => {
          checkRole(ctx, "admin");
          await db.setAppSetting(input.key, input.value);
          return { success: true };
        }),

      // Commission tiers management
      getCommissionTiers: protectedProcedure
        .query(async ({ ctx }) => {
          checkRole(ctx, "admin");
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
          checkRole(ctx, "admin");
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
          checkRole(ctx, "admin", "support", "accountant");
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
          checkRole(ctx, "admin", "support", "accountant");
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
          checkRole(ctx, "admin", "support", "accountant");
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
          checkRole(ctx, "admin", "support", "accountant");
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
          checkRole(ctx, "admin", "support", "accountant");
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
          checkRole(ctx, "admin", "support");
          return db.getAllClinicReports(input || undefined);
        }),

      getById: protectedProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "support");
          return db.getClinicReportById(input.id);
        }),

      stats: protectedProcedure.query(async ({ ctx }) => {
        checkRole(ctx, "admin", "support");
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
          checkRole(ctx, "admin", "support");

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
          checkRole(ctx, "admin", "support");
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
          checkRole(ctx, "admin", "support");
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
          checkRole(ctx, "admin", "support");
          await db.linkClinicReportToReferral(input.id, input.referralId);
          return { success: true };
        }),

      triggerPoll: protectedProcedure.mutation(async ({ ctx }) => {
        checkRole(ctx, "admin", "support");
        const { processNewClinicEmails } = await import("./clinic-report-processor");
        return processNewClinicEmails();
      }),

      searchReferrals: protectedProcedure
        .input(z.object({
          search: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "support");
          return db.searchReferrals(input?.search, 20);
        }),
    }),

    // STAFF MANAGEMENT (admin only)
    staff: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        checkRole(ctx, "admin");
        return db.getAllStaffUsers();
      }),
      create: protectedProcedure
        .input(z.object({
          name: z.string().min(2),
          email: z.string().email(),
          phone: z.string().optional(),
          role: z.enum(["admin", "support", "accountant"]),
        }))
        .mutation(async ({ ctx, input }) => {
          checkRole(ctx, "admin");
          // Check email not taken
          const existing = await db.getUserByEmail(input.email);
          if (existing) {
            throw new TRPCError({ code: "CONFLICT", message: "Пользователь с таким email уже существует" });
          }
          const id = await db.createStaffUser(input);
          return { success: true, id };
        }),
      update: protectedProcedure
        .input(z.object({
          id: z.number(),
          name: z.string().min(2).optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          role: z.enum(["admin", "support", "accountant"]).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          checkRole(ctx, "admin");
          const { id, ...data } = input;
          await db.updateStaffUser(id, data);
          return { success: true };
        }),
      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
          checkRole(ctx, "admin");
          // Can't delete yourself
          if (ctx.user.id === input.id) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Нельзя удалить свой аккаунт" });
          }
          await db.deleteStaffUser(input.id);
          return { success: true };
        }),
    }),

    // TASKS (admin + support)
    tasks: router({
      list: protectedProcedure
        .input(z.object({
          status: z.string().optional(),
          assignedTo: z.number().optional(),
        }).optional())
        .query(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "support");
          return db.getTasksList(input || undefined);
        }),
      stats: protectedProcedure.query(async ({ ctx }) => {
        checkRole(ctx, "admin", "support");
        return db.getTaskStats();
      }),
      create: protectedProcedure
        .input(z.object({
          type: z.string().default("manual"),
          title: z.string().min(2),
          referralId: z.number().optional(),
          agentId: z.number().optional(),
          assignedTo: z.number().optional(),
          priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
          notes: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "support");
          const id = await db.createTask(input);
          return { success: true, id };
        }),
      updateStatus: protectedProcedure
        .input(z.object({
          id: z.number(),
          status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
        }))
        .mutation(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "support");
          await db.updateTaskStatus(input.id, input.status, ctx.user.id);
          return { success: true };
        }),
      assign: protectedProcedure
        .input(z.object({
          id: z.number(),
          userId: z.number(),
        }))
        .mutation(async ({ ctx, input }) => {
          checkRole(ctx, "admin", "support");
          await db.assignTask(input.id, input.userId);
          return { success: true };
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

  // BOT API - Limited public endpoints for client integration
  // NOTE: Bot itself uses DB directly (telegram-bot-webhook.ts), NOT these tRPC endpoints
  // TODO: Migrate AgentCabinet.tsx to use agentProcedure-based endpoints instead of bot.*
  bot: router({
    // Get agent by telegram ID (used by AgentCabinet.tsx)
    // Returns only safe fields — never expose financial/banking data via public endpoint
    getAgent: publicProcedure
      .input(z.object({ telegramId: z.string() }))
      .query(async ({ input }) => {
        const agent = await db.getAgentByTelegramId(input.telegramId);
        if (!agent) return { agent: null };
        return {
          agent: {
            id: agent.id,
            telegramId: agent.telegramId,
            fullName: agent.fullName,
            email: agent.email,
            phone: agent.phone,
            role: agent.role,
            city: agent.city,
            specialization: agent.specialization,
            status: agent.status,
            referralCode: agent.referralCode,
            totalEarnings: agent.totalEarnings,
            totalReferrals: agent.totalReferrals,
            isSelfEmployed: agent.isSelfEmployed,
            createdAt: agent.createdAt,
          },
        };
      }),

    // Get agent statistics (used by AgentCabinet.tsx)
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

      // Referral program: count active agents invited by this agent
      const { agents: agentsTable } = await import("../drizzle/schema");
      const { eq: eqOp, and: andOp } = await import("drizzle-orm");
      const database = await db.getDb();
      let referredAgentsCount = 0;
      if (database) {
        const referred = await database.select({ id: agentsTable.id }).from(agentsTable)
          .where(andOp(eqOp(agentsTable.referredBy, ctx.agentId), eqOp(agentsTable.status, 'active')));
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
        notes: z.string().max(500, "Примечание не должно превышать 500 символов").optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const agent = await db.getAgentById(ctx.agentId);
        if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Агент не найден" });
        if (agent.status !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "Аккаунт не активен" });

        // Validate name has exactly 3 words (Фамилия Имя Отчество)
        const nameWords = input.patientFullName.trim().split(/\s+/);
        if (nameWords.length !== 3) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Укажите ФИО пациента (Фамилия Имя Отчество — 3 слова)" });
        }

        const referralId = await db.createReferral({
          agentId: ctx.agentId,
          patientFullName: input.patientFullName.trim(),
          patientBirthdate: input.patientBirthdate,
          patientCity: input.patientCity || undefined,
          patientPhone: input.patientPhone || undefined,
          patientEmail: input.patientEmail || undefined,
          clinic: input.clinic || undefined,
          notes: input.notes?.trim() || undefined,
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
            notes: input.notes,
          });
        } catch (emailError) {
          console.error("[Dashboard] Email notification failed:", emailError);
        }

        // Auto-create task for new referral
        try {
          await autoCreateTaskForReferral(referralId, "new", {
            patientFullName: input.patientFullName.trim(),
            agentId: ctx.agentId,
          });
        } catch (err) {
          console.error("[Dashboard] Failed to auto-create task:", err);
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
