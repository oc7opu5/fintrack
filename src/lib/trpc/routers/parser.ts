import { z } from "zod";
import { router, protectedProcedure } from "../server";
import { parseEmailContent, parseReceiptText, parseOCRText } from "@/lib/ai/parsers";
import { parseTransaction } from "@/lib/ai/parser";

export const parserRouter = router({
  // Parse email content for transactions
  parseEmail: protectedProcedure
    .input(
      z.object({
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const transactions = parseEmailContent(input.content);

      if (transactions.length === 0) {
        return {
          success: false,
          error: "No transactions found in email",
          transactions: [],
        };
      }

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

      // Parse each transaction through AI
      const parsed = [];
      for (const tx of transactions) {
        const result = await parseTransaction(tx, categoryNames, accountNames);
        if (result.success && result.transaction) {
          parsed.push(result.transaction);
        }
      }

      return {
        success: parsed.length > 0,
        transactions: parsed,
        raw: transactions,
      };
    }),

  // Parse receipt text (from PDF or OCR)
  parseReceipt: protectedProcedure
    .input(
      z.object({
        text: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const receipt = parseReceiptText(input.text);

      if (!receipt.amount) {
        return {
          success: false,
          error: "Could not extract amount from receipt",
          receipt,
        };
      }

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

      // Build transaction description from receipt
      const desc = receipt.merchant
        ? `Purchase at ${receipt.merchant}`
        : "Receipt purchase";

      const result = await parseTransaction(
        `spent ${receipt.amount} on ${desc}`,
        categoryNames,
        accountNames
      );

      return {
        success: result.success,
        transaction: result.transaction,
        receipt,
      };
    }),

  // Parse OCR text from images
  parseImage: protectedProcedure
    .input(
      z.object({
        text: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const transactions = parseOCRText(input.text);

      if (transactions.length === 0) {
        return {
          success: false,
          error: "No transactions found in image",
          transactions: [],
        };
      }

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

      const parsed = [];
      for (const tx of transactions) {
        const result = await parseTransaction(tx, categoryNames, accountNames);
        if (result.success && result.transaction) {
          parsed.push(result.transaction);
        }
      }

      return {
        success: parsed.length > 0,
        transactions: parsed,
        raw: transactions,
      };
    }),
});
