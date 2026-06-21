import { z } from "zod";
import { router, protectedProcedure } from "../server";

export const transactionRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        accountId: z.string().optional(),
        categoryId: z.string().optional(),
        type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        search: z.string().optional(),
        minAmount: z.number().optional(),
        maxAmount: z.number().optional(),
        page: z.number().default(1),
        limit: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const {
        accountId,
        categoryId,
        type,
        dateFrom,
        dateTo,
        search,
        minAmount,
        maxAmount,
        page,
        limit,
      } = input;

      const where: any = {
        userId: ctx.session.user.id,
        ...(accountId && { accountId }),
        ...(categoryId && { categoryId }),
        ...(type && { type }),
        ...(search && {
          description: { contains: search, mode: "insensitive" },
        }),
        ...(minAmount && { amount: { gte: minAmount } }),
        ...(maxAmount && { amount: { lte: maxAmount } }),
        ...(dateFrom &&
          dateTo && {
            date: { gte: dateFrom, lte: dateTo },
          }),
      };

      const [transactions, total] = await Promise.all([
        ctx.db.transaction.findMany({
          where,
          include: { category: true, account: true, tags: true },
          orderBy: { date: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        ctx.db.transaction.count({ where }),
      ]);

      return {
        transactions,
        total,
        pages: Math.ceil(total / limit),
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.transaction.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
        include: {
          category: true,
          account: true,
          tags: true,
          creditCard: true,
          subscription: true,
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        categoryId: z.string().optional(),
        type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
        amount: z.number().positive(),
        description: z.string().min(1),
        note: z.string().optional(),
        date: z.date().default(() => new Date()),
        creditCardId: z.string().optional(),
        subscriptionId: z.string().optional(),
        tagIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tagIds, ...data } = input;

      return ctx.db.$transaction(async (tx) => {
        const transaction = await tx.transaction.create({
          data: {
            ...data,
            userId: ctx.session.user.id,
            amount: data.amount,
            ...(tagIds && {
              tags: {
                connect: tagIds.map((id) => ({ id })),
              },
            }),
          },
        });

        // Update account balance
        const balanceChange =
          data.type === "INCOME" ? data.amount : -data.amount;

        await tx.account.update({
          where: { id: data.accountId },
          data: { balance: { increment: balanceChange } },
        });

        // Update budget if category exists
        if (data.categoryId && data.type === "EXPENSE") {
          await tx.budget.updateMany({
            where: {
              userId: ctx.session.user.id,
              categoryId: data.categoryId,
              isActive: true,
              startDate: { lte: data.date },
              OR: [{ endDate: null }, { endDate: { gte: data.date } }],
            },
            data: { spent: { increment: data.amount } },
          });
        }

        return transaction;
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        accountId: z.string().optional(),
        categoryId: z.string().optional(),
        type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
        amount: z.number().positive().optional(),
        description: z.string().min(1).optional(),
        note: z.string().optional(),
        date: z.date().optional(),
        tagIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, tagIds, ...data } = input;

      return ctx.db.$transaction(async (tx) => {
        const existing = await tx.transaction.findFirst({
          where: { id, userId: ctx.session.user.id },
        });

        if (!existing) {
          throw new Error("Transaction not found");
        }

        // Reverse old balance effect
        const oldEffect =
          existing.type === "INCOME"
            ? -Number(existing.amount)
            : Number(existing.amount);
        await tx.account.update({
          where: { id: existing.accountId },
          data: { balance: { increment: oldEffect } },
        });

        // Apply new balance effect
        const newType = data.type || existing.type;
        const newAmount = data.amount || Number(existing.amount);
        const newEffect = newType === "INCOME" ? newAmount : -newAmount;
        const newAccountId = data.accountId || existing.accountId;

        await tx.account.update({
          where: { id: newAccountId },
          data: { balance: { increment: newEffect } },
        });

        return tx.transaction.update({
          where: { id },
          data: {
            ...data,
            amount: data.amount,
            ...(tagIds && {
              tags: {
                set: tagIds.map((id) => ({ id })),
              },
            }),
          },
        });
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx) => {
        const existing = await tx.transaction.findFirst({
          where: { id: input.id, userId: ctx.session.user.id },
        });

        if (!existing) {
          throw new Error("Transaction not found");
        }

        // Reverse balance
        const balanceEffect =
          existing.type === "INCOME"
            ? -Number(existing.amount)
            : Number(existing.amount);
        await tx.account.update({
          where: { id: existing.accountId },
          data: { balance: { increment: balanceEffect } },
        });

        return tx.transaction.delete({ where: { id: input.id } });
      });
    }),

  todaySummary: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [income, expense] = await Promise.all([
      ctx.db.transaction.aggregate({
        where: {
          userId: ctx.session.user.id,
          type: "INCOME",
          date: { gte: today, lt: tomorrow },
        },
        _sum: { amount: true },
        _count: true,
      }),
      ctx.db.transaction.aggregate({
        where: {
          userId: ctx.session.user.id,
          type: "EXPENSE",
          date: { gte: today, lt: tomorrow },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      income: Number(income._sum.amount || 0),
      incomeCount: income._count,
      expense: Number(expense._sum.amount || 0),
      expenseCount: expense._count,
      net:
        Number(income._sum.amount || 0) - Number(expense._sum.amount || 0),
    };
  }),

  monthlySummary: protectedProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      })
    )
    .query(async ({ ctx, input }) => {
      const start = new Date(input.year, input.month - 1, 1);
      const end = new Date(input.year, input.month, 0, 23, 59, 59);

      const [income, expense] = await Promise.all([
        ctx.db.transaction.aggregate({
          where: {
            userId: ctx.session.user.id,
            type: "INCOME",
            date: { gte: start, lte: end },
          },
          _sum: { amount: true },
          _count: true,
        }),
        ctx.db.transaction.aggregate({
          where: {
            userId: ctx.session.user.id,
            type: "EXPENSE",
            date: { gte: start, lte: end },
          },
          _sum: { amount: true },
          _count: true,
        }),
      ]);

      return {
        income: Number(income._sum.amount || 0),
        incomeCount: income._count,
        expense: Number(expense._sum.amount || 0),
        expenseCount: expense._count,
        savings:
          Number(income._sum.amount || 0) - Number(expense._sum.amount || 0),
      };
    }),
});
