import crypto from "crypto";
import { Request, Response } from "express";
import * as db from "./db";
import { SignJWT } from "jose";
import { AGENT_COOKIE_NAME } from "@shared/const";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-in-production";

/**
 * Verify Telegram Login Widget data
 * https://core.telegram.org/widgets/login#checking-authorization
 */
function verifyTelegramAuth(data: any): boolean {
  const { hash, ...authData } = data;
  
  // Create data-check-string
  const checkString = Object.keys(authData)
    .sort()
    .map(key => `${key}=${authData[key]}`)
    .join('\n');
  
  // Calculate secret key
  const secretKey = crypto
    .createHash('sha256')
    .update(BOT_TOKEN)
    .digest();
  
  // Calculate hash
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');
  
  return calculatedHash === hash;
}

/**
 * Handle Telegram Login Widget callback
 */
export async function handleTelegramLogin(req: Request, res: Response) {
  try {
    const telegramData = req.body;
    
    // Verify authentication data
    if (!verifyTelegramAuth(telegramData)) {
      return res.status(401).json({ error: "Invalid authentication data" });
    }
    
    const telegramId = String(telegramData.id);

    // Check if user is admin first
    const adminUser = await db.getUserByOpenId(`telegram_${telegramId}`);

    if (adminUser && adminUser.role === 'admin') {
      // Admin login - create admin session
      const secret = new TextEncoder().encode(JWT_SECRET);
      const token = await new SignJWT({
        userId: adminUser.id,
        telegramId: telegramId,
        role: 'admin'
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret);

      res.cookie('agent_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.json({
        success: true,
        role: 'admin',
        user: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
        }
      });
    }

    // Find agent by Telegram ID
    const agent = await db.getAgentByTelegramId(telegramId);

    if (!agent) {
      return res.status(404).json({
        error: "User not found. Please register in the Telegram bot first."
      });
    }

    // Create JWT token for agent
    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT({
      agentId: agent.id,
      telegramId: agent.telegramId,
      role: 'agent'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    // Set cookie
    res.cookie('agent_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.json({
      success: true,
      role: 'agent',
      agent: {
        id: agent.id,
        fullName: agent.fullName,
        email: agent.email,
      }
    });
    
  } catch (error) {
    console.error("[Telegram Login] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Middleware to verify agent session
 */
export async function verifyAgentSession(req: Request): Promise<number | null> {
  try {
    // Check Authorization header first (localStorage approach)
    let token = req.headers.authorization?.replace("Bearer ", "");
    
    // Fallback to cookie (for backward compatibility)
    if (!token) {
      token = req.cookies?.[AGENT_COOKIE_NAME];
    }
    
    if (!token) {
      return null;
    }
    
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    return payload.agentId as number;
    
  } catch (error) {
    console.error("[Agent Session] Verification failed:", error);
    return null;
  }
}
