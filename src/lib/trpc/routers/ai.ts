import { z } from "zod";
import { router, protectedProcedure } from "../server";
import { parseTransaction } from "@/lib/ai/parser";
import {
  buildChatMessages,
  buildFinancialContext,
  truncateContext,
  FINANCIAL_ASSISTANT_SYSTEM_PROMPT,
} from "@/lib/ai/service";

export const aiRouter = router({
  parse: protectedProcedure
    .input(z.object({ input: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [categories, accounts] = await Promise.all([
        ctx.db.category.findMany({ where: { userId: ctx.session.user.id }, select: { name: true } }),
        ctx.db.account.findMany({ where: { userId: ctx.session.user.id, isActive: true }, select: { name: true, type: true } }),
      ]);

      const result = await parseTransaction(input.input, categories.map((c) => c.name), accounts.map((a) => a.name));

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
    .input(z.object({ logId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.aIParseLog.update({ where: { id: input.logId }, data: { wasAccepted: true } });
    }),

  // Get chat history
  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      const messages = await ctx.db.chatMessage.findMany({
        where: { userId: ctx.session.user.id },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
      return messages.reverse();
    }),

  // Clear chat history
  clearHistory: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.chatMessage.deleteMany({ where: { userId: ctx.session.user.id } });
    return { success: true };
  }),

  // Chat with AI
  chat: protectedProcedure
    .input(z.object({ message: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();

      // Save user message
      await ctx.db.chatMessage.create({
        data: { userId: ctx.session.user.id, role: "user", content: input.message },
      });

      // Get conversation history
      const history = await ctx.db.chatMessage.findMany({
        where: { userId: ctx.session.user.id },
        orderBy: { createdAt: "asc" },
        take: 20,
      });

      const conversationHistory = history.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Get financial data
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      const [accounts, transactions, subscriptions, thisMonth, lastMonth] = await Promise.all([
        ctx.db.account.findMany({ where: { userId: ctx.session.user.id, isActive: true }, select: { name: true, type: true, balance: true } }),
        ctx.db.transaction.findMany({
          where: { userId: ctx.session.user.id },
          include: { category: true, account: true },
          orderBy: { date: "desc" },
          take: 50,
        }),
        ctx.db.subscription.findMany({ where: { userId: ctx.session.user.id, status: "ACTIVE" }, select: { name: true, amount: true, billingCycle: true } }),
        ctx.db.transaction.aggregate({
          where: { userId: ctx.session.user.id, date: { gte: thisMonthStart, lte: thisMonthEnd } },
          _sum: { amount: true },
          _count: true,
        }),
        ctx.db.transaction.aggregate({
          where: { userId: ctx.session.user.id, date: { gte: lastMonthStart, lte: lastMonthEnd } },
          _sum: { amount: true },
        }),
      ]);

      // Get income/expense breakdown
      const [thisMonthIncome, thisMonthExpense] = await Promise.all([
        ctx.db.transaction.aggregate({
          where: { userId: ctx.session.user.id, type: "INCOME", date: { gte: thisMonthStart, lte: thisMonthEnd } },
          _sum: { amount: true },
        }),
        ctx.db.transaction.aggregate({
          where: { userId: ctx.session.user.id, type: "EXPENSE", date: { gte: thisMonthStart, lte: thisMonthEnd } },
          _sum: { amount: true },
        }),
      ]);

      const financialContext = truncateContext(buildFinancialContext({
        accounts: accounts.map((a) => ({ name: a.name, type: a.type, balance: Number(a.balance) })),
        transactions: transactions.map((t) => ({
          description: t.description,
          amount: Number(t.amount),
          type: t.type,
          date: t.date,
          category: t.category,
          account: t.account ? { name: t.account.name } : null,
        })),
        subscriptions: subscriptions.map((s) => ({ name: s.name, amount: Number(s.amount), billingCycle: s.billingCycle })),
        monthlyIncome: Number(thisMonthIncome._sum.amount || 0),
        monthlyExpense: Number(thisMonthExpense._sum.amount || 0),
        previousMonthExpense: Number(lastMonth._sum.amount || 0),
      }));

      const messages = buildChatMessages(input.message, financialContext, conversationHistory);

      // Get API keys from settings
      const aiSettings = await ctx.db.aISettings.findUnique({ where: { userId: ctx.session.user.id } });
      const storedKeys = (aiSettings?.apiKeys as Record<string, string>) || {};
      const preferredProvider = aiSettings?.activeProvider || "";
      const preferredModel = aiSettings?.activeModel || "";

      // Provider configs
      const providers = [
        { id: "openai", envKey: "OPENAI_API_KEY", defaultModel: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" },
        { id: "groq", envKey: "GROQ_API_KEY", defaultModel: "llama-3.1-8b-instant", baseUrl: "https://api.groq.com/openai/v1" },
        { id: "anthropic", envKey: "ANTHROPIC_API_KEY", defaultModel: "claude-3-haiku-20240307", baseUrl: "https://api.anthropic.com/v1" },
        { id: "gemini", envKey: "GOOGLE_AI_API_KEY", defaultModel: "gemini-1.5-flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
        { id: "deepseek", envKey: "DEEPSEEK_API_KEY", defaultModel: "deepseek-chat", baseUrl: "https://api.deepseek.com/v1" },
        { id: "mistral", envKey: "MISTRAL_API_KEY", defaultModel: "mistral-small-latest", baseUrl: "https://api.mistral.ai/v1" },
        { id: "opencode-zen", envKey: "OPENCODE_ZEN_API_KEY", defaultModel: "deepseek-v4-flash-free", baseUrl: "https://opencode.ai/zen/v1" },
        { id: "openrouter", envKey: "OPENROUTER_API_KEY", defaultModel: "meta-llama/llama-3.1-8b-instruct:free", baseUrl: "https://openrouter.ai/api/v1" },
      ];

      // Sort: preferred first
      if (preferredProvider) {
        providers.sort((a, b) => (a.id === preferredProvider ? -1 : b.id === preferredProvider ? 1 : 0));
      }

      for (const provider of providers) {
        const apiKey = storedKeys[provider.id] || process.env[provider.envKey];
        if (!apiKey) continue;

        const model = preferredModel && provider.id === preferredProvider ? preferredModel : provider.defaultModel;

        try {
          let content = "";

          if (provider.id === "anthropic") {
            const res = await fetch(`${provider.baseUrl}/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
              body: JSON.stringify({
                model,
                max_tokens: 1024,
                system: FINANCIAL_ASSISTANT_SYSTEM_PROMPT,
                messages: messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })),
              }),
            });
            const data = await res.json();
            content = data.content?.[0]?.text || "";
          } else if (provider.id === "gemini") {
            const systemMsg = messages.find((m) => m.role === "system")?.content || "";
            const userMsgs = messages.filter((m) => m.role !== "system").map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`).join("\n\n");

            const res = await fetch(`${provider.baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `${systemMsg}\n\n${userMsgs}` }] }],
                generationConfig: { maxOutputTokens: 1024 },
              }),
            });
            const data = await res.json();
            content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          } else {
            // OpenAI-compatible
            const res = await fetch(`${provider.baseUrl}/chat/completions`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({
                model,
                messages,
                max_tokens: 1024,
                temperature: 0.7,
              }),
            });
            const data = await res.json();
            content = data.choices?.[0]?.message?.content || "";
          }

          if (content) {
            // Save assistant response
            await ctx.db.chatMessage.create({
              data: {
                userId: ctx.session.user.id,
                role: "assistant",
                content,
                provider: provider.id,
                model,
              },
            });

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

      // Check if local fallback is disabled
      const preferences = (aiSettings?.preferences as any) || {};
      if (preferences.disableLocalFallback) {
        return {
          success: false,
          response: "No AI provider configured. Please add an API key in AI Settings.",
          provider: "none",
          model: "none",
          latencyMs: Date.now() - startTime,
        };
      }

      // Local fallback
      const localResponse = generateLocalResponse(input.message, {
        totalBalance: accounts.reduce((s, a) => s + Number(a.balance), 0),
        monthlyIncome: Number(thisMonthIncome._sum.amount || 0),
        monthlyExpense: Number(thisMonthExpense._sum.amount || 0),
        subscriptionCount: subscriptions.length,
        accountCount: accounts.length,
      });

      await ctx.db.chatMessage.create({
        data: { userId: ctx.session.user.id, role: "assistant", content: localResponse, provider: "local", model: "fallback" },
      });

      return {
        success: true,
        response: localResponse,
        provider: "local",
        model: "fallback",
        latencyMs: Date.now() - startTime,
      };
    }),
});

function generateLocalResponse(message: string, data: {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  subscriptionCount: number;
  accountCount: number;
}): string {
  const lower = message.toLowerCase();
  const savingsRate = data.monthlyIncome > 0
    ? Math.round(((data.monthlyIncome - data.monthlyExpense) / data.monthlyIncome) * 100)
    : 0;

  if (lower.includes("balance") || lower.includes("net worth")) {
    return `Your total balance is ৳${data.totalBalance.toLocaleString()} across ${data.accountCount} accounts.`;
  }
  if (lower.includes("spend") || lower.includes("expense")) {
    return `This month you spent ৳${data.monthlyExpense.toLocaleString()} against ৳${data.monthlyIncome.toLocaleString()} income. Savings rate: ${savingsRate}%. ${savingsRate < 20 ? "Try to save at least 20%." : "Good job!"}`;
  }
  if (lower.includes("saving")) {
    return `You're saving ${savingsRate}% this month. ${savingsRate >= 20 ? "Excellent!" : `To reach 20%, save ৳${Math.round(data.monthlyIncome * 0.2 - data.monthlyExpense).toLocaleString()} more.`}`;
  }
  if (lower.includes("subscription")) {
    return `You have ${data.subscriptionCount} active subscriptions. Check the Subscriptions page for details.`;
  }
  return `Your balance: ৳${data.totalBalance.toLocaleString()}. Monthly: +৳${data.monthlyIncome.toLocaleString()} / -৳${data.monthlyExpense.toLocaleString()}. Savings rate: ${savingsRate}%.`;
}
