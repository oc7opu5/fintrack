import { z } from "zod";
import { router, protectedProcedure } from "../server";
import { fetchExchangeRates, convertCurrency, BASE_CURRENCY, SUPPORTED_CURRENCIES, DEFAULT_CURRENCIES } from "@/lib/currency";

export const currencyRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const currencies = await ctx.db.currency.findMany({ orderBy: { isBase: "desc" } });
    if (currencies.length === 0) {
      // Seed default currencies on first access
      await ctx.db.currency.createMany({
        data: DEFAULT_CURRENCIES.map(c => ({
          code: c.code,
          name: c.name,
          symbol: c.symbol,
          rateToBase: c.rateToBase,
          isBase: c.isBase,
        })),
        skipDuplicates: true,
      });
      return await ctx.db.currency.findMany({ orderBy: { isBase: "desc" } });
    }
    return currencies;
  }),

  getRates: protectedProcedure.query(async ({ ctx }) => {
    const currencies = await ctx.db.currency.findMany();
    const rates: Record<string, number> = {};
    for (const c of currencies) {
      rates[c.code] = Number(c.rateToBase);
    }
    return rates;
  }),

  refreshRates: protectedProcedure.mutation(async ({ ctx }) => {
    // Get API key from settings or env
    const settings = await ctx.db.aISettings.findUnique({ where: { userId: ctx.session.user.id } });
    const apiKey = (settings?.apiKeys as any)?.exchangerate || process.env.EXCHANGE_RATE_API_KEY;

    const rates = await fetchExchangeRates(apiKey);

    for (const [code, rate] of Object.entries(rates)) {
      await ctx.db.currency.upsert({
        where: { code },
        create: {
          code,
          name: code === "BDT" ? "Bangladeshi Taka" : code === "USD" ? "US Dollar" : code === "CAD" ? "Canadian Dollar" : code,
          symbol: code === "BDT" ? "৳" : code === "USD" ? "$" : code === "CAD" ? "C$" : code,
          rateToBase: rate,
          isBase: code === BASE_CURRENCY,
        },
        update: {
          rateToBase: rate,
          lastUpdated: new Date(),
        },
      });
    }

    return rates;
  }),

  convert: protectedProcedure
    .input(z.object({
      amount: z.number(),
      from: z.string(),
      to: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const currencies = await ctx.db.currency.findMany();
      const rates: Record<string, number> = {};
      for (const c of currencies) rates[c.code] = Number(c.rateToBase);

      const result = convertCurrency(input.amount, input.from, input.to, rates);
      return { amount: input.amount, from: input.from, to: input.to, result };
    }),
});
