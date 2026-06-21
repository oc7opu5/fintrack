import { z } from "zod";
import { router, protectedProcedure } from "../server";

export const accountRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.account.findMany({
      where: { userId: ctx.session.user.id, isActive: true },
      include: {
        _count: { select: { transactions: true } },
      },
      orderBy: { isDefault: "desc" },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.account.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
        include: {
          transactions: {
            orderBy: { date: "desc" },
            take: 20,
            include: { category: true },
          },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        type: z.enum([
          "BKASH",
          "NAGAD",
          "ROCKET",
          "MOBILE_BANKING",
          "CREDIT_CARD",
          "DEBIT_CARD",
          "BANK_ACCOUNT",
          "CASH",
          "OTHER",
        ]),
        balance: z.number().default(0),
        currency: z.string().default("BDT"),
        icon: z.string().optional(),
        color: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.account.create({
        data: {
          ...input,
          userId: ctx.session.user.id,
          balance: input.balance,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        type: z
          .enum([
            "BKASH",
            "NAGAD",
            "ROCKET",
            "MOBILE_BANKING",
            "CREDIT_CARD",
            "DEBIT_CARD",
            "BANK_ACCOUNT",
            "CASH",
            "OTHER",
          ])
          .optional(),
        balance: z.number().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        notes: z.string().optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.account.update({
        where: { id },
        data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.account.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  netWorth: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await ctx.db.account.findMany({
      where: { userId: ctx.session.user.id, isActive: true },
      select: { type: true, balance: true },
    });

    const totalAssets = accounts
      .filter((a) => !["CREDIT_CARD"].includes(a.type))
      .reduce((sum, a) => sum + Number(a.balance), 0);

    const totalLiabilities = accounts
      .filter((a) => a.type === "CREDIT_CARD")
      .reduce((sum, a) => sum + Number(a.balance), 0);

    return {
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
    };
  }),
});
