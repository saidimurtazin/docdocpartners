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
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(cookieParser());
  // Setup Telegram bot webhook BEFORE other middleware
  const webhookDomain = process.env.WEBHOOK_DOMAIN;
  if (!webhookDomain) {
    console.error('[Server] ERROR: WEBHOOK_DOMAIN environment variable is required!');
    console.error('[Server] Please set WEBHOOK_DOMAIN in Railway Variables');
    console.error('[Server] Example: WEBHOOK_DOMAIN=https://your-app.railway.app');
    throw new Error('WEBHOOK_DOMAIN is required');
  }
  await setupTelegramWebhook(app, '/telegram-webhook', webhookDomain);

  // Debug endpoint — manually trigger email poll and return detailed results
  app.get("/api/debug-poll", async (req, res) => {
    if (req.query.key !== "medigate2025") {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    try {
      const { processNewClinicEmails } = await import("../clinic-report-processor");
      const result = await processNewClinicEmails();
      res.json({ ok: true, result });
    } catch (error: any) {
      res.json({ ok: false, error: error.message, stack: error.stack });
    }
  });

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

      const user = await db.getUserById(session.userId);
      if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

      const act = await db.getPaymentActById(actId);
      if (!act) { res.status(404).json({ error: "Act not found" }); return; }

      // Allow admins or the agent who owns the act
      if (user.role !== "admin") {
        const agent = await db.getAgentByTelegramId(user.openId);
        if (!agent || agent.id !== act.agentId) {
          res.status(403).json({ error: "Forbidden" }); return;
        }
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
}

startServer().catch(console.error);
