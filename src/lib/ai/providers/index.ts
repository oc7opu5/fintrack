import { ParsedTransaction, ParseResult } from "../types";

export interface AIProvider {
  name: string;
  parse(
    input: string,
    categories: string[],
    accounts: string[]
  ): Promise<ParseResult>;
}

// Shared prompt builder
export function buildParsePrompt(
  input: string,
  categories: string[],
  accounts: string[],
  isMulti: boolean
): string {
  const currentDate = new Date().toISOString().split("T")[0];
  const accountList = accounts.join(", ");
  const categoryList = categories.join(", ");

  if (isMulti) {
    return `Parse these transactions: "${input}"

Split into individual transactions. Current date: ${currentDate}
Available categories: ${categoryList}
Available accounts: ${accountList}

Return a JSON array:
[
  {
    "type": "INCOME" | "EXPENSE",
    "amount": number,
    "description": "string (short, meaningful)",
    "category": "string",
    "account": "string or null",
    "date": "YYYY-MM-DD",
    "confidence": number (0-1)
  }
]`;
  }

  return `Parse this transaction: "${input}"

Current date: ${currentDate}
Available categories: ${categoryList}
Available accounts: ${accountList}

Return ONLY a JSON object:
{
  "type": "INCOME" | "EXPENSE",
  "amount": number,
  "description": "string (short, meaningful)",
  "category": "string",
  "account": "string or null",
  "date": "YYYY-MM-DD",
  "confidence": number (0-1)
}`;
}

// Shared response parser
export function parseAIResponse(
  content: string,
  provider: string,
  model: string,
  latencyMs: number
): ParseResult {
  try {
    const parsed = JSON.parse(content);

    if (Array.isArray(parsed)) {
      return {
        success: parsed.length > 0,
        transaction: parsed[0],
        transactions: parsed,
        provider,
        model,
        latencyMs,
      };
    }

    return {
      success: true,
      transaction: parsed,
      transactions: [parsed],
      provider,
      model,
      latencyMs,
    };
  } catch {
    return {
      success: false,
      error: "Failed to parse AI response",
      provider,
      model,
      latencyMs,
    };
  }
}

// Split multi-transaction input
export function splitTransactions(input: string): string[] {
  const normalized = input
    .replace(/\band\b/gi, ",")
    .replace(/;/g, ",")
    .replace(/\n/g, ",")
    .replace(/,\s*,/g, ",")
    .trim();

  const parts = normalized
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 3 && /\d/.test(s));

  return parts.length > 0 ? parts : [input];
}

// Provider registry
const providerRegistry: Array<{
  envKey: string;
  create: () => AIProvider;
}> = [];

export function registerProvider(envKey: string, create: () => AIProvider) {
  providerRegistry.push({ envKey, create });
}

export function getActiveProvider(): AIProvider | null {
  // Check user preference first
  const preferred = process.env.AI_PROVIDER;
  if (preferred) {
    const found = providerRegistry.find(p => p.envKey === preferred || 
      preferred.toLowerCase().includes(p.envKey.toLowerCase()));
    if (found && process.env[found.envKey]) {
      return found.create();
    }
  }

  // Auto-detect first available
  for (const { envKey, create } of providerRegistry) {
    if (process.env[envKey]) {
      return create();
    }
  }

  return null;
}

export function getAvailableProviders(): string[] {
  return providerRegistry
    .filter(({ envKey }) => process.env[envKey])
    .map(({ envKey }) => envKey);
}
