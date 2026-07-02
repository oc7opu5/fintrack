import { z } from "zod";
import { router, protectedProcedure } from "../server";
import { generateInsights } from "@/lib/insights";

export const insightRouter = router({
  list: protectedProcedure
    .input(z.object({ unreadOnly: z.boolean().default(false) }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.insight.findMany({
        where: {
          userId: ctx.session.user.id,
          ...(input?.unreadOnly ? { isRead: false } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insight.update({
        where: { id: input.id, userId: ctx.session.user.id },
        data: { isRead: true },
      });
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.insight.updateMany({
      where: { userId: ctx.session.user.id, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }),

  generate: protectedProcedure.mutation(async ({ ctx }) => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [
      accounts,
      thisMonthIncome,
      thisMonthExpense,
      lastMonthExpense,
      lastMonthIncome,
      transactions,
      activeDebts,
      subscriptions,
    ] = await Promise.all([
      ctx.db.account.findMany({ where: { userId: ctx.session.user.id, isActive: true }, select: { balance: true } }),
      ctx.db.transaction.aggregate({ where: { userId: ctx.session.user.id, type: "INCOME", date: { gte: thisMonthStart, lte: thisMonthEnd } }, _sum: { amount: true } }),
      ctx.db.transaction.aggregate({ where: { userId: ctx.session.user.id, type: "EXPENSE", date: { gte: thisMonthStart, lte: thisMonthEnd } }, _sum: { amount: true } }),
      ctx.db.transaction.aggregate({ where: { userId: ctx.session.user.id, type: "EXPENSE", date: { gte: lastMonthStart, lte: lastMonthEnd } }, _sum: { amount: true } }),
      ctx.db.transaction.aggregate({ where: { userId: ctx.session.user.id, type: "INCOME", date: { gte: lastMonthStart, lte: lastMonthEnd } }, _sum: { amount: true } }),
      ctx.db.transaction.findMany({
        where: { userId: ctx.session.user.id, type: "EXPENSE", date: { gte: thisMonthStart, lte: thisMonthEnd } },
        include: { category: { select: { name: true } } },
      }),
      ctx.db.debt.findMany({ where: { userId: ctx.session.user.id, status: "ACTIVE" } }),
      ctx.db.subscription.findMany({ where: { userId: ctx.session.user.id, status: "ACTIVE" }, select: { amount: true, billingCycle: true } }),
    ]);

    const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
    const monthlyInc = Number(thisMonthIncome._sum.amount || 0);
    const monthlyExp = Number(thisMonthExpense._sum.amount || 0);
    const prevMonthExp = lastMonthExpense._sum.amount ? Number(lastMonthExpense._sum.amount) : undefined;
    const prevMonthInc = lastMonthIncome._sum.amount ? Number(lastMonthIncome._sum.amount) : undefined;

    // Category breakdown
    const categoryMap: Record<string, number> = {};
    for (const t of transactions) {
      const cat = t.category?.name || "Other";
      categoryMap[cat] = (categoryMap[cat] || 0) + Number(t.amount);
    }

    const categoryBreakdown = Object.entries(categoryMap)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: monthlyExp > 0 ? Math.round((amount / monthlyExp) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const totalDebt = activeDebts.reduce((s, d) => s + Number(d.outstandingAmount), 0);
    const monthlyDebtPayments = activeDebts.reduce((s, d) => s + Number(d.monthlyDue || 0), 0);

    const subMonthlyCost = subscriptions.reduce((s, sub) => {
      if (sub.billingCycle === "YEARLY") return s + Number(sub.amount) / 12;
      if (sub.billingCycle === "QUARTERLY") return s + Number(sub.amount) / 3;
      return s + Number(sub.amount);
    }, 0);

    const snapshot = {
      monthlyIncome: monthlyInc,
      monthlyExpense: monthlyExp,
      totalBalance,
      totalDebt,
      monthlyDebtPayments,
      categoryBreakdown,
      subscriptionCost: Math.round(subMonthlyCost),
      previousMonthExpense: prevMonthExp,
      previousMonthIncome: prevMonthInc,
    };

    const insights = generateInsights(snapshot);

    // Delete old insights and save new ones
    await ctx.db.insight.deleteMany({ where: { userId: ctx.session.user.id } });

    const created = await Promise.all(
      insights.map(i =>
        ctx.db.insight.create({
          data: {
            userId: ctx.session.user.id,
            type: i.type,
            title: i.title,
            content: i.content,
            severity: i.severity,
            metadata: i.metadata as any,
          },
        })
      )
    );

    return { insights: created, snapshot };
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.insight.count({ where: { userId: ctx.session.user.id, isRead: false } });
  }),
});
