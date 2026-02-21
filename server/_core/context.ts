import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { verifyAgentSessionFromRequest, type SessionInfo } from "../agent-session";
import { AGENT_COOKIE_NAME } from "@shared/const";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  agentId: number | null;
  session: SessionInfo | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let agentId: number | null = null;
  let session: SessionInfo | null = null;

  // Check for agent/admin session
  try {
    session = await verifyAgentSessionFromRequest(opts.req);

    // Verify session exists in DB and is not revoked
    if (session) {
      const rawToken = opts.req.cookies?.[AGENT_COOKIE_NAME];
      if (rawToken) {
        const { getSessionByToken } = await import("../db");
        const dbSession = await getSessionByToken(rawToken);
        if (!dbSession) {
          // Session revoked or not found in DB — invalidate
          session = null;
        }
      }
    }

    // For backward compatibility, set agentId if it's an agent session
    if (session?.agentId) {
      agentId = session.agentId;
    }
    // If session has staff role (admin/support/accountant), load user from database
    const staffRoles = ["admin", "support", "accountant"];
    if (session?.role && staffRoles.includes(session.role) && session.userId) {
      const { getUserById } = await import("../db");
      const staffUser = await getUserById(session.userId);
      if (staffUser) {
        user = staffUser;
      }
    }
  } catch (error) {
    console.error("[Context] Session verification error");
    session = null;
    agentId = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    agentId,
    session,
  };
}
