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

  clearHistory: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.chatMessage.deleteMany({ where: { userId: ctx.session.user.id } });
    return { success: true };
  }),

  // Get available models for chat dropdown
  getModels: protectedProcedure.query(async ({ ctx }) => {
    const settings = await ctx.db.aISettings.findUnique({
      where: { userId: ctx.session.user.id },
    });

    const apiKeys = (settings?.apiKeys as Record<string, string>) || {};
    const fetchedModels = (settings as any)?.fetchedModels || {};

    const allProviders: Record<string, { name: string; models: string[]; hasKey: boolean }> = {
      openai: { name: "OpenAI", models: ["gpt-4o-mini", "gpt-4o"], hasKey: !!apiKeys.openai },
      anthropic: { name: "Anthropic", models: ["claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022"], hasKey: !!apiKeys.anthropic },
      gemini: { name: "Gemini", models: ["gemini-1.5-flash", "gemini-1.5-pro"], hasKey: !!apiKeys.gemini },
      groq: { name: "Groq", models: ["llama-3.1-8b-instant", "llama-3.1-70b-versatile"], hasKey: !!apiKeys.groq },
      deepseek: { name: "DeepSeek", models: ["deepseek-chat", "deepseek-reasoner"], hasKey: !!apiKeys.deepseek },
      mistral: { name: "Mistral", models: ["mistral-small-latest"], hasKey: !!apiKeys.mistral },
      "opencode-zen": { name: "OpenCode Zen", models: ["deepseek-v4-flash-free", "deepseek-v4-flash", "gpt-5.4-mini"], hasKey: !!apiKeys["opencode-zen"] },
      openrouter: { name: "OpenRouter", models: ["meta-llama/llama-3.1-8b-instruct:free"], hasKey: !!apiKeys.openrouter },
    };

    // Override with fetched models if available
    for (const [id, provider] of Object.entries(allProviders)) {
      if (fetchedModels[id]?.length) {
        provider.models = fetchedModels[id];
      }
    }

    return {
      providers: allProviders,
      activeProvider: settings?.activeProvider || "",
      activeModel: settings?.activeModel || "",
    };
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

      const [accounts, transactions, subscriptions, thisMonthIncome, thisMonthExpense, lastMonth] = await Promise.all([
        ctx.db.account.findMany({ where: { userId: ctx.session.user.id, isActive: true }, select: { name: true, type: true, balance: true } }),
        ctx.db.transaction.findMany({
          where: { userId: ctx.session.user.id },
          include: { category: true, account: true },
          orderBy: { date: "desc" },
          take: 50,
        }),
        ctx.db.subscription.findMany({ where: { userId: ctx.session.user.id, status: "ACTIVE" }, select: { name: true, amount: true, billingCycle: true } }),
        ctx.db.transaction.aggregate({
          where: { userId: ctx.session.user.id, type: "INCOME", date: { gte: thisMonthStart, lte: thisMonthEnd } },
          _sum: { amount: true },
        }),
        ctx.db.transaction.aggregate({
          where: { userId: ctx.session.user.id, type: "EXPENSE", date: { gte: thisMonthStart, lte: thisMonthEnd } },
          _sum: { amount: true },
        }),
        ctx.db.transaction.aggregate({
          where: { userId: ctx.session.user.id, date: { gte: lastMonthStart, lte: lastMonthEnd } },
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
      const preferences = (aiSettings?.preferences as any) || {};

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

      const errors: string[] = [];

      for (const provider of providers) {
        const apiKey = storedKeys[provider.id] || process.env[provider.envKey];
        if (!apiKey) {
          errors.push(`${provider.id}: no API key`);
          continue;
        }

        const model = preferredModel && provider.id === preferredProvider ? preferredModel : provider.defaultModel;
        console.log(`[AI Chat] Trying ${provider.id} with model ${model}, key starts with: ${apiKey.substring(0, 8)}...`);

        try {
          let content = "";
          let res: Response;

          if (provider.id === "anthropic") {
            res = await fetch(`${provider.baseUrl}/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
              body: JSON.stringify({
                model,
                max_tokens: 1024,
                system: FINANCIAL_ASSISTANT_SYSTEM_PROMPT,
                messages: messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })),
              }),
            });
            if (!res.ok) {
              const errBody = await res.text();
              let errMsg = `${res.status}`;
              try { const errJson = JSON.parse(errBody); errMsg += ` - ${errJson.error?.message || errBody.substring(0, 150)}`; } catch { errMsg += ` - ${errBody.substring(0, 150)}`; }
              errors.push(`${provider.id}: ${errMsg}`);
              continue;
            }
            const data = await res.json();
            content = data.content?.[0]?.text || "";
          } else if (provider.id === "gemini") {
            const systemMsg = messages.find((m) => m.role === "system")?.content || "";
            const userMsgs = messages.filter((m) => m.role !== "system").map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`).join("\n\n");

            res = await fetch(`${provider.baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `${systemMsg}\n\n${userMsgs}` }] }],
                generationConfig: { maxOutputTokens: 1024 },
              }),
            });
            if (!res.ok) {
              const errBody = await res.text();
              let errMsg = `${res.status}`;
              try { const errJson = JSON.parse(errBody); errMsg += ` - ${errJson.error?.message || errBody.substring(0, 150)}`; } catch { errMsg += ` - ${errBody.substring(0, 150)}`; }
              errors.push(`${provider.id}: ${errMsg}`);
              continue;
            }
            const data = await res.json();
            content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          } else {
            res = await fetch(`${provider.baseUrl}/chat/completions`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({ model, messages, max_tokens: 1024, temperature: 0.7 }),
            });
            if (!res.ok) {
              const errBody = await res.text();
              let errMsg = `${res.status}`;
              try { const errJson = JSON.parse(errBody); errMsg += ` - ${errJson.error?.message || errJson.message || errBody.substring(0, 150)}`; } catch { errMsg += ` - ${errBody.substring(0, 150)}`; }
              errors.push(`${provider.id}: ${errMsg}`);
              continue;
            }
            const data = await res.json();
            content = data.choices?.[0]?.message?.content || "";
            if (!content && data.error) {
              errors.push(`${provider.id}: ${data.error.message || JSON.stringify(data.error).substring(0, 150)}`);
              continue;
            }
          }

          if (content) {
            await ctx.db.chatMessage.create({
              data: { userId: ctx.session.user.id, role: "assistant", content, provider: provider.id, model },
            });

            return {
              success: true,
              response: content,
              provider: provider.id,
              model,
              latencyMs: Date.now() - startTime,
            };
          } else {
            errors.push(`${provider.id}: empty response`);
          }
        } catch (error) {
          errors.push(`${provider.id}: ${error instanceof Error ? error.message : "unknown error"}`);
          continue;
        }
      }

      // All providers failed
      if (preferences.disableLocalFallback) {
        const errorDetail = errors.join("\n");
        const hasOpenCodeZen = errors.some((e) => e.includes("opencode-zen"));
        const hasNoKeys = errors.filter((e) => e.includes("no API key")).length;

        let suggestion = "";
        if (hasOpenCodeZen && !errors.some((e) => e.includes("no API key") && !e.includes("opencode-zen"))) {
          suggestion = "\n\nOpenCode Zen returned a server error. This is usually temporary. Try:\n1. Wait a few minutes and retry\n2. Add another provider (Groq is free and fast)\n3. Turn off AI Only mode to use local fallback";
        } else if (hasNoKeys > 0) {
          suggestion = "\n\nAdd an API key in AI Settings. Free options: Groq, OpenCode Zen free models.";
        }

        return {
          success: false,
          response: `No AI provider worked:${suggestion}\n\nErrors:\n${errorDetail}`,
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
