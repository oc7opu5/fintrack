import { ParseResult } from "../types";
import { AIProvider, buildParsePrompt, parseAIResponse, splitTransactions, registerProvider } from "./index";

export function createAnthropicProvider(): AIProvider {
  return {
    name: "anthropic",
    parse: parseWithAnthropic,
  };
}

registerProvider("ANTHROPIC_API_KEY", createAnthropicProvider);

async function parseWithAnthropic(
  input: string,
  categories: string[],
  accounts: string[]
): Promise<ParseResult> {
  const startTime = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: "Anthropic API key not configured",
      provider: "anthropic",
      model: "claude-3-haiku-20240307",
      latencyMs: Date.now() - startTime,
    };
  }

  const parts = splitTransactions(input);
  const isMulti = parts.length > 1;
  const prompt = buildParsePrompt(input, categories, accounts, isMulti);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: isMulti ? 1000 : 200,
        messages: [
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      return {
        success: false,
        error: "No response from Anthropic",
        provider: "anthropic",
        model: "claude-3-haiku-20240307",
        latencyMs: Date.now() - startTime,
      };
    }

    // Extract JSON from response (Claude may wrap in markdown)
    const jsonMatch = content.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;

    return parseAIResponse(jsonStr, "anthropic", "claude-3-haiku-20240307", Date.now() - startTime);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse",
      provider: "anthropic",
      model: "claude-3-haiku-20240307",
      latencyMs: Date.now() - startTime,
    };
  }
}
