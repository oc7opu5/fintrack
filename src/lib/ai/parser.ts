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
    /\b(spent|paid|bought|purchased|cost|expense|lunch|dinner|breakfast|groceries|uber|taxi|food|rent|bill|subscription|deal|charge|fee)\b/i.test(
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

  // Extract description
  let description = normalizedInput
    .replace(/\$|€|£|৳|bdt|taka|tk/gi, "")
    .replace(/spent|paid|bought|earned|received|got|on|for|from|via|through|with|worth|expense|income|charge|fee/gi, "")
    .replace(/\d+(?:,\d{3})*(?:\.\d{1,2})?/, "")
    .replace(/\s+/g, " ")
    .trim();

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

  // Match category
  const categoryKeywords: Record<string, string[]> = {
    "Food & Dining": ["lunch", "dinner", "breakfast", "food", "meal", "snack", "restaurant", "cafe", "coffee"],
    Transportation: ["uber", "taxi", "bus", "train", "fuel", "gas", "parking", "transport", "ride"],
    Shopping: ["bought", "shopping", "store", "mall", "online", "purchase"],
    "Bills & Utilities": ["bill", "electricity", "water", "internet", "phone", "recharge"],
    Entertainment: ["movie", "netflix", "spotify", "game", "entertainment"],
    Healthcare: ["doctor", "medicine", "hospital", "pharmacy", "health"],
    Education: ["book", "course", "tuition", "education", "learning"],
    Subscriptions: ["subscription", "monthly", "yearly", "plan", "deal", "lifetime"],
    Salary: ["salary", "wage", "pay"],
    Freelance: ["freelance", "client", "project", "contract"],
    "Other Income": ["bonus", "got", "win", "prize", "refund", "cashback"],
  };

  let matchedCategory: string | undefined;
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((k) => normalizedInput.includes(k))) {
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
