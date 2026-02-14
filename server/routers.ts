import { AGENT_COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { SignJWT } from "jose";
import { notifyNewDeviceLogin } from "./telegram-notifications";

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
          console.log('[RequestOTP] Admin:', code, 'for', input.email);

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

          // Send OTP to admin via Telegram
          const { notifyAgent } = await import("./telegram-bot-webhook");
          await notifyAgent(
            adminUser.telegramId,
            `🔐 <b>Код для входа в админ-панель:</b>\n\n<code>${code}</code>\n\nКод действителен 5 минут.\n\n⚠️ Никому не сообщайте этот код!`
          );

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
        console.log('[RequestOTP] Agent:', code, 'for email:', input.email);

        // Save OTP to database
        const dbInstance = await db.getDb();
        if (!dbInstance) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database connection error",
          });
        }

        const { otpCodes: otpCodesTable } = await import("../drizzle/schema");
        console.log('[RequestOTP] Inserting OTP into database...');
        const insertResult = await dbInstance.insert(otpCodesTable).values({
          email: input.email,
          code,
          expiresAt,
          used: "no",
        });
        console.log('[RequestOTP] OTP inserted successfully:', insertResult);

        // Send OTP via Telegram bot to agent
        console.log('[RequestOTP] Sending Telegram notification...');
        const { notifyAgent } = await import("./telegram-bot-webhook");
        await notifyAgent(
          agent.telegramId,
          `🔐 <b>Код для входа в личный кабинет:</b>\n\n<code>${code}</code>\n\nКод действителен 5 минут.\n\n⚠️ Никому не сообщайте этот код!`
        );

        return { success: true };
      }),
    
    verifyOtp: publicProcedure
      .input(z.object({
        email: z.string().email(),
        code: z.string().length(6)
      }))
      .mutation(async ({ input, ctx }) => {
        console.log("[VerifyOTP] Attempt for email:", input.email, "code:", input.code);

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
          console.log("[VerifyOTP] Admin user found, creating admin session");

          // Create admin session token
          const secret = new TextEncoder().encode(process.env.JWT_SECRET || "");
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

          console.log("[VerifyOTP] Admin session created successfully");

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
        console.log("[VerifyOTP] Searching for agent with email:", input.email);
        const agent = await db.getAgentByEmail(input.email);
        if (!agent) {
          console.log("[VerifyOTP] Agent not found for email:", input.email);
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Agent not found",
          });
        }

        console.log("[VerifyOTP] Agent found:", agent.id, agent.fullName);

        // Create session token
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || "");
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

        console.log("[VerifyOTP] Agent session created successfully for:", agent.email);

        return { success: true, role: "agent" };
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
          status: z.enum(["pending", "contacted", "scheduled", "completed", "cancelled"]) 
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          await db.updateReferralStatus(input.id, input.status);
          return { success: true };
        }),
      updateAmounts: protectedProcedure
        .input(z.object({ 
          id: z.number(), 
          treatmentAmount: z.number(), 
          commissionAmount: z.number() 
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
          status: z.enum(["pending", "processing", "completed", "failed"]),
          transactionId: z.string().optional()
        }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
          await db.updatePaymentStatus(input.id, input.status, input.transactionId);
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

    // STATISTICS
    statistics: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return db.getStatistics();
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
      }))
      .mutation(async ({ input }) => {
        const agent = await db.createAgent(input);
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

    // Update agent requisites (INN, bank details)
    updateRequisites: publicProcedure
      .input(z.object({
        telegramId: z.string(),
        inn: z.string(),
        isSelfEmployed: z.enum(["yes", "no", "unknown"]),
        bankName: z.string(),
        bankAccount: z.string(),
        bankBik: z.string(),
      }))
      .mutation(async ({ input }) => {
        const agent = await db.getAgentByTelegramId(input.telegramId);
        if (!agent) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
        }

        await db.updateAgentRequisites(agent.id, {
          inn: input.inn,
          isSelfEmployed: input.isSelfEmployed,
          bankName: input.bankName,
          bankAccount: input.bankAccount,
          bankBik: input.bankBik,
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

        // Check if agent has requisites
        if (!agent.inn || !agent.bankAccount) {
          throw new TRPCError({ 
            code: "PRECONDITION_FAILED", 
            message: "Please add your INN and bank details first" 
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
    // Get all sessions for current agent
    getSessions: protectedProcedure.query(async ({ ctx }) => {
      // Find agent by user's open ID or session token
      // For now, we'll use a placeholder - this needs proper agent auth
      // In production, you'd extract agent ID from JWT token
      
      // Temporary: get agent from context if available
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }

      // For demo purposes, return empty array
      // In production, extract agentId from JWT and call db.getSessionsByAgentId(agentId)
      return [];
    }),

    // Revoke a specific session
    revokeSession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
        }

        await db.revokeSession(input.sessionId);
        return { success: true };
      }),

    // Revoke all other sessions except current
    revokeAllOtherSessions: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }

      // Extract current session token from cookie
      const sessionToken = ctx.req.cookies[AGENT_COOKIE_NAME];
      if (!sessionToken) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No session token" });
      }

      // Get agent ID from session (placeholder)
      // In production, decode JWT to get agentId
      // await db.revokeAllSessionsExceptCurrent(agentId, sessionToken);
      
      return { success: true };
    }),
  }),

  // Agent Dashboard Router (for logged-in agents)
  dashboard: router({
    // Get dashboard statistics
    stats: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.agentId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Please login" });
      }
      const mockAgentId = ctx.agentId;
      
      const agent = await db.getAgentById(mockAgentId);
      if (!agent) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
      }

      const referrals = await db.getReferralsByAgentId(mockAgentId);
      const activeReferrals = referrals.filter(r => r.status === "pending" || r.status === "contacted" || r.status === "scheduled");
      const completedReferrals = referrals.filter(r => r.status === "completed");
      
      // Calculate this month earnings
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthReferrals = referrals.filter(r => {
        const createdAt = new Date(r.createdAt);
        return createdAt >= firstDayOfMonth && r.status === "completed";
      });
      const thisMonthEarnings = thisMonthReferrals.reduce((sum, r) => sum + (r.commissionAmount || 0), 0);

      // Calculate conversion rate
      const conversionRate = referrals.length > 0 
        ? Math.round((completedReferrals.length / referrals.length) * 100)
        : 0;

      return {
        totalEarnings: agent.totalEarnings || 0,
        activeReferrals: activeReferrals.length,
        conversionRate,
        thisMonthEarnings,
        totalReferrals: referrals.length,
        completedReferrals: completedReferrals.length,
      };
    }),

    // Get monthly earnings for chart (last 6 months)
    monthlyEarnings: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.agentId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Please login" });
      }
      const mockAgentId = ctx.agentId;
      
      const referrals = await db.getReferralsByAgentId(mockAgentId);
      const now = new Date();
      const months = [];
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = date.toLocaleDateString('ru-RU', { month: 'short' });
        const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
        
        const monthReferrals = referrals.filter(r => {
          const createdAt = new Date(r.createdAt);
          return createdAt >= date && createdAt < nextMonth && r.status === "completed";
        });
        
        const earnings = monthReferrals.reduce((sum, r) => sum + (r.commissionAmount || 0), 0);
        
        months.push({
          month: monthName,
          earnings: earnings / 100, // convert from kopecks to rubles
        });
      }
      
      return months;
    }),

    // Get referral status distribution
    referralsByStatus: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.agentId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Please login" });
      }
      const mockAgentId = ctx.agentId;
      const referrals = await db.getReferralsByAgentId(mockAgentId);
      
      const statusCounts = {
        pending: 0,
        contacted: 0,
        scheduled: 0,
        completed: 0,
        cancelled: 0,
      };
      
      referrals.forEach(r => {
        if (r.status in statusCounts) {
          statusCounts[r.status as keyof typeof statusCounts]++;
        }
      });
      
      return [
        { status: 'Ожидание', count: statusCounts.pending },
        { status: 'Контакт', count: statusCounts.contacted },
        { status: 'Записан', count: statusCounts.scheduled },
        { status: 'Завершено', count: statusCounts.completed },
        { status: 'Отменено', count: statusCounts.cancelled },
      ];
    }),

    // Get all referrals
    referrals: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.agentId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Please login" });
      }
      const mockAgentId = ctx.agentId;
      return db.getReferralsByAgentId(mockAgentId);
    }),

    // Get agent profile
    profile: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.agentId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Please login" });
      }
      const mockAgentId = ctx.agentId;
      const agent = await db.getAgentById(mockAgentId);
      if (!agent) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
      }
      return agent;
    }),

    // Update agent profile/requisites
    updateProfile: publicProcedure
      .input(z.object({
        inn: z.string().optional(),
        bankAccount: z.string().optional(),
        bankName: z.string().optional(),
        bankBik: z.string().optional(),
        isSelfEmployed: z.enum(["yes", "no", "unknown"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.agentId) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Please login" });
        }
        const mockAgentId = ctx.agentId;
        await db.updateAgentRequisites(mockAgentId, input);
        return { success: true };
      }),

    // Get payment history
    payments: publicProcedure.query(async () => {
      const mockAgentId = 1;
      return db.getPaymentsByAgentId(mockAgentId);
    }),

    // Update personal information
    updatePersonalInfo: publicProcedure
      .input(z.object({
        fullName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        city: z.string().optional(),
        specialization: z.string().optional(),
        role: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.agentId) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Please login" });
        }
        const mockAgentId = ctx.agentId;
        await db.updateAgentPersonalInfo(mockAgentId, input);
        return { success: true };
      }),

    // Request payment withdrawal
    requestPayment: publicProcedure
      .input(z.object({
        amount: z.number().min(100000), // minimum 1000 rubles in kopecks
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.agentId) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Please login" });
        }
        const mockAgentId = ctx.agentId;
        await db.createPaymentRequest(mockAgentId, input.amount);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
