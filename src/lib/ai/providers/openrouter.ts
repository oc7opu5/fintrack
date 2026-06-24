import { ParseResult } from "../types";
import { AIProvider, buildParsePrompt, parseAIResponse, splitTransactions, registerProvider } from "./index";

export function createOpenRouterProvider(): AIProvider {
  return {
    name: "openrouter",
    parse: parseWithOpenRouter,
  };
}

registerProvider("OPENROUTER_API_KEY", createOpenRouterProvider);

async function parseWithOpenRouter(
  input: string,
  categories: string[],
  accounts: string[]
): Promise<ParseResult> {
  const startTime = Date.now();
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: "OpenRouter API key not configured",
      provider: "openrouter",
      model: "meta-llama/llama-3.1-8b-instruct:free",
      latencyMs: Date.now() - startTime,
    };
  }

  const parts = splitTransactions(input);
  const isMulti = parts.length > 1;
  const prompt = buildParsePrompt(input, categories, accounts, isMulti);
  const model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free";

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://fintrack.app",
        "X-Title": "FinTrack",
      },
      body: JSON.stringify({
        model,
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
        error: "No response from OpenRouter",
        provider: "openrouter",
        model,
        latencyMs: Date.now() - startTime,
      };
    }

    return parseAIResponse(content, "openrouter", model, Date.now() - startTime);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse",
      provider: "openrouter",
      model,
      latencyMs: Date.now() - startTime,
    };
  }
}
