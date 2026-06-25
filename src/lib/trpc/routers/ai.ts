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

  chat: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();

      // Get user's financial data for context
      const [accounts, transactions, subscriptions, monthlySummary] = await Promise.all([
        ctx.db.account.findMany({
          where: { userId: ctx.session.user.id, isActive: true },
          select: { name: true, type: true, balance: true },
        }),
        ctx.db.transaction.findMany({
          where: { userId: ctx.session.user.id },
          include: { category: true, account: true },
          orderBy: { date: "desc" },
          take: 30,
        }),
        ctx.db.subscription.findMany({
          where: { userId: ctx.session.user.id, status: "ACTIVE" },
          select: { name: true, amount: true, billingCycle: true },
        }),
        (async () => {
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
          
          const [income, expense] = await Promise.all([
            ctx.db.transaction.aggregate({
              where: { userId: ctx.session.user.id, type: "INCOME", date: { gte: start, lte: end } },
              _sum: { amount: true },
            }),
            ctx.db.transaction.aggregate({
              where: { userId: ctx.session.user.id, type: "EXPENSE", date: { gte: start, lte: end } },
              _sum: { amount: true },
            }),
          ]);

          return {
            income: Number(income._sum.amount || 0),
            expense: Number(expense._sum.amount || 0),
          };
        })(),
      ]);

      // Build financial context
      const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
      const monthlyCost = subscriptions.reduce((sum, s) => {
        const amt = Number(s.amount);
        if (s.billingCycle === "YEARLY") return sum + amt / 12;
        if (s.billingCycle === "QUARTERLY") return sum + amt / 3;
        return sum + amt;
      }, 0);

      // Category breakdown
      const categoryTotals: Record<string, number> = {};
      transactions
        .filter((t) => t.type === "EXPENSE")
        .forEach((t) => {
          const cat = t.category?.name || "Other";
          categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount);
        });

      const financialContext = `User's Financial Summary:
- Total Balance: ৳${totalBalance.toLocaleString()}
- Accounts: ${accounts.map((a) => `${a.name} (${a.type}): ৳${Number(a.balance).toLocaleString()}`).join(", ")}
- Monthly Income: ৳${monthlySummary.income.toLocaleString()}
- Monthly Expenses: ৳${monthlySummary.expense.toLocaleString()}
- Savings Rate: ${monthlySummary.income > 0 ? Math.round(((monthlySummary.income - monthlySummary.expense) / monthlySummary.income) * 100) : 0}%
- Active Subscriptions: ${subscriptions.length} (৳${Math.round(monthlyCost).toLocaleString()}/month)
- Top Categories: ${Object.entries(categoryTotals).sort(([, a], [, b]) => b - a).slice(0, 5).map(([cat, amt]) => `${cat}: ৳${amt.toLocaleString()}`).join(", ")}
- Recent Transactions: ${transactions.slice(0, 10).map((t) => `${t.description} (${t.type === "INCOME" ? "+" : "-"}৳${Number(t.amount).toLocaleString()})`).join(", ")}`;

      // Try AI providers - get settings from database
      const aiSettings = await ctx.db.aISettings.findUnique({
        where: { userId: ctx.session.user.id },
      });

      const storedKeys = (aiSettings?.apiKeys as Record<string, string>) || {};
      const preferredProvider = aiSettings?.activeProvider || "";
      const preferredModel = aiSettings?.activeModel || "";

      const providers = [
        { id: "openai", envKey: "OPENAI_API_KEY", defaultModel: "gpt-4o-mini" },
        { id: "groq", envKey: "GROQ_API_KEY", defaultModel: "llama-3.1-8b-instant" },
        { id: "anthropic", envKey: "ANTHROPIC_API_KEY", defaultModel: "claude-3-haiku-20240307" },
        { id: "gemini", envKey: "GOOGLE_AI_API_KEY", defaultModel: "gemini-1.5-flash" },
        { id: "deepseek", envKey: "DEEPSEEK_API_KEY", defaultModel: "deepseek-chat" },
        { id: "mistral", envKey: "MISTRAL_API_KEY", defaultModel: "mistral-small-latest" },
        { id: "opencode-zen", envKey: "OPENCODE_ZEN_API_KEY", defaultModel: "deepseek-v4-flash-free" },
      ];

      // Sort providers - preferred first
      if (preferredProvider) {
        providers.sort((a, b) => (a.id === preferredProvider ? -1 : b.id === preferredProvider ? 1 : 0));
      }

      for (const provider of providers) {
        // Use stored key from database, fall back to env var
        const apiKey = storedKeys[provider.id] || process.env[provider.envKey];
        if (!apiKey) continue;

        const model = preferredModel && provider.id === preferredProvider ? preferredModel : provider.defaultModel;

        try {
          let response;
          let content;

          if (provider.id === "anthropic") {
            response = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model,
                max_tokens: 1024,
                messages: [
                  {
                    role: "user",
                    content: `You are a helpful financial assistant. Use the user's financial data to answer their question. Be concise and actionable.\n\n${financialContext}\n\nUser Question: ${input.message}`,
                  },
                ],
              }),
            });
            const data = await response.json();
            content = data.content?.[0]?.text;
          } else if (provider.id === "gemini") {
            response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [
                    {
                      parts: [
                        {
                          text: `You are a helpful financial assistant. Use the user's financial data to answer their question. Be concise and actionable.\n\n${financialContext}\n\nUser Question: ${input.message}`,
                        },
                      ],
                    },
                  ],
                  generationConfig: { maxOutputTokens: 1024 },
                }),
              }
            );
            const data = await response.json();
            content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          } else {
            // OpenAI-compatible (OpenAI, Groq, DeepSeek, Mistral, OpenRouter, OpenCode Zen)
            const baseUrl =
              provider.id === "openai"
                ? "https://api.openai.com/v1"
                : provider.id === "groq"
                ? "https://api.groq.com/openai/v1"
                : provider.id === "deepseek"
                ? "https://api.deepseek.com/v1"
                : provider.id === "mistral"
                ? "https://api.mistral.ai/v1"
                : provider.id === "opencode-zen"
                ? "https://opencode.ai/zen/v1"
                : "https://openrouter.ai/api/v1";

            response = await fetch(`${baseUrl}/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model,
                messages: [
                  {
                    role: "system",
                    content: "You are a helpful financial assistant. Be concise and actionable.",
                  },
                  {
                    role: "user",
                    content: `Here's my financial data:\n\n${financialContext}\n\nMy question: ${input.message}`,
                  },
                ],
                max_tokens: 1024,
                temperature: 0.7,
              }),
            });
            const data = await response.json();
            content = data.choices?.[0]?.message?.content;
          }

          if (content) {
            return {
              success: true,
              response: content,
              provider: provider.id,
              model,
              latencyMs: Date.now() - startTime,
            };
          }
        } catch (error) {
          console.warn(`Chat provider ${provider.id} failed:`, error);
          continue;
        }
      }

      // Fallback to local analysis
      const savingsRate = monthlySummary.income > 0
        ? Math.round(((monthlySummary.income - monthlySummary.expense) / monthlySummary.income) * 100)
        : 0;

      let localResponse = "";
      const lower = input.message.toLowerCase();

      if (lower.includes("balance") || lower.includes("net worth")) {
        localResponse = `Your current total balance is ৳${totalBalance.toLocaleString()} across ${accounts.length} accounts.`;
      } else if (lower.includes("spend") || lower.includes("expense")) {
        localResponse = `This month you've spent ৳${monthlySummary.expense.toLocaleString()} against ৳${monthlySummary.income.toLocaleString()} income. Savings rate: ${savingsRate}%.`;
      } else if (lower.includes("saving")) {
        localResponse = `You're saving ${savingsRate}% this month. ${savingsRate >= 20 ? "Great job!" : "Try to reach 20% savings rate."}`;
      } else if (lower.includes("subscription")) {
        localResponse = `You have ${subscriptions.length} active subscriptions costing ~৳${Math.round(monthlyCost).toLocaleString()}/month.`;
      } else {
        localResponse = `Based on your data: Balance ৳${totalBalance.toLocaleString()}, Monthly income ৳${monthlySummary.income.toLocaleString()}, expenses ৳${monthlySummary.expense.toLocaleString()}. ${savingsRate >= 20 ? "You're doing well!" : "Try to save more."}`;
      }

      return {
        success: true,
        response: localResponse,
        provider: "local",
        model: "fallback",
        latencyMs: Date.now() - startTime,
      };
    }),
});
