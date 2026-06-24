import { ParseResult } from "../types";
import { AIProvider, buildParsePrompt, parseAIResponse, splitTransactions, registerProvider } from "./index";

export function createGroqProvider(): AIProvider {
  return {
    name: "groq",
    parse: parseWithGroq,
  };
}

registerProvider("GROQ_API_KEY", createGroqProvider);

async function parseWithGroq(
  input: string,
  categories: string[],
  accounts: string[]
): Promise<ParseResult> {
  const startTime = Date.now();
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: "Groq API key not configured",
      provider: "groq",
      model: "llama-3.1-8b-instant",
      latencyMs: Date.now() - startTime,
    };
  }

  const parts = splitTransactions(input);
  const isMulti = parts.length > 1;
  const prompt = buildParsePrompt(input, categories, accounts, isMulti);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
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
        error: "No response from Groq",
        provider: "groq",
        model: "llama-3.1-8b-instant",
        latencyMs: Date.now() - startTime,
      };
    }

    return parseAIResponse(content, "groq", "llama-3.1-8b-instant", Date.now() - startTime);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse",
      provider: "groq",
      model: "llama-3.1-8b-instant",
      latencyMs: Date.now() - startTime,
    };
  }
}
