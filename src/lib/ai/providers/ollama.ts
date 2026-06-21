import { ParsedTransaction, ParseResult } from "../types";

export async function parseWithOllama(
  input: string,
  categories: string[],
  accounts: string[]
): Promise<ParseResult> {
  const startTime = Date.now();
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

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
          num_predict: 200,
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

    // Extract JSON from response (Ollama may include extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        error: "Invalid response format from Ollama",
        provider: "ollama",
        model: "llama3.2",
        latencyMs: Date.now() - startTime,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as ParsedTransaction;

    return {
      success: true,
      transaction: parsed,
      provider: "ollama",
      model: "llama3.2",
      latencyMs: Date.now() - startTime,
    };
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
