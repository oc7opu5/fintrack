import { ParseResult } from "../types";
import { AIProvider, buildParsePrompt, parseAIResponse, splitTransactions, registerProvider } from "./index";

export function createGeminiProvider(): AIProvider {
  return {
    name: "gemini",
    parse: parseWithGemini,
  };
}

registerProvider("GOOGLE_AI_API_KEY", createGeminiProvider);

async function parseWithGemini(
  input: string,
  categories: string[],
  accounts: string[]
): Promise<ParseResult> {
  const startTime = Date.now();
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: "Google AI API key not configured",
      provider: "gemini",
      model: "gemini-1.5-flash",
      latencyMs: Date.now() - startTime,
    };
  }

  const parts = splitTransactions(input);
  const isMulti = parts.length > 1;
  const prompt = buildParsePrompt(input, categories, accounts, isMulti);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: isMulti ? 1000 : 200,
          },
        }),
      }
    );

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      return {
        success: false,
        error: "No response from Gemini",
        provider: "gemini",
        model: "gemini-1.5-flash",
        latencyMs: Date.now() - startTime,
      };
    }

    const jsonMatch = content.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;

    return parseAIResponse(jsonStr, "gemini", "gemini-1.5-flash", Date.now() - startTime);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse",
      provider: "gemini",
      model: "gemini-1.5-flash",
      latencyMs: Date.now() - startTime,
    };
  }
}
