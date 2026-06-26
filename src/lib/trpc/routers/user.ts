import { z } from "zod";
import { router, protectedProcedure } from "../server";
import bcrypt from "bcryptjs";

export const userRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { id: true, name: true, email: true, currency: true, timezone: true, createdAt: true },
    });
    return user;
  }),

  updateProfile: protectedProcedure
    .input(z.object({ name: z.string().min(1).optional(), currency: z.string().optional(), timezone: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: input,
        select: { id: true, name: true, email: true, currency: true, timezone: true },
      });
    }),

  changePassword: protectedProcedure
    .input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(6) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({ where: { id: ctx.session.user.id } });
      if (!user) throw new Error("User not found");

      const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!isValid) throw new Error("Current password is incorrect");

      const newHash = await bcrypt.hash(input.newPassword, 12);
      await ctx.db.user.update({ where: { id: ctx.session.user.id }, data: { passwordHash: newHash } });

      return { success: true };
    }),

  exportData: protectedProcedure.query(async ({ ctx }) => {
    const [accounts, transactions, subscriptions, budgets] = await Promise.all([
      ctx.db.account.findMany({ where: { userId: ctx.session.user.id }, select: { name: true, type: true, balance: true, currency: true } }),
      ctx.db.transaction.findMany({
        where: { userId: ctx.session.user.id },
        include: { category: true, account: true },
        orderBy: { date: "desc" },
      }),
      ctx.db.subscription.findMany({ where: { userId: ctx.session.user.id }, select: { name: true, amount: true, billingCycle: true, status: true, nextBillingDate: true } }),
      ctx.db.budget.findMany({ where: { userId: ctx.session.user.id }, include: { category: true }, select: { name: true, amount: true, spent: true, period: true } }),
    ]);

    return { accounts, transactions, subscriptions, budgets };
  }),
});
