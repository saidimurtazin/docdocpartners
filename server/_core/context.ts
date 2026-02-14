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
      agentId = session.agentId;
    }
    // If session has admin role, load user from database
    if (session?.role === "admin" && session.userId) {
      const { getUserById } = await import("../db");
      const adminUser = await getUserById(session.userId);
      if (adminUser) {
        user = adminUser;
      }
    }
  } catch (error) {
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
