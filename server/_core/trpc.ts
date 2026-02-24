import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

// Requires authenticated agent (checks ctx.agentId from JWT)
export const agentProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.agentId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Войдите в личный кабинет" });
    }

    return next({
      ctx: {
        ...ctx,
        agentId: ctx.agentId,
      },
    });
  }),
);

// Requires authenticated clinic user (checks ctx.user.role === "clinic")
export const clinicProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "clinic" || !ctx.user.clinicId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Войдите как клиника" });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        clinicId: ctx.user.clinicId,
      },
    });
  }),
);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
