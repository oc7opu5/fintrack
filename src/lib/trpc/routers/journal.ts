import { z } from "zod";
import { router, protectedProcedure } from "../server";

export const journalRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().default(20), offset: z.number().default(0) }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.journalEntry.findMany({
        where: { userId: ctx.session.user.id },
        orderBy: { createdAt: "desc" },
        take: input?.limit || 20,
        skip: input?.offset || 0,
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.journalEntry.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      rawText: z.string().min(1),
      extractedTxs: z.any().optional(),
      summary: z.string().optional(),
      sentiment: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.journalEntry.create({
        data: {
          userId: ctx.session.user.id,
          rawText: input.rawText,
          extractedTxs: input.extractedTxs || null,
          summary: input.summary || null,
          sentiment: input.sentiment || null,
          tags: input.tags || [],
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      rawText: z.string().optional(),
      extractedTxs: z.any().optional(),
      summary: z.string().optional(),
      sentiment: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.journalEntry.update({ where: { id, userId: ctx.session.user.id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.journalEntry.delete({ where: { id: input.id, userId: ctx.session.user.id } });
      return { success: true };
    }),

  // Get daily/weekly/monthly summaries
  summary: protectedProcedure
    .input(z.object({
      period: z.enum(["daily", "weekly", "monthly"]).default("monthly"),
    }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      let startDate: Date;

      if (input.period === "daily") {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (input.period === "weekly") {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const entries = await ctx.db.journalEntry.findMany({
        where: { userId: ctx.session.user.id, createdAt: { gte: startDate } },
        orderBy: { createdAt: "desc" },
      });

      // Get transactions for the same period
      const transactions = await ctx.db.transaction.findMany({
        where: { userId: ctx.session.user.id, date: { gte: startDate } },
        include: { category: { select: { name: true } } },
        orderBy: { date: "desc" },
      });

      const income = transactions.filter(t => t.type === "INCOME").reduce((s, t) => s + Number(t.amount), 0);
      const expense = transactions.filter(t => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0);

      // Category breakdown
      const categoryMap: Record<string, number> = {};
      for (const t of transactions.filter(t => t.type === "EXPENSE")) {
        const cat = t.category?.name || "Other";
        categoryMap[cat] = (categoryMap[cat] || 0) + Number(t.amount);
      }

      const categories = Object.entries(categoryMap)
        .map(([name, amount]) => ({ name, amount, percentage: expense > 0 ? Math.round((amount / expense) * 100) : 0 }))
        .sort((a, b) => b.amount - a.amount);

      return {
        period: input.period,
        startDate,
        entryCount: entries.length,
        transactionCount: transactions.length,
        income,
        expense,
        net: income - expense,
        categories,
        entries: entries.slice(0, 10),
      };
    }),
});
