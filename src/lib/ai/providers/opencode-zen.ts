import { ParseResult } from "../types";
import { AIProvider, buildParsePrompt, parseAIResponse, splitTransactions, registerProvider } from "./index";

export function createOpenCodeZenProvider(): AIProvider {
  return {
    name: "opencode-zen",
    parse: parseWithOpenCodeZen,
  };
}

registerProvider("OPENCODE_ZEN_API_KEY", createOpenCodeZenProvider);

async function parseWithOpenCodeZen(
  input: string,
  categories: string[],
  accounts: string[]
): Promise<ParseResult> {
  const startTime = Date.now();
  const apiKey = process.env.OPENCODE_ZEN_API_KEY;
  const baseUrl = process.env.OPENCODE_ZEN_BASE_URL || "https://api.opencodezen.com/v1";

  if (!apiKey) {
    return {
      success: false,
      error: "OpenCode Zen API key not configured",
      provider: "opencode-zen",
      model: "zen-flash",
      latencyMs: Date.now() - startTime,
    };
  }

  const parts = splitTransactions(input);
  const isMulti = parts.length > 1;
  const prompt = buildParsePrompt(input, categories, accounts, isMulti);
  const model = process.env.OPENCODE_ZEN_MODEL || "zen-flash";

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
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
        error: "No response from OpenCode Zen",
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
