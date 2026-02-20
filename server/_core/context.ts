import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { verifyAgentSessionFromRequest, type SessionInfo } from "../agent-session";

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

    // For backward compatibility, set agentId if it's an agent session
    if (session?.agentId) {
      // Verify agent is still active in the database
      const { getAgentById } = await import("../db");
      const agent = await getAgentById(session.agentId);
      if (agent && agent.status === "active") {
        agentId = session.agentId;
      } else {
        // Agent is blocked/deleted/pending — invalidate session
        session = null;
        agentId = null;
      }
    }
    // If session has staff role (admin/support/accountant), load user from database
    const staffRoles = ["admin", "support", "accountant"];
    if (session?.role && staffRoles.includes(session.role) && session.userId) {
      const { getUserById } = await import("../db");
      const staffUser = await getUserById(session.userId);
      if (staffUser) {
        user = staffUser;
      } else {
        // Staff user no longer exists — invalidate session
        session = null;
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
