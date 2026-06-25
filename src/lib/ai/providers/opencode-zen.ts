import { ParseResult } from "../types";
import { AIProvider, buildParsePrompt, parseAIResponse, splitTransactions, registerProvider } from "./index";

export function createOpenCodeZenProvider(): AIProvider {
  return {
    name: "opencode-zen",
    parse: parseWithOpenCodeZen,
  };
}

registerProvider("OPENCODE_ZEN_API_KEY", createOpenCodeZenProvider);

// Fetch available models from OpenCode Zen
export async function fetchOpenCodeZenModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch("https://opencode.ai/zen/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await res.json();
    return data.data?.map((m: any) => m.id).sort() || [];
  } catch {
    // Default models if API doesn't support model listing
    return [
      "deepseek-v4-flash-free",
      "deepseek-v4-flash",
      "deepseek-v4-pro",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
      "claude-haiku-4-5",
      "gemini-3-flash",
      "qwen3.5-plus",
      "mimo-v2.5-free",
    ];
  }
}

async function parseWithOpenCodeZen(
  input: string,
  categories: string[],
  accounts: string[]
): Promise<ParseResult> {
  const startTime = Date.now();
  const apiKey = process.env.OPENCODE_ZEN_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: "OpenCode Zen API key not configured. Get one at https://opencode.ai/auth",
      provider: "opencode-zen",
      model: process.env.OPENCODE_ZEN_MODEL || "deepseek-v4-flash-free",
      latencyMs: Date.now() - startTime,
    };
  }

  const parts = splitTransactions(input);
  const isMulti = parts.length > 1;
  const prompt = buildParsePrompt(input, categories, accounts, isMulti);
  const model = process.env.OPENCODE_ZEN_MODEL || "deepseek-v4-flash-free";

  try {
    const response = await fetch("https://opencode.ai/zen/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
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
        error: data.error?.message || "No response from OpenCode Zen",
        provider: "opencode-zen",
        model,
        latencyMs: Date.now() - startTime,
      };
    }

    return parseAIResponse(content, "opencode-zen", model, Date.now() - startTime);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse",
      provider: "opencode-zen",
      model,
      latencyMs: Date.now() - startTime,
    };
  }
}

