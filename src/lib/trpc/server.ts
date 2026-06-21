import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function createTRPCContext() {
  const session = await auth();

  return {
    db,
    session,
  };
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.code === "BAD_REQUEST" && error.cause instanceof Error
            ? error.cause.message
            : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
      db: ctx.db,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceAuth);
