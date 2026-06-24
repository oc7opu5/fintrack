import { z } from "zod";
import { router, protectedProcedure } from "../server";

export const subscriptionRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: z
            .enum(["ACTIVE", "PAUSED", "CANCELLED", "LIFETIME", "ALL"])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const status = input?.status;
      return ctx.db.subscription.findMany({
        where: {
          userId: ctx.session.user.id,
          ...(status &&
            status !== "ALL" && {
              status: status as any,
            }),
        },
        orderBy: { nextBillingDate: "asc" },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.subscription.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
        include: { transactions: { orderBy: { date: "desc" }, take: 12 } },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        amount: z.number().positive(),
        billingCycle: z.enum([
          "MONTHLY",
          "YEARLY",
          "QUARTERLY",
          "WEEKLY",
          "LIFETIME",
        ]),
        description: z.string().optional(),
        category: z.string().optional(),
        website: z.string().optional(),
        startDate: z.coerce.date(),
        status: z
          .enum(["ACTIVE", "PAUSED", "CANCELLED", "LIFETIME"])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const isLifetime = input.billingCycle === "LIFETIME";
      return ctx.db.subscription.create({
        data: {
          ...input,
          userId: ctx.session.user.id,
          isLifetimeDeal: isLifetime,
          status: isLifetime ? "LIFETIME" : "ACTIVE",
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        amount: z.number().optional(),
        status: z
          .enum(["ACTIVE", "PAUSED", "CANCELLED", "LIFETIME"])
          .optional(),
        autoRenew: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.subscription.update({ where: { id }, data });
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.subscription.update({
        where: { id: input.id },
        data: { status: "CANCELLED", autoRenew: false },
      });
    }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    const subs = await ctx.db.subscription.findMany({
      where: {
        userId: ctx.session.user.id,
        status: { in: ["ACTIVE", "LIFETIME"] },
      },
    });

    const monthlyCost = subs
      .filter((s) => s.status !== "LIFETIME")
      .reduce((sum, s) => {
        switch (s.billingCycle) {
          case "YEARLY":
            return sum + Number(s.amount) / 12;
          case "QUARTERLY":
            return sum + Number(s.amount) / 3;
          case "WEEKLY":
            return sum + Number(s.amount) * 4.33;
          default:
            return sum + Number(s.amount);
        }
      }, 0);

    return {
      totalActive: subs.filter((s) => s.status === "ACTIVE").length,
      totalLifetime: subs.filter((s) => s.status === "LIFETIME").length,
      monthlyEquivalent: monthlyCost,
      yearlyCost: monthlyCost * 12,
    };
  }),
});
