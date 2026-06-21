import { ParsedTransaction, ParseResult } from "../types";

export async function parseWithOpenAI(
  input: string,
  categories: string[],
  accounts: string[]
): Promise<ParseResult> {
  const startTime = Date.now();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: "OpenAI API key not configured",
      provider: "openai",
      model: "gpt-4o-mini",
      latencyMs: Date.now() - startTime,
    };
  }

  const currentDate = new Date().toISOString().split("T")[0];

  const prompt = `Parse this transaction: "${input}"

Current date: ${currentDate}
Available categories: ${categories.join(", ")}
Available accounts: ${accounts.join(", ")}

Return ONLY a JSON object:
{
  "type": "INCOME" | "EXPENSE",
  "amount": number,
  "description": "string",
  "category": "string",
  "account": "string or null",
  "date": "YYYY-MM-DD",
  "confidence": number (0-1)
}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a financial transaction parser. Respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return {
        success: false,
        error: "No response from OpenAI",
        provider: "openai",
        model: "gpt-4o-mini",
        latencyMs: Date.now() - startTime,
      };
    }

    const parsed = JSON.parse(content) as ParsedTransaction;

    return {
      success: true,
      transaction: parsed,
      provider: "openai",
      model: "gpt-4o-mini",
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse",
      provider: "openai",
      model: "gpt-4o-mini",
      latencyMs: Date.now() - startTime,
    };
  }
}
