import { z } from "zod";
import { router, protectedProcedure } from "../server";
import { parseTransaction } from "@/lib/ai/parser";

export const aiRouter = router({
  parse: protectedProcedure
    .input(
      z.object({
        input: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get user's categories and accounts
      const [categories, accounts] = await Promise.all([
        ctx.db.category.findMany({
          where: { userId: ctx.session.user.id },
          select: { name: true },
        }),
        ctx.db.account.findMany({
          where: { userId: ctx.session.user.id, isActive: true },
          select: { name: true, type: true },
        }),
      ]);

      const categoryNames = categories.map((c) => c.name);
      const accountNames = accounts.map((a) => a.name);

      const result = await parseTransaction(
        input.input,
        categoryNames,
        accountNames
      );

      // Log the parse attempt
      if (result.transaction) {
        await ctx.db.aIParseLog.create({
          data: {
            userId: ctx.session.user.id,
            rawInput: input.input,
            parsedResult: result.transaction as any,
            confidence: result.transaction.confidence,
            provider: result.provider,
            model: result.model,
            latencyMs: result.latencyMs,
            wasAccepted: false,
          },
        });
      }

      return result;
    }),

  acceptParse: protectedProcedure
    .input(
      z.object({
        logId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.aIParseLog.update({
        where: { id: input.logId },
        data: { wasAccepted: true },
      });
    }),
});
