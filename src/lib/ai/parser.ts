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

  // Detect type - "spent" and similar words always mean expense
  const isExpense =
    /\b(spent|paid|bought|purchased|cost|expense|lunch|dinner|breakfast|groceries|uber|taxi|food|rent|bill|subscription|deal)\b/i.test(
      normalizedInput
    );
  const isIncome =
    /\b(earned|received|salary|income|freelance|refund|cashback|bonus)\b/i.test(
      normalizedInput
    );

  const type = isIncome && !isExpense ? "INCOME" : "EXPENSE";

  // Extract amount - handle $ symbol and commas
  const amountMatch = normalizedInput.match(
    /[\$]?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/
  );
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : 0;

  // Extract description (everything except amount, currency symbols, and keywords)
  let description = normalizedInput
    .replace(/\$|€|£|৳|bdt/gi, "")
    .replace(/spent|paid|bought|earned|received|on|for|from|via|through/gi, "")
    .replace(/\d+(?:,\d{3})*(?:\.\d{1,2})?/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!description) {
    description = type === "INCOME" ? "Income" : "Expense";
  }

  // Match account - try to find the best matching account from user's actual accounts
  let account: string | undefined;
  const accountKeywords: Record<string, string[]> = {
    BKASH: ["bkash", "b kash"],
    NAGAD: ["nagad"],
    ROCKET: ["rocket"],
    MOBILE_BANKING: ["mobile banking", "mbanking"],
    CREDIT_CARD: ["credit card", "card"],
    CASH: ["cash"],
  };

  // First try to match by keyword, then map to actual account name
  for (const [key, patterns] of Object.entries(accountKeywords)) {
    if (patterns.some((p) => normalizedInput.includes(p))) {
      // Find the user's actual account that matches this type
      const matchedAccount = accounts.find((a) =>
        a.toLowerCase().includes(key.toLowerCase().replace("_", " ")) ||
        patterns.some((p) => a.toLowerCase().includes(p))
      );
      account = matchedAccount || accounts[0];
      break;
    }
  }

  // Match category based on keywords
  const categoryKeywords: Record<string, string[]> = {
    "Food & Dining": ["lunch", "dinner", "breakfast", "food", "meal", "restaurant", "cafe", "coffee"],
    Transportation: ["uber", "taxi", "bus", "train", "fuel", "gas", "parking", "transport"],
    Shopping: ["bought", "shopping", "store", "mall", "online"],
    "Bills & Utilities": ["bill", "electricity", "water", "internet", "phone", "recharge"],
    Entertainment: ["movie", "netflix", "spotify", "game", "entertainment"],
    Healthcare: ["doctor", "medicine", "hospital", "pharmacy", "health"],
    Education: ["book", "course", "tuition", "education", "learning"],
    Subscriptions: ["subscription", "monthly", "yearly", "plan"],
    "Credit Card": ["credit card", "card", "installment", "emi", "loan", "deal"],
    Salary: ["salary", "wage", "pay"],
    Freelance: ["freelance", "client", "project", "contract"],
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

  // Default: find an expense or income category that contains "other" but NOT "other income" for expenses
  if (!matchedCategory) {
    if (type === "INCOME") {
      matchedCategory = categories.find((c) => c.toLowerCase().includes("other income")) || categories[0];
    } else {
      matchedCategory = categories.find((c) => c.toLowerCase().includes("other") && !c.toLowerCase().includes("income")) || categories[0];
    }
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
