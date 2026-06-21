import { ParseResult, ParsedTransaction } from "./types";
import { parseWithOpenAI } from "./providers/openai";
import { parseWithOllama } from "./providers/ollama";

// Fallback regex-based parser when no AI is available
function parseWithRegex(
  input: string,
  categories: string[],
  accounts: string[]
): ParseResult {
  const startTime = Date.now();
  const normalizedInput = input.toLowerCase().trim();

  // Detect type
  const isExpense =
    /spent|paid|bought|purchased|cost|expense|lunch|dinner|breakfast|groceries|uber|taxi|food|rent|bill/i.test(
      normalizedInput
    );
  const isIncome =
    /earned|received|salary|income|freelance|refund|cashback|bonus/i.test(
      normalizedInput
    );

  const type = isIncome ? "INCOME" : "EXPENSE";

  // Extract amount
  const amountMatch = normalizedInput.match(
    /(\d+(?:\.\d{1,2})?)/
  );
  const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

  // Extract description (everything except amount and keywords)
  let description = normalizedInput
    .replace(/spent|paid|bought|earned|received|on|for|from|via|through/gi, "")
    .replace(/\d+(?:\.\d{1,2})?/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!description) {
    description = type === "INCOME" ? "Income" : "Expense";
  }

  // Match account
  let account: string | undefined;
  const accountPatterns: Record<string, string[]> = {
    BKASH: ["bkash", "b kash"],
    NAGAD: ["nagad"],
    ROCKET: ["rocket"],
    MOBILE_BANKING: ["mobile banking", "mbanking"],
    CREDIT_CARD: ["credit card", "card"],
    CASH: ["cash"],
  };

  for (const [type, patterns] of Object.entries(accountPatterns)) {
    if (patterns.some((p) => normalizedInput.includes(p))) {
      account = type;
      break;
    }
  }

  // Match category based on keywords
  const categoryKeywords: Record<string, string[]> = {
    "Food & Dining": ["lunch", "dinner", "breakfast", "food", "meal", "restaurant", "cafe", "coffee"],
    Transportation: ["uber", "taxi", "bus", "train", "fuel", "gas", "parking", "transport"],
    Shopping: ["bought", "shopping", "store", "mall", "online"],
    "Bills & Utilities": ["bill", "electricity", "water", "gas", "internet", "phone", "recharge"],
    Entertainment: ["movie", "netflix", "spotify", "game", "entertainment"],
    Healthcare: ["doctor", "medicine", "hospital", "pharmacy", "health"],
    Education: ["book", "course", "tuition", "education", "learning"],
    Subscriptions: ["subscription", "monthly", "yearly", "plan"],
    Salary: ["salary", "wage", "pay"],
    Freelance: ["freelance", "client", "project", "contract"],
  };

  let matchedCategory: string | undefined;
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((k) => normalizedInput.includes(k))) {
      matchedCategory = categories.find((c) =>
        c.toLowerCase().includes(category.toLowerCase())
      ) || category;
      break;
    }
  }

  // Default to first matching category type
  if (!matchedCategory) {
    matchedCategory = type === "INCOME"
      ? categories.find((c) => c.toLowerCase().includes("other income")) || categories[0]
      : categories.find((c) => c.toLowerCase().includes("other")) || categories[0];
  }

  // Parse date
  const today = new Date();
  let date = today.toISOString().split("T")[0];

  if (/yesterday/i.test(normalizedInput)) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    date = yesterday.toISOString().split("T")[0];
  } else if (/today/i.test(normalizedInput)) {
    date = today.toISOString().split("T")[0];
  }

  const parsed: ParsedTransaction = {
    type,
    amount,
    description: description.charAt(0).toUpperCase() + description.slice(1),
    category: matchedCategory,
    account,
    date,
    confidence: amount > 0 ? 0.7 : 0.3,
  };

  return {
    success: amount > 0,
    transaction: parsed,
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
