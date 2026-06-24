import { ParseResult } from "../types";
import { AIProvider, buildParsePrompt, parseAIResponse, splitTransactions, registerProvider } from "./index";

export function createDeepSeekProvider(): AIProvider {
  return {
    name: "deepseek",
    parse: parseWithDeepSeek,
  };
}

registerProvider("DEEPSEEK_API_KEY", createDeepSeekProvider);

async function parseWithDeepSeek(
  input: string,
  categories: string[],
  accounts: string[]
): Promise<ParseResult> {
  const startTime = Date.now();
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: "DeepSeek API key not configured",
      provider: "deepseek",
      model: "deepseek-chat",
      latencyMs: Date.now() - startTime,
    };
  }

  const parts = splitTransactions(input);
  const isMulti = parts.length > 1;
  const prompt = buildParsePrompt(input, categories, accounts, isMulti);

  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
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
        error: "No response from DeepSeek",
        provider: "deepseek",
        model: "deepseek-chat",
        latencyMs: Date.now() - startTime,
      };
    }

    return parseAIResponse(content, "deepseek", "deepseek-chat", Date.now() - startTime);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse",
      provider: "deepseek",
      model: "deepseek-chat",
      latencyMs: Date.now() - startTime,
    };
  }
}
