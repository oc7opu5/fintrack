import { ParseResult } from "../types";
import { AIProvider, buildParsePrompt, parseAIResponse, splitTransactions, registerProvider } from "./index";

export function createOllamaProvider(): AIProvider {
  return {
    name: "ollama",
    parse: parseWithOllama,
  };
}

registerProvider("OLLAMA_BASE_URL", createOllamaProvider);

async function parseWithOllama(
  input: string,
  categories: string[],
  accounts: string[]
): Promise<ParseResult> {
  const startTime = Date.now();
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

  const parts = splitTransactions(input);
  const isMulti = parts.length > 1;
  const prompt = buildParsePrompt(input, categories, accounts, isMulti);

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2",
        messages: [
          { role: "system", content: "You are a financial transaction parser. Respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: isMulti ? 1000 : 200,
        },
      }),
    });

    const data = await response.json();
    const content = data.message?.content;

    if (!content) {
      return {
        success: false,
        error: "No response from Ollama",
        provider: "ollama",
        model: "llama3.2",
        latencyMs: Date.now() - startTime,
      };
    }

    const jsonMatch = content.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;

    return parseAIResponse(jsonStr, "ollama", "llama3.2", Date.now() - startTime);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect to Ollama",
      provider: "ollama",
      model: "llama3.2",
      latencyMs: Date.now() - startTime,
    };
  }
}
