import { ParseResult } from "../types";
import { AIProvider, buildParsePrompt, parseAIResponse, splitTransactions, registerProvider } from "./index";

export function createMistralProvider(): AIProvider {
  return {
    name: "mistral",
    parse: parseWithMistral,
  };
}

registerProvider("MISTRAL_API_KEY", createMistralProvider);

async function parseWithMistral(
  input: string,
  categories: string[],
  accounts: string[]
): Promise<ParseResult> {
  const startTime = Date.now();
  const apiKey = process.env.MISTRAL_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: "Mistral API key not configured",
      provider: "mistral",
      model: "mistral-small-latest",
      latencyMs: Date.now() - startTime,
    };
  }

  const parts = splitTransactions(input);
  const isMulti = parts.length > 1;
  const prompt = buildParsePrompt(input, categories, accounts, isMulti);

  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
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
        error: "No response from Mistral",
        provider: "mistral",
        model: "mistral-small-latest",
        latencyMs: Date.now() - startTime,
      };
    }

    return parseAIResponse(content, "mistral", "mistral-small-latest", Date.now() - startTime);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse",
      provider: "mistral",
      model: "mistral-small-latest",
      latencyMs: Date.now() - startTime,
    };
  }
}
