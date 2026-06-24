import { ParseResult, ParsedTransaction } from "./types";
import { getActiveProvider, AIProvider } from "./providers";
import { parseWithRegex } from "./regex";

// Import all providers to register them
import "./providers/openai";
import "./providers/anthropic";
import "./providers/gemini";
import "./providers/groq";
import "./providers/deepseek";
import "./providers/mistral";
import "./providers/openrouter";
import "./providers/opencode-zen";
import "./providers/ollama";
import "./providers/custom";

export async function parseTransaction(
  input: string,
  categories: string[],
  accounts: string[]
): Promise<ParseResult> {
  const startTime = Date.now();

  // Try active AI provider
  const provider = getActiveProvider();
  if (provider) {
    try {
      const result = await provider.parse(input, categories, accounts);
      if (result.success) return result;
    } catch (error) {
      console.warn(`Provider ${provider.name} failed:`, error);
    }
  }

  // Fallback to regex
  return parseWithRegex(input, categories, accounts);
}
