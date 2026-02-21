import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { setupTelegramWebhook } from "../telegram-bot-webhook";
import cookieParser from "cookie-parser";
import cron from "node-cron";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.jump.finance"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'", "https://web.telegram.org"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  }));

  // Setup Telegram bot webhook BEFORE json parser (Telegraf handles its own body parsing)
  const webhookDomain = process.env.WEBHOOK_DOMAIN;
  if (!webhookDomain) {
    console.error('[Server] ERROR: WEBHOOK_DOMAIN environment variable is required!');
    console.error('[Server] Please set WEBHOOK_DOMAIN in Railway Variables');
    console.error('[Server] Example: WEBHOOK_DOMAIN=https://your-app.railway.app');
    throw new Error('WEBHOOK_DOMAIN is required');
  }
  await setupTelegramWebhook(app, '/telegram-webhook', webhookDomain);

  // Configure body parser with larger size limit for file uploads (AFTER webhook)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(cookieParser());

  // Rate limiter for OTP endpoints: 5 requests / 15 min per IP
  const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Слишком много запросов. Попробуйте через 15 минут." },
  });

  // Apply OTP rate limiter to auth endpoints before tRPC
  app.use('/api/trpc', (req, res, next) => {
    const url = req.url || '';
    const otpEndpoints = ['auth.requestOtp', 'auth.verifyOtp', 'auth.requestRegistrationOtp', 'auth.verifyRegistrationOtp'];
    if (otpEndpoints.some(ep => url.includes(ep))) {
      return otpLimiter(req, res, next);
    }
    next();
  });

  // Debug endpoint — only available in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    app.get("/api/debug-poll", async (req, res) => {
      const debugKey = process.env.DEBUG_POLL_KEY;
      if (!debugKey || req.query.key !== debugKey) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      try {
        const { processNewClinicEmails } = await import("../clinic-report-processor");
        const result = await processNewClinicEmails();
        res.json({ ok: true, result });
      } catch (error: any) {
        res.json({ ok: false, error: error.message });
      }
    });
  }

  // PDF download endpoint for payment acts
  app.get("/api/acts/:actId/pdf", async (req, res) => {
    try {
      const actId = parseInt(req.params.actId);
      if (!actId) { res.status(400).json({ error: "Invalid actId" }); return; }

      // Verify auth via session cookie
      const sessionToken = req.cookies?.session;
      if (!sessionToken) { res.status(401).json({ error: "Unauthorized" }); return; }

      const db = await import("../db");
      const session = await db.getSessionByToken(sessionToken);
      if (!session) { res.status(401).json({ error: "Unauthorized" }); return; }

      const sessionAgent = await db.getAgentById(session.agentId);
      if (!sessionAgent) { res.status(401).json({ error: "Unauthorized" }); return; }

      const act = await db.getPaymentActById(actId);
      if (!act) { res.status(404).json({ error: "Act not found" }); return; }

      // Allow only the agent who owns the act (admins use separate auth)
      if (sessionAgent.id !== act.agentId) {
        res.status(403).json({ error: "Forbidden" }); return;
      }

      // Generate PDF on the fly
      const { generatePaymentActPdf, toPatientInitials } = await import("../payment-act-pdf");
      const { ENV } = await import("./env");
      const allAgents = await db.getAllAgents();
      const agent = allAgents.find(a => a.id === act.agentId);
      if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }

      const agentReferrals = await db.getAgentPaidReferrals(agent.id);
      const referralData = agentReferrals.map(r => ({
        id: r.id,
        patientInitials: toPatientInitials(r.patientFullName),
        clinic: r.clinic || "—",
        treatmentAmount: r.treatmentAmount || 0,
        commissionAmount: r.commissionAmount || 0,
      }));

      const pdfBuffer = await generatePaymentActPdf({
        actNumber: act.actNumber,
        actDate: new Date(act.actDate),
        periodStart: new Date(act.periodStart),
        periodEnd: new Date(act.periodEnd),
        agent: {
          fullName: act.agentFullNameSnapshot,
          inn: act.agentInnSnapshot,
          bankName: act.agentBankNameSnapshot,
          bankAccount: act.agentBankAccountSnapshot,
          bankBik: act.agentBankBikSnapshot,
          isSelfEmployed: agent.isSelfEmployed === "yes",
        },
        referrals: referralData,
        totalAmount: act.totalAmount,
        company: {
          name: ENV.companyName, inn: ENV.companyInn, ogrn: ENV.companyOgrn,
          address: ENV.companyAddress, bankName: ENV.companyBankName,
          bankAccount: ENV.companyBankAccount, bankBik: ENV.companyBankBik,
          director: ENV.companyDirector,
        },
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${act.actNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("[ActPDF] Error generating PDF:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // Clinic reports email polling — every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      console.log("[Cron] Starting clinic email poll...");
      const { processNewClinicEmails } = await import("../clinic-report-processor");
      const result = await processNewClinicEmails();
      if (result.created > 0 || result.errors > 0) {
        console.log(`[Cron] Email poll done: created=${result.created}, errors=${result.errors}`);
      }
    } catch (error) {
      console.error("[Cron] Email poll failed:", error);
    }
  });
  console.log("[Cron] Clinic email polling scheduled (every 5 minutes)");

  // Jump.Finance payment status polling — every minute
  cron.schedule("* * * * *", async () => {
    try {
      const { jumpFinance, JUMP_STATUS } = await import("../jump-finance");
      if (!jumpFinance.isConfigured) return;

      const { getProcessingJumpPayments, updatePaymentJumpData, getAgentById } = await import("../db");
      const processingPayments = await getProcessingJumpPayments();
      if (processingPayments.length === 0) return;

      console.log(`[Jump Cron] Polling ${processingPayments.length} payment(s)...`);

      for (const payment of processingPayments) {
        if (!payment.jumpPaymentId) continue;
        try {
          const { item } = await jumpFinance.getPayment(payment.jumpPaymentId);
          const statusChanged = item.status.id !== payment.jumpStatus;

          await updatePaymentJumpData(payment.id, {
            jumpStatus: item.status.id,
            jumpStatusText: item.status.title,
            jumpAmountPaid: item.amount_paid ? Math.round(item.amount_paid * 100) : undefined,
            jumpCommission: item.commission ? Math.round(item.commission * 100) : undefined,
          });

          // Handle final statuses
          if (item.is_final && statusChanged) {
            const agent = await getAgentById(payment.agentId);
            const { notifyAgent } = await import("../telegram-bot-webhook");
            const amountRub = (payment.amount / 100).toLocaleString("ru-RU");

            if (item.status.id === JUMP_STATUS.PAID) {
              await updatePaymentJumpData(payment.id, { status: "completed" });
              // Balance formula (totalEarnings - completedSum - pendingSum)
              // already accounts for completed payments — no deduction needed
              if (agent?.telegramId) {
                await notifyAgent(agent.telegramId, `✅ <b>Выплата ${amountRub} ₽ зачислена!</b>\n\nДеньги поступили на ваш счёт.`);
              }
            } else if (item.status.id === JUMP_STATUS.REJECTED) {
              await updatePaymentJumpData(payment.id, { status: "failed" });
              if (agent?.telegramId) {
                await notifyAgent(agent.telegramId, `❌ <b>Выплата ${amountRub} ₽ отклонена</b>\n\nПроверьте ваши реквизиты и обратитесь в поддержку.`);
              }
            } else if (item.status.id === JUMP_STATUS.DELETED) {
              await updatePaymentJumpData(payment.id, { status: "failed" });
            }
          }

          // Notify about awaiting signature (non-final)
          if (item.status.id === JUMP_STATUS.AWAITING_SIGNATURE && statusChanged) {
            const agent = await getAgentById(payment.agentId);
            if (agent?.telegramId) {
              const { notifyAgent } = await import("../telegram-bot-webhook");
              await notifyAgent(agent.telegramId, `📝 <b>Подпишите документы</b>\n\nДля завершения выплаты необходимо подписать акт в Jump.Finance.`);
            }
          }

          // Notify admin about errors
          if (item.status.id === JUMP_STATUS.ERROR && statusChanged) {
            const { ENV: envConfig } = await import("./env");
            if (envConfig.adminTelegramId) {
              const agent = await getAgentById(payment.agentId);
              const { notifyAgent } = await import("../telegram-bot-webhook");
              await notifyAgent(envConfig.adminTelegramId, `⚠️ <b>Ошибка выплаты Jump</b>\n\nАгент: ${agent?.fullName || payment.agentId}\nСумма: ${(payment.amount / 100).toLocaleString("ru-RU")} ₽\nJump ID: ${payment.jumpPaymentId}`);
            }
          }
        } catch (err) {
          console.error(`[Jump Cron] Failed to poll payment ${payment.id}:`, err);
        }
      }
    } catch (error) {
      console.error("[Jump Cron] Poll failed:", error);
    }
  });
  if (process.env.JUMP_FINANCE_API_KEY) {
    console.log("[Cron] Jump.Finance payment polling scheduled (every minute)");
  }

  // Jump.Finance identification status polling — every 10 minutes
  cron.schedule("*/10 * * * *", async () => {
    try {
      const { jumpFinance } = await import("../jump-finance");
      if (!jumpFinance.isConfigured) return;

      const { getPendingJumpVerificationAgents, updateAgentJumpData } = await import("../db");
      const pendingAgents = await getPendingJumpVerificationAgents();
      if (pendingAgents.length === 0) return;

      for (const agent of pendingAgents) {
        if (!agent.jumpContractorId) continue;
        try {
          const result = await jumpFinance.getIdentificationStatus(agent.jumpContractorId);
          if (result.item.status === "approved") {
            await updateAgentJumpData(agent.id, { jumpIdentified: true });
            console.log(`[Jump Cron] Agent ${agent.id} verified successfully`);
          }
        } catch (err) {
          // Ignore errors for individual agents (may not have identification yet)
        }
      }
    } catch (error) {
      console.error("[Jump Cron] Identification poll failed:", error);
    }
  });

  // Referral bonus unlock check — every hour
  cron.schedule("0 * * * *", async () => {
    try {
      const { getDb, unlockBonusToEarnings } = await import("../db");
      const { agents: agentsTable } = await import("../../drizzle/schema");
      const { gt } = await import("drizzle-orm");

      const database = await getDb();
      if (!database) return;

      // Find agents with pending bonus points
      const agentsWithBonus = await database.select()
        .from(agentsTable)
        .where(gt(agentsTable.bonusPoints, 0));

      if (agentsWithBonus.length === 0) return;
      console.log(`[Bonus Cron] Checking ${agentsWithBonus.length} agent(s) with pending bonus...`);

      for (const agent of agentsWithBonus) {
        try {
          const unlocked = await unlockBonusToEarnings(agent.id);
          if (unlocked && agent.telegramId) {
            const { notifyAgent } = await import("../telegram-bot-webhook");
            const bonusRub = ((agent.bonusPoints || 0) / 100).toLocaleString("ru-RU");
            await notifyAgent(
              agent.telegramId,
              `🎉 <b>Бонус разблокирован!</b>\n\n` +
              `Ваш реферальный бонус ${bonusRub} ₽ добавлен к балансу.\n` +
              `Поздравляем — вы рекомендовали 10+ пациентов с оплатой!`
            );
          }
        } catch (err) {
          console.error(`[Bonus Cron] Error for agent ${agent.id}:`, err);
        }
      }
    } catch (error) {
      console.error("[Bonus Cron] Failed:", error);
    }
  });
  console.log("[Cron] Referral bonus unlock check scheduled (every hour)");
}

startServer().catch(console.error);
