import { z } from "zod";
import { router, protectedProcedure } from "../server";

// Reducing balance amortization calculation
function calculateAmortization(params: {
  principal: number;
  annualRate: number;
  months: number;
  startDate: Date;
}) {
  const { principal, annualRate, months, startDate } = params;
  const monthlyRate = annualRate / 100 / 12;

  // EMI calculation for reducing balance
  const emi =
    monthlyRate > 0
      ? (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
        (Math.pow(1 + monthlyRate, months) - 1)
      : principal / months;

  const installments = [];
  let outstanding = principal;

  for (let i = 1; i <= months; i++) {
    const interestPortion = outstanding * monthlyRate;
    const principalPortion = emi - interestPortion;
    outstanding = Math.max(0, outstanding - principalPortion);

    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    installments.push({
      installmentNo: i,
      principalPortion: Math.round(principalPortion * 100) / 100,
      interestPortion: Math.round(interestPortion * 100) / 100,
      totalPayment: Math.round(emi * 100) / 100,
      outstandingAfter: Math.round(outstanding * 100) / 100,
      dueDate,
      status: "PENDING",
    });
  }

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + months);

  return {
    monthlyEMI: Math.round(emi * 100) / 100,
    installments,
    endDate,
  };
}

export const loanRouter = router({
  list: protectedProcedure
    .input(z.object({ creditCardId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.creditCardLoan.findMany({
        where: {
          userId: ctx.session.user.id,
          ...(input?.creditCardId && { creditCardId: input.creditCardId }),
        },
        include: {
          creditCard: { select: { name: true } },
          _count: { select: { installments: true, payments: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.creditCardLoan.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
        include: {
          installments: { orderBy: { installmentNo: "asc" } },
          payments: { orderBy: { paymentDate: "desc" } },
          creditCard: true,
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        creditCardId: z.string(),
        name: z.string().min(1),
        principalAmount: z.number().positive(),
        interestRate: z.number().min(0),
        totalInstallments: z.number().positive(),
        startDate: z.coerce.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx) => {
        const schedule = calculateAmortization({
          principal: input.principalAmount,
          annualRate: input.interestRate,
          months: input.totalInstallments,
          startDate: input.startDate,
        });

        const loan = await tx.creditCardLoan.create({
          data: {
            creditCardId: input.creditCardId,
            userId: ctx.session.user.id,
            name: input.name,
            principalAmount: input.principalAmount,
            outstandingAmount: input.principalAmount,
            interestRate: input.interestRate,
            totalInstallments: input.totalInstallments,
            monthlyEMI: schedule.monthlyEMI,
            startDate: input.startDate,
            endDate: schedule.endDate,
          },
        });

        await tx.loanInstallment.createMany({
          data: schedule.installments.map((inst) => ({
            loanId: loan.id,
            ...inst,
          })),
        });

        await tx.creditCard.update({
          where: { id: input.creditCardId },
          data: {
            currentBalance: { increment: input.principalAmount },
            availableCredit: { decrement: input.principalAmount },
          },
        });

        return loan;
      });
    }),

  payInstallment: protectedProcedure
    .input(
      z.object({
        loanId: z.string(),
        installmentNo: z.number(),
        amount: z.number().positive().optional(),
        paymentDate: z.coerce.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx) => {
        const installment = await tx.loanInstallment.findFirst({
          where: {
            loanId: input.loanId,
            installmentNo: input.installmentNo,
          },
        });

        if (!installment || installment.status === "PAID") {
          throw new Error("Invalid installment");
        }

        const amount = input.amount || Number(installment.totalPayment);

        await tx.loanInstallment.update({
          where: { id: installment.id },
          data: {
            status: "PAID",
            paidDate: input.paymentDate || new Date(),
          },
        });

        await tx.loanPayment.create({
          data: {
            loanId: input.loanId,
            amount,
            paymentDate: input.paymentDate || new Date(),
          },
        });

        await tx.creditCardLoan.update({
          where: { id: input.loanId },
          data: {
            outstandingAmount: { decrement: amount },
            paidInstallments: { increment: 1 },
            status:
              Number(installment.outstandingAfter) <= amount
                ? "PAID_OFF"
                : "ACTIVE",
          },
        });

        const loan = await tx.creditCardLoan.findUnique({
          where: { id: input.loanId },
        });
        if (loan) {
          await tx.creditCard.update({
            where: { id: loan.creditCardId },
            data: {
              currentBalance: { decrement: amount },
              availableCredit: { increment: amount },
            },
          });
        }

        return { success: true };
      });
    }),
});
