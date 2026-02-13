/**
 * Agent Session Management
 * Handles Telegram OTP-based authentication for agent cabinet
 */

import { SignJWT, jwtVerify } from 'jose';
import { ENV } from './_core/env';

const JWT_SECRET = new TextEncoder().encode(ENV.cookieSecret);
const SESSION_DURATION = 30 * 24 * 60 * 60; // 30 days in seconds

export interface AgentSession {
  telegramId: string;
  agentId: string;
  email: string;
  fullName: string;
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
  
  return sessionCookie.split('=')[1];
}
