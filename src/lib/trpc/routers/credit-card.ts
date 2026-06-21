import { z } from "zod";
import { router, protectedProcedure } from "../server";

export const creditCardRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.creditCard.findMany({
      where: { userId: ctx.session.user.id, isActive: true },
      include: {
        loans: { where: { status: "ACTIVE" } },
        _count: { select: { transactions: true } },
      },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.creditCard.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
        include: {
          loans: {
            include: {
              installments: { orderBy: { installmentNo: "asc" } },
            },
          },
          payments: { orderBy: { paymentDate: "desc" }, take: 10 },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        creditLimit: z.number().positive(),
        interestRate: z.number().optional(),
        billingDay: z.number().min(1).max(31).optional(),
        dueDay: z.number().min(1).max(31).optional(),
        lastFourDigits: z.string().optional(),
        cardType: z.string().optional(),
        color: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.creditCard.create({
        data: {
          ...input,
          userId: ctx.session.user.id,
          availableCredit: input.creditLimit,
          creditLimit: input.creditLimit,
        },
      });
    }),

  recordPayment: protectedProcedure
    .input(
      z.object({
        creditCardId: z.string(),
        amount: z.number().positive(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx) => {
        const payment = await tx.creditCardPayment.create({
          data: {
            creditCardId: input.creditCardId,
            amount: input.amount,
            notes: input.notes,
          },
        });

        await tx.creditCard.update({
          where: { id: input.creditCardId },
          data: {
            currentBalance: { decrement: input.amount },
            availableCredit: { increment: input.amount },
          },
        });

        return payment;
      });
    }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    const cards = await ctx.db.creditCard.findMany({
      where: { userId: ctx.session.user.id, isActive: true },
      select: {
        name: true,
        currentBalance: true,
        creditLimit: true,
        availableCredit: true,
      },
    });

    return {
      cards,
      totalBalance: cards.reduce(
        (s, c) => s + Number(c.currentBalance),
        0
      ),
      totalLimit: cards.reduce((s, c) => s + Number(c.creditLimit), 0),
      totalAvailable: cards.reduce(
        (s, c) => s + Number(c.availableCredit),
        0
      ),
    };
  }),
});
