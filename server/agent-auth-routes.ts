import { AGENT_COOKIE_NAME } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { SignJWT } from "jose";
import { notifyNewDeviceLogin } from "./telegram-notifications";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-in-production";

export function registerAgentAuthRoutes(app: Express) {
  /**
   * POST /api/agent/verify-otp
   * Verify OTP code and set session cookie
   */
  app.post("/api/agent/verify-otp", async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({ error: "Email and code are required" });
      }

      // Verify OTP code
      console.log('[Agent Auth] Verifying OTP:', { email, code });
      const otpRecord = await db.getValidOtpCode(email, code);
      console.log('[Agent Auth] OTP record found:', !!otpRecord);

      if (!otpRecord) {
        console.log('[Agent Auth] OTP verification failed: Invalid or expired code');
        return res.status(401).json({ error: "Invalid or expired code" });
      }

      // Get agent by email
      const agent = await db.getAgentByEmail(email);

      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      // Create JWT token
      const secret = new TextEncoder().encode(JWT_SECRET);
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
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(AGENT_COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      // Create session record in database
      const deviceInfo = req.headers["user-agent"] || null;
      const ipAddress =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
        (req.headers["x-real-ip"] as string) ||
        req.socket.remoteAddress ||
        null;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

      await db.createSession({
        agentId: agent.id,
        sessionToken: token,
        deviceInfo,
        ipAddress,
        loginMethod: "otp",
        lastActivityAt: new Date(),
        expiresAt,
        isRevoked: "no",
      });

      // Mark OTP as used (only after successful verification)
      console.log('[Agent Auth] Marking OTP as used:', otpRecord.id);
      await db.markOtpAsUsed(otpRecord.id);

      // Send notification about new login
      if (agent.telegramId) {
        await notifyNewDeviceLogin(agent.telegramId, {
          deviceInfo,
          ipAddress,
          loginMethod: "otp",
          timestamp: new Date(),
        });
      }

      // Return token to client (localStorage approach)
      return res.json({ token });
    } catch (error) {
      console.error("[Agent Auth] Verify OTP failed:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
}
