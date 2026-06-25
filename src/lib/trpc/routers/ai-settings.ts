import { z } from "zod";
import { router, protectedProcedure } from "../server";

const aiSettingsSchema = z.object({
  activeProvider: z.string().optional(),
  fallbackProvider: z.string().optional(),
  activeModel: z.string().optional(),
  fallbackModel: z.string().optional(),
  apiKeys: z.record(z.string(), z.string()).optional(),
  preferences: z.object({
    autoParse: z.boolean().optional(),
    showConfidence: z.boolean().optional(),
    enableChat: z.boolean().optional(),
    disableLocalFallback: z.boolean().optional(),
  }).optional(),
});

export const aiSettingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    // Get or create AI settings for user
    let settings = await ctx.db.aISettings.findUnique({
      where: { userId: ctx.session.user.id },
    });

    if (!settings) {
      settings = await ctx.db.aISettings.create({
        data: {
          userId: ctx.session.user.id,
          activeProvider: "",
          fallbackProvider: "",
          activeModel: "",
          fallbackModel: "",
          apiKeys: {},
          preferences: { autoParse: true, showConfidence: true, enableChat: true },
        },
      });
    }

    // Mask API keys for security
    const maskedKeys: Record<string, string> = {};
    const keys = (settings.apiKeys as Record<string, string>) || {};
    for (const [provider, key] of Object.entries(keys)) {
      maskedKeys[provider] = key ? `${key.slice(0, 8)}...${key.slice(-4)}` : "";
    }

    return {
      ...settings,
      apiKeys: maskedKeys,
      // apiKeysRaw NOT sent to client - only used server-side
    };
  }),

  save: protectedProcedure
    .input(aiSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.aISettings.findUnique({
        where: { userId: ctx.session.user.id },
      });

      if (existing) {
        // Merge API keys - only update non-masked values
        const currentKeys = (existing.apiKeys as Record<string, string>) || {};
        const newKeys = input.apiKeys || {};
        
        // Don't overwrite keys that are masked
        const mergedKeys = { ...currentKeys };
        for (const [provider, key] of Object.entries(newKeys)) {
          if (key && !key.includes("...")) {
            mergedKeys[provider] = key;
          }
        }

        return ctx.db.aISettings.update({
          where: { userId: ctx.session.user.id },
          data: {
            activeProvider: input.activeProvider ?? existing.activeProvider,
            fallbackProvider: input.fallbackProvider ?? existing.fallbackProvider,
            activeModel: input.activeModel ?? existing.activeModel,
            fallbackModel: input.fallbackModel ?? existing.fallbackModel,
            apiKeys: mergedKeys,
            preferences: (input.preferences as any) ?? existing.preferences,
          },
        });
      }

      return ctx.db.aISettings.create({
        data: {
          userId: ctx.session.user.id,
          activeProvider: input.activeProvider || "",
          fallbackProvider: input.fallbackProvider || "",
          activeModel: input.activeModel || "",
          fallbackModel: input.fallbackModel || "",
          apiKeys: input.apiKeys || {},
          preferences: input.preferences || { autoParse: true, showConfidence: true, enableChat: true },
        },
      });
    }),

  // Test API key by calling the provider
  testKey: protectedProcedure
    .input(z.object({ provider: z.string(), apiKey: z.string() }))
    .mutation(async ({ input }) => {
      const { provider, apiKey } = input;

      try {
        let success = false;
        let message = "";
        let models: string[] = [];

        switch (provider) {
          case "openai": {
            const res = await fetch("https://api.openai.com/v1/models", {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            success = res.ok;
            if (res.ok) {
              const data = await res.json();
              models = data.data?.filter((m: any) => m.id.includes("gpt")).map((m: any) => m.id) || [];
            }
            message = res.ok ? "Connected" : `Error ${res.status}`;
            break;
          }
          case "anthropic": {
            const res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: "claude-3-haiku-20240307",
                max_tokens: 1,
                messages: [{ role: "user", content: "hi" }],
              }),
            });
            success = res.ok || res.status === 400;
            models = ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-haiku-20240307"];
            message = res.ok ? "Connected" : res.status === 400 ? "Key valid" : `Error ${res.status}`;
            break;
          }
          case "gemini": {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            success = res.ok;
            if (res.ok) {
              const data = await res.json();
              models = data.models?.filter((m: any) => m.supportedGenerationMethods?.includes("generateContent")).map((m: any) => m.name.replace("models/", "")) || [];
            }
            message = res.ok ? "Connected" : `Error ${res.status}`;
            break;
          }
          case "groq": {
            const res = await fetch("https://api.groq.com/openai/v1/models", {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            success = res.ok;
            if (res.ok) {
              const data = await res.json();
              models = data.data?.map((m: any) => m.id) || [];
            }
            message = res.ok ? "Connected" : `Error ${res.status}`;
            break;
          }
          case "deepseek": {
            const res = await fetch("https://api.deepseek.com/v1/models", {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            success = res.ok;
            models = ["deepseek-chat", "deepseek-reasoner"];
            message = res.ok ? "Connected" : `Error ${res.status}`;
            break;
          }
          case "mistral": {
            const res = await fetch("https://api.mistral.ai/v1/models", {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            success = res.ok;
            if (res.ok) {
              const data = await res.json();
              models = data.data?.map((m: any) => m.id) || [];
            }
            message = res.ok ? "Connected" : `Error ${res.status}`;
            break;
          }
          case "openrouter": {
            const res = await fetch("https://openrouter.ai/api/v1/models", {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            success = res.ok;
            if (res.ok) {
              const data = await res.json();
              models = data.data?.map((m: any) => m.id).slice(0, 50) || [];
            }
            message = res.ok ? "Connected" : `Error ${res.status}`;
            break;
          }
          case "opencode-zen": {
            const res = await fetch("https://opencode.ai/zen/v1/models", {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            success = res.ok;
            if (res.ok) {
              const data = await res.json();
              models = data.data?.map((m: any) => m.id) || [];
            }
            message = res.ok ? "Connected" : `Error ${res.status}`;
            break;
          }
          case "ollama": {
            const res = await fetch("http://localhost:11434/api/tags");
            success = res.ok;
            if (res.ok) {
              const data = await res.json();
              models = data.models?.map((m: any) => m.name) || [];
            }
            message = res.ok ? "Connected" : "Ollama not running";
            break;
          }
        }

        return { success, message, models };
      } catch (error) {
        return { success: false, message: "Connection failed", models: [] };
      }
    }),
});
