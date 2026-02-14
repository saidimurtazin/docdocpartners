import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { verifyAgentSession, type SessionInfo } from "../telegram-login";

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

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Check for agent/admin session
  try {
    session = await verifyAgentSession(opts.req);
    // For backward compatibility, set agentId if it's an agent session
    if (session?.agentId) {
      agentId = session.agentId;
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
