/**
 * Agent Session Management
 * Handles Telegram OTP-based authentication for agent cabinet
 */

import { SignJWT, jwtVerify } from 'jose';
import { ENV } from './_core/env';
import type { Request } from 'express';
import { AGENT_COOKIE_NAME } from '@shared/const';

const JWT_SECRET = new TextEncoder().encode(ENV.cookieSecret);
const SESSION_DURATION = 30 * 24 * 60 * 60; // 30 days in seconds

export interface AgentSession {
  telegramId: string;
  agentId: string;
  email: string;
  fullName: string;
}

export interface SessionInfo {
  role: "admin" | "support" | "accountant" | "agent" | "clinic";
  userId?: number;
  agentId?: number;
  email?: string;
  telegramId?: string;
}

/**
 * Create JWT token for agent session
 */
export async function createAgentSession(session: AgentSession): Promise<string> {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(JWT_SECRET);
  
  return token;
}

/**
 * Verify and decode agent session token
 */
export async function verifyAgentSession(token: string): Promise<AgentSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AgentSession;
  } catch (error) {
    return null;
  }
}

/**
 * Extract session from cookie header
 */
export function getAgentSessionFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => c.startsWith('agent_session='));

  if (!sessionCookie) return null;

  return sessionCookie.substring(sessionCookie.indexOf('=') + 1);
}

/**
 * Verify session from Express request
 * Extracts token from cookie and verifies it
 */
export async function verifyAgentSessionFromRequest(req: Request): Promise<SessionInfo | null> {
  try {
    // Extract token from cookie header
    const cookieHeader = req.headers.cookie || null;
    if (!cookieHeader) {
      return null;
    }

    // Parse cookies manually
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const sessionCookie = cookies.find(c => c.startsWith(`${AGENT_COOKIE_NAME}=`));

    if (!sessionCookie) {
      return null;
    }

    const token = sessionCookie.substring(sessionCookie.indexOf('=') + 1);
    if (!token) {
      return null;
    }

    // Verify and decode JWT
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Return SessionInfo structure
    return {
      role: (payload.role as "admin" | "agent" | "clinic") || "agent",
      userId: payload.userId as number | undefined,
      agentId: payload.agentId as number | undefined,
      email: payload.email as string | undefined,
      telegramId: payload.telegramId as string | undefined,
    };
  } catch (error) {
    return null;
  }
}
