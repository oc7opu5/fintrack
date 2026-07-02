import { z } from "zod";
import { router, protectedProcedure } from "../server";
import {
  calculateReducingBalance,
  calculateStaticBalance,
  calculateCreditCardDues,
  formatDebtOutput,
  getPaydownStrategy,
} from "@/lib/debt-engine";

export const debtRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.debt.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        installments: { orderBy: { installmentNo: "asc" } },
        payments: { orderBy: { paymentDate: "desc" }, take: 5 },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.debt.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
        include: {
          installments: { orderBy: { installmentNo: "asc" } },
          payments: { orderBy: { paymentDate: "desc" } },
        },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      type: z.enum(["credit_card", "personal_loan", "installment", "informal"]),
      calculationMode: z.enum(["reducing_balance", "static"]).default("reducing_balance"),
      principalAmount: z.number().positive(),
      interestRate: z.number().min(0),
      tenure: z.number().positive().optional(),
      fixedEMI: z.number().positive().optional(),
      startDate: z.coerce.date(),
      dueDay: z.number().min(1).max(31).optional(),
      creditLimit: z.number().positive().optional(),
      lastFourDigits: z.string().optional(),
      lenderName: z.string().optional(),
      color: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenure = input.tenure || 12;
      const calc = input.calculationMode === "static"
        ? calculateStaticBalance({
            name: input.name,
            type: input.type,
            calculationMode: input.calculationMode,
            principalAmount: input.principalAmount,
            interestRate: input.interestRate,
            tenure,
            startDate: input.startDate,
            fixedEMI: input.fixedEMI,
          })
        : calculateReducingBalance({
            name: input.name,
            type: input.type,
            calculationMode: input.calculationMode,
            principalAmount: input.principalAmount,
            interestRate: input.interestRate,
            tenure,
            startDate: input.startDate,
          });

      return ctx.db.$transaction(async (tx) => {
        const debt = await tx.debt.create({
          data: {
            userId: ctx.session.user.id,
            name: input.name,
            type: input.type,
            calculationMode: input.calculationMode,
            principalAmount: input.principalAmount,
            outstandingAmount: input.principalAmount,
            interestRate: input.interestRate,
            tenure: input.tenure,
            fixedEMI: input.fixedEMI ? input.fixedEMI : calc.monthlyDue,
            monthlyDue: calc.monthlyDue,
            interestPortion: calc.interestPortion,
            startDate: input.startDate,
            endDate: calc.endDate,
            dueDay: input.dueDay,
            creditLimit: input.creditLimit,
            lastFourDigits: input.lastFourDigits,
            lenderName: input.lenderName,
            color: input.color,
            notes: input.notes,
          },
        });

        await tx.debtInstallment.createMany({
          data: calc.schedule.map(inst => ({
            debtId: debt.id,
            ...inst,
          })),
        });

        return { debt, schedule: calc.schedule, summary: formatDebtOutput(input.name, calc) };
      });
    }),

  payInstallment: protectedProcedure
    .input(z.object({
      debtId: z.string(),
      installmentNo: z.number(),
      amount: z.number().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx) => {
        const installment = await tx.debtInstallment.findFirst({
          where: { debtId: input.debtId, installmentNo: input.installmentNo },
        });

        if (!installment || installment.status === "PAID") {
          throw new Error("Invalid installment");
        }

        const amount = input.amount || Number(installment.totalPayment);

        await tx.debtInstallment.update({
          where: { id: installment.id },
          data: { status: "PAID", paidDate: new Date() },
        });

        await tx.debtPayment.create({
          data: { debtId: input.debtId, amount, paymentDate: new Date() },
        });

        const debt = await tx.debt.findUnique({ where: { id: input.debtId } });
        const newOutstanding = Math.max(0, Number(debt?.outstandingAmount || 0) - amount);

        await tx.debt.update({
          where: { id: input.debtId },
          data: {
            outstandingAmount: newOutstanding,
            status: newOutstanding <= 0 ? "PAID_OFF" : "ACTIVE",
          },
        });

        return {
          success: true,
          paid: amount,
          remaining: newOutstanding,
          notes: `Pay: ${formatBDT(amount)} this month. Interest portion: ${formatBDT(Number(installment.interestPortion))}. Remaining: ${formatBDT(newOutstanding)} after payment.`,
        };
      });
    }),

  calculateDues: protectedProcedure
    .input(z.object({ debtId: z.string() }))
    .query(async ({ ctx, input }) => {
      const debt = await ctx.db.debt.findFirst({
        where: { id: input.debtId, userId: ctx.session.user.id },
      });

      if (!debt) throw new Error("Debt not found");

      const balance = Number(debt.outstandingAmount);
      const limit = Number(debt.creditLimit || 0);
      const rate = Number(debt.interestRate);

      if (debt.type === "credit_card" && limit > 0) {
        return calculateCreditCardDues(balance, limit, rate);
      }

      return {
        monthlyDue: Number(debt.monthlyDue || 0),
        interestPortion: Number(debt.interestPortion || 0),
        minimumPayment: Number(debt.monthlyDue || 0),
        utilization: limit > 0 ? (balance / limit) * 100 : 0,
        warning: null,
      };
    }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    const debts = await ctx.db.debt.findMany({
      where: { userId: ctx.session.user.id, status: "ACTIVE" },
    });

    const totalOutstanding = debts.reduce((s, d) => s + Number(d.outstandingAmount), 0);
    const totalMonthlyDue = debts.reduce((s, d) => s + Number(d.monthlyDue || 0), 0);
    const totalInterestPortion = debts.reduce((s, d) => s + Number(d.interestPortion || 0), 0);

    const debtData = debts.map(d => ({
      name: d.name,
      outstanding: Number(d.outstandingAmount),
      interestRate: Number(d.interestRate),
      monthlyDue: Number(d.monthlyDue || 0),
    }));

    const strategy = getPaydownStrategy(debtData);

    return {
      totalOutstanding,
      totalMonthlyDue,
      totalInterestPortion,
      debtCount: debts.length,
      byType: {
        credit_card: debts.filter(d => d.type === "credit_card").reduce((s, d) => s + Number(d.outstandingAmount), 0),
        personal_loan: debts.filter(d => d.type === "personal_loan").reduce((s, d) => s + Number(d.outstandingAmount), 0),
        installment: debts.filter(d => d.type === "installment").reduce((s, d) => s + Number(d.outstandingAmount), 0),
        informal: debts.filter(d => d.type === "informal").reduce((s, d) => s + Number(d.outstandingAmount), 0),
      },
      strategy,
    };
  }),
});

function formatBDT(amount: number): string {
  return `৳${Math.round(amount).toLocaleString()}`;
}
