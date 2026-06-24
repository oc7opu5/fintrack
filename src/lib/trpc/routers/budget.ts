import { z } from "zod";
import { router, protectedProcedure } from "../server";

export const budgetRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    return ctx.db.budget.findMany({
      where: {
        userId: ctx.session.user.id,
        isActive: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
  }),

  overview: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const budgets = await ctx.db.budget.findMany({
      where: {
        userId: ctx.session.user.id,
        isActive: true,
        period: "MONTHLY",
        startDate: { lte: endOfMonth },
        OR: [{ endDate: null }, { endDate: { gte: startOfMonth } }],
      },
      include: { category: true },
    });

    const overview = await Promise.all(
      budgets.map(async (budget) => {
        if (!budget.categoryId) {
          return {
            ...budget,
            actualSpent: 0,
            percentage: 0,
            remaining: Number(budget.amount),
            isOverBudget: false,
            isNearLimit: false,
          };
        }

        const result = await ctx.db.transaction.aggregate({
          where: {
            userId: ctx.session.user.id,
            type: "EXPENSE",
            categoryId: budget.categoryId,
            date: { gte: startOfMonth, lte: endOfMonth },
          },
          _sum: { amount: true },
        });

        const actualSpent = Number(result._sum.amount || 0);
        const percentage =
          Number(budget.amount) > 0
            ? (actualSpent / Number(budget.amount)) * 100
            : 0;

        return {
          ...budget,
          actualSpent,
          percentage,
          remaining: Number(budget.amount) - actualSpent,
          isOverBudget: actualSpent > Number(budget.amount),
          isNearLimit: percentage >= (budget.alertAt || 80),
        };
      })
    );

    const totalBudget = overview.reduce(
      (s, b) => s + Number(b.amount),
      0
    );
    const totalSpent = overview.reduce((s, b) => s + b.actualSpent, 0);

    return {
      budgets: overview,
      totalBudget,
      totalSpent,
      totalRemaining: totalBudget - totalSpent,
    };
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        amount: z.number().positive(),
        categoryId: z.string().optional(),
        period: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).default("MONTHLY"),
        startDate: z.coerce.date(),
        endDate: z.coerce.date().optional(),
        alertAt: z.number().min(1).max(100).default(80),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.budget.create({
        data: { ...input, userId: ctx.session.user.id, amount: input.amount },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        amount: z.number().optional(),
        alertAt: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.budget.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.budget.delete({ where: { id: input.id } });
    }),
});
