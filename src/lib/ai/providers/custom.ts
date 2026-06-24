import { ParseResult } from "../types";
import { AIProvider, buildParsePrompt, parseAIResponse, splitTransactions, registerProvider } from "./index";

export interface CustomProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function createCustomProvider(config: CustomProviderConfig): AIProvider {
  return {
    name: config.name,
    parse: async (input, categories, accounts) => {
      const startTime = Date.now();

      const parts = splitTransactions(input);
      const isMulti = parts.length > 1;
      const prompt = buildParsePrompt(input, categories, accounts, isMulti);

      try {
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: "system", content: "You are a financial transaction parser. Respond with valid JSON only." },
              { role: "user", content: prompt },
            ],
            temperature: 0.1,
            max_tokens: isMulti ? 1000 : 200,
          }),
        });

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          return {
            success: false,
            error: `No response from ${config.name}`,
            provider: config.name,
            model: config.model,
            latencyMs: Date.now() - startTime,
          };
        }

        return parseAIResponse(content, config.name, config.model, Date.now() - startTime);
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to parse",
          provider: config.name,
          model: config.model,
          latencyMs: Date.now() - startTime,
        };
      }
    },
  };
}

// Custom providers from environment variables
// Format: CUSTOM_PROVIDER_1_NAME, CUSTOM_PROVIDER_1_BASE_URL, CUSTOM_PROVIDER_1_API_KEY, CUSTOM_PROVIDER_1_MODEL
// Can add up to 5 custom providers (CUSTOM_PROVIDER_1 through CUSTOM_PROVIDER_5)
for (let i = 1; i <= 5; i++) {
  const name = process.env[`CUSTOM_PROVIDER_${i}_NAME`];
  const baseUrl = process.env[`CUSTOM_PROVIDER_${i}_BASE_URL`];
  const apiKey = process.env[`CUSTOM_PROVIDER_${i}_API_KEY`];
  const model = process.env[`CUSTOM_PROVIDER_${i}_MODEL`];

  if (name && baseUrl && apiKey && model) {
    const envKey = `CUSTOM_PROVIDER_${i}_API_KEY`;
    const config: CustomProviderConfig = { name, baseUrl, apiKey, model };
    registerProvider(envKey, () => createCustomProvider(config));
  }
}
