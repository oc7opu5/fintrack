import { ParseResult, ParsedTransaction } from "./types";
import { parseWithOpenAI } from "./providers/openai";
import { parseWithOllama } from "./providers/ollama";

// Split multi-transaction input into individual statements
function splitTransactions(input: string): string[] {
  // Split by commas, "and", semicolons, or newlines
  const normalized = input
    .replace(/\band\b/gi, ",")
    .replace(/;/g, ",")
    .replace(/\n/g, ",")
    .replace(/,\s*,/g, ",")
    .trim();

  const parts = normalized
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 3 && /\d/.test(s)); // Must have numbers and be meaningful

  return parts.length > 0 ? parts : [input];
}

// Fallback regex-based parser when no AI is available
function parseSingleTransaction(
  input: string,
  categories: string[],
  accounts: string[]
): ParsedTransaction | null {
  const normalizedInput = input.toLowerCase().trim();

  // Detect type - "spent" and similar words always mean expense
  const isExpense =
    /\b(spent|paid|bought|purchased|cost|expense|lunch|dinner|breakfast|groceries|uber|taxi|food|rent|bill|subscription|deal|charge|fee|snack|ride)\b/i.test(
      normalizedInput
    );
  const isIncome =
    /\b(earned|received|salary|income|freelance|refund|cashback|bonus|got|win|prize)\b/i.test(
      normalizedInput
    );

  const type = isIncome && !isExpense ? "INCOME" : "EXPENSE";

  // Extract amount - handle $, ৳, "taka", "bdt" symbols
  const amountMatch = normalizedInput.match(
    /[\$৳]?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:taka|bdt|tk)?/
  );
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : 0;

  if (amount === 0) return null;

  // Smart description extraction
  let description = "";
  
  // Try to find meaningful description after removing noise words
  const noisePatterns = [
    /\b(spent|paid|bought|earned|received|got|on|for|from|via|through|with|worth|expense|income|charge|fee|a|the|an)\b/gi,
    /\$|€|£|৳|bdt|taka|tk/gi,
    /\d+(?:,\d{3})*(?:\.\d{1,2})?/g,
  ];

  let cleaned = input;
  for (const pattern of noisePatterns) {
    cleaned = cleaned.replace(pattern, " ");
  }
  
  // Extract key nouns from cleaned text
  const words = cleaned.split(/\s+/).filter(w => w.length > 2);
  
  // Build description from meaningful words
  const stopWords = new Set(["the", "and", "with", "for", "from", "via", "through", "was", "were", "has", "had"]);
  const meaningfulWords = words.filter(w => !stopWords.has(w.toLowerCase()));
  
  if (meaningfulWords.length > 0) {
    description = meaningfulWords.slice(0, 4).join(" ");
  }

  if (!description) {
    description = type === "INCOME" ? "Income" : "Expense";
  }

  // Match account
  let account: string | undefined;
  const accountKeywords: Record<string, string[]> = {
    BKASH: ["bkash", "b kash"],
    NAGAD: ["nagad"],
    ROCKET: ["rocket"],
    CREDIT_CARD: ["credit card", "card", "cc"],
    CASH: ["cash"],
  };

  for (const [key, patterns] of Object.entries(accountKeywords)) {
    if (patterns.some((p) => normalizedInput.includes(p))) {
      const matchedAccount = accounts.find((a) =>
        a.toLowerCase().includes(key.toLowerCase().replace("_", " ")) ||
        patterns.some((p) => a.toLowerCase().includes(p))
      );
      account = matchedAccount || accounts[0];
      break;
    }
  }

  // Match category - check specific patterns first, then general
  let matchedCategory: string | undefined;
  
  // Priority order: check more specific patterns first
  const categoryPatterns: Array<[string, RegExp]> = [
    ["Subscriptions", /\b(subscription|lifetime|deal|monthly|yearly|plan)\b/i],
    ["Food & Dining", /\b(lunch|dinner|breakfast|food|meal|snack|restaurant|cafe|coffee)\b/i],
    ["Transportation", /\b(uber|taxi|bus|train|fuel|gas|parking|transport|ride|ride-sharing)\b/i],
    ["Shopping", /\b(bought|shopping|store|mall|online|purchase)\b/i],
    ["Bills & Utilities", /\b(bill|electricity|water|internet|phone|recharge)\b/i],
    ["Entertainment", /\b(movie|netflix|spotify|game|entertainment)\b/i],
    ["Healthcare", /\b(doctor|medicine|hospital|pharmacy|health)\b/i],
    ["Education", /\b(book|course|tuition|education|learning)\b/i],
    ["Salary", /\b(salary|wage|pay)\b/i],
    ["Freelance", /\b(freelance|client|project|contract)\b/i],
    ["Other Income", /\b(bonus|got|win|prize|refund|cashback)\b/i],
  ];

  for (const [category, pattern] of categoryPatterns) {
    if (pattern.test(normalizedInput)) {
      matchedCategory = categories.find((c) =>
        c.toLowerCase().includes(category.toLowerCase())
      );
      break;
    }
  }

  if (!matchedCategory) {
    matchedCategory = type === "INCOME"
      ? categories.find((c) => c.toLowerCase().includes("other income")) || categories[0]
      : categories.find((c) => c.toLowerCase().includes("other") && !c.toLowerCase().includes("income")) || categories[0];
  }

  const today = new Date();
  let date = today.toISOString().split("T")[0];

  if (/yesterday/i.test(normalizedInput)) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    date = yesterday.toISOString().split("T")[0];
  }

  return {
    type,
    amount,
    description: description.charAt(0).toUpperCase() + description.slice(1),
    category: matchedCategory,
    account,
    date,
    confidence: amount > 0 ? 0.7 : 0.3,
  };
}

function parseWithRegex(
  input: string,
  categories: string[],
  accounts: string[]
): ParseResult {
  const startTime = Date.now();
  const parts = splitTransactions(input);

  if (parts.length === 1) {
    const parsed = parseSingleTransaction(parts[0], categories, accounts);
    return {
      success: !!parsed,
      transaction: parsed || undefined,
      transactions: parsed ? [parsed] : undefined,
      provider: "regex",
      model: "regex-fallback",
      latencyMs: Date.now() - startTime,
    };
  }

  const transactions: ParsedTransaction[] = [];
  for (const part of parts) {
    const parsed = parseSingleTransaction(part, categories, accounts);
    if (parsed) transactions.push(parsed);
  }

  return {
    success: transactions.length > 0,
    transaction: transactions[0],
    transactions,
    provider: "regex",
    model: "regex-fallback",
    latencyMs: Date.now() - startTime,
  };
}

export async function parseTransaction(
  input: string,
  categories: string[],
  accounts: string[]
): Promise<ParseResult> {
  // Try OpenAI first
  if (process.env.OPENAI_API_KEY) {
    const result = await parseWithOpenAI(input, categories, accounts);
    if (result.success) return result;
  }

  // Try Ollama second
  if (process.env.OLLAMA_BASE_URL) {
    const result = await parseWithOllama(input, categories, accounts);
    if (result.success) return result;
  }

  // Fallback to regex
  return parseWithRegex(input, categories, accounts);
}
