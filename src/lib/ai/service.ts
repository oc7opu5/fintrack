// Unified AI Service for FinTrack
// Handles both transaction parsing and chat

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  success: boolean;
  content?: string;
  provider: string;
  model: string;
  latencyMs: number;
  error?: string;
}

// System prompt for financial assistant chat
export const FINANCIAL_ASSISTANT_SYSTEM_PROMPT = `You are FinTrack AI, a professional financial assistant for Bangladeshi users.

CAPABILITIES:
- Analyze spending patterns and identify trends
- Compare expenses across time periods
- Track subscription costs and suggest optimizations
- Provide personalized budget advice
- ADD/REMOVE/EDIT transactions when user asks

TRANSACTION MANAGEMENT:
When user asks to add/remove/edit transactions, you MUST use the available accounts and categories listed in the financial data.

ADDING a transaction:
[ACTION:ADD]
{
  "type": "EXPENSE" or "INCOME",
  "amount": number,
  "description": "short description",
  "category": "exact category name from list",
  "account": "exact account name from list"
}
[/ACTION]

REMOVING a transaction:
[ACTION:DELETE]
{
  "description": "transaction description to match"
}
[/ACTION]

IMPORTANT RULES FOR ACTIONS:
1. ALWAYS use EXACT account names from "AVAILABLE ACCOUNTS" list
2. ALWAYS use EXACT category names from "AVAILABLE CATEGORIES" list
3. If user says "bKash", use the account that contains "bKash" in its name
4. If user says "subscription", use category "Subscriptions" or match closest
5. If user says "food/lunch/dinner", use "Food & Dining"
6. If user says "transport/ride/uber", use "Transportation"
7. If unsure which account, use the default account (marked as default)
8. NEVER make up account or category names - only use what's provided

ANALYSIS RULES:
1. Reference specific numbers from financial data
2. Use BDT (৳) currency
3. Be concise with bullet points
4. Show percentage changes when comparing
5. Provide 2-3 actionable suggestions
6. Use markdown formatting

NON-FINANCIAL:
If asked about yourself, answer directly.`;

// System prompt for transaction parsing
export const TRANSACTION_PARSER_PROMPT = `You are a financial transaction parser. Extract structured transaction data from natural language input.

Return ONLY valid JSON. No explanations.

For single transaction:
{
  "type": "INCOME" | "EXPENSE",
  "amount": number,
  "description": "string (short, meaningful)",
  "category": "string",
  "account": "string or null",
  "date": "YYYY-MM-DD",
  "confidence": number (0-1)
}

For multiple transactions (comma-separated input):
[
  { ... },
  { ... }
]`;

// Build chat messages with conversation history
export function buildChatMessages(
  userMessage: string,
  financialContext: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): AIMessage[] {
  const messages: AIMessage[] = [
    { role: "system", content: FINANCIAL_ASSISTANT_SYSTEM_PROMPT },
  ];

  // Add financial context as first user message if no history
  if (conversationHistory.length === 0) {
    messages.push({
      role: "user",
      content: `Here is my financial data:\n\n${financialContext}`,
    });
    messages.push({
      role: "assistant",
      content: "I've reviewed your financial data. I'm ready to help you analyze your spending, track subscriptions, or answer any questions about your finances. What would you like to know?",
    });
  }

  // Add conversation history (last 10 messages)
  const recentHistory = conversationHistory.slice(-10);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    });
  }

  // Add current message with financial context
  messages.push({
    role: "user",
    content: `My financial data:\n${financialContext}\n\nMy question: ${userMessage}`,
  });

  return messages;
}

// Build financial context string (summarized, not raw)
export function buildFinancialContext(data: {
  accounts: Array<{ name: string; type: string; balance: number; isDefault?: boolean }>;
  transactions: Array<{
    description: string;
    amount: number;
    type: string;
    date: string | Date;
    category?: { name: string } | null;
    account?: { name: string } | null;
  }>;
  subscriptions: Array<{ name: string; amount: number; billingCycle: string }>;
  categories: Array<{ name: string; type: string }>;
  monthlyIncome: number;
  monthlyExpense: number;
  previousMonthIncome?: number;
  previousMonthExpense?: number;
}): string {
  const totalBalance = data.accounts.reduce((sum, a) => sum + a.balance, 0);
  const savingsRate = data.monthlyIncome > 0
    ? Math.round(((data.monthlyIncome - data.monthlyExpense) / data.monthlyIncome) * 100)
    : 0;

  // Category breakdown
  const categoryTotals: Record<string, number> = {};
  data.transactions
    .filter((t) => t.type === "EXPENSE")
    .forEach((t) => {
      const cat = t.category?.name || "Other";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
    });

  const topCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Daily average spending
  const now = new Date();
  const daysInMonth = now.getDate();
  const dailyAvg = daysInMonth > 0 ? Math.round(data.monthlyExpense / daysInMonth) : 0;

  // Subscription monthly cost
  const subMonthlyCost = data.subscriptions.reduce((sum, s) => {
    if (s.billingCycle === "YEARLY") return sum + s.amount / 12;
    if (s.billingCycle === "QUARTERLY") return sum + s.amount / 3;
    return sum + s.amount;
  }, 0);

  // Trend vs last month
  let trend = "";
  if (data.previousMonthExpense && data.previousMonthExpense > 0) {
    const change = Math.round(((data.monthlyExpense - data.previousMonthExpense) / data.previousMonthExpense) * 100);
    trend = change > 0
      ? `Spending ${change}% higher than last month`
      : change < 0
      ? `Spending ${Math.abs(change)}% lower than last month`
      : "Spending same as last month";
  }

  // Recent transactions summary (last 5)
  const recentTx = data.transactions.slice(0, 5).map((t) => {
    const date = new Date(t.date).toLocaleDateString("en-BD", { month: "short", day: "numeric" });
    return `${date}: ${t.description} (${t.type === "INCOME" ? "+" : "-"}৳${t.amount.toLocaleString()})`;
  }).join("\n");

  const lines = [
    "=== FINANCIAL SUMMARY ===",
    "",
    "📊 BALANCE & SAVINGS",
    `Total Balance: ৳${totalBalance.toLocaleString()}`,
    `Monthly Income: ৳${data.monthlyIncome.toLocaleString()}`,
    `Monthly Expenses: ৳${data.monthlyExpense.toLocaleString()}`,
    `Savings Rate: ${savingsRate}%`,
    `Daily Avg Spending: ৳${dailyAvg.toLocaleString()}`,
  ];

  if (trend) lines.push(`Trend: ${trend}`);

  lines.push("");
  lines.push("💰 AVAILABLE ACCOUNTS (use exact names for transactions)");
  for (const a of data.accounts) {
    lines.push(`- "${a.name}" (${a.type}): ৳${a.balance.toLocaleString()}${a.isDefault ? " [DEFAULT]" : ""}`);
  }

  lines.push("");
  lines.push("📂 AVAILABLE CATEGORIES (use exact names for transactions)");
  for (const c of data.categories) {
    lines.push(`- "${c.name}" (${c.type})`);
  }

  if (topCategories.length > 0) {
    lines.push("");
    lines.push("📂 TOP EXPENSE CATEGORIES");
    for (const [cat, amt] of topCategories) {
      const pct = data.monthlyExpense > 0 ? Math.round((amt / data.monthlyExpense) * 100) : 0;
      lines.push(`- ${cat}: ৳${amt.toLocaleString()} (${pct}%)`);
    }
  }

  if (data.subscriptions.length > 0) {
    lines.push("");
    lines.push(`🔄 SUBSCRIPTIONS (${data.subscriptions.length} active)`);
    lines.push(`Monthly Cost: ৳${Math.round(subMonthlyCost).toLocaleString()}`);
    for (const s of data.subscriptions.slice(0, 5)) {
      lines.push(`- ${s.name}: ৳${s.amount.toLocaleString()}/${s.billingCycle.toLowerCase()}`);
    }
  }

  if (recentTx) {
    lines.push("");
    lines.push("📝 RECENT TRANSACTIONS");
    lines.push(recentTx);
  }

  return lines.join("\n");
}

// Estimate token count (rough: 1 token ≈ 4 chars)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Truncate context to fit within token limits
export function truncateContext(context: string, maxTokens: number = 3000): string {
  const estimatedTokens = estimateTokens(context);
  if (estimatedTokens <= maxTokens) return context;

  // Truncate to fit
  const maxChars = maxTokens * 4;
  const truncated = context.substring(0, maxChars);
  const lastNewline = truncated.lastIndexOf("\n");
  return truncated.substring(0, lastNewline > 0 ? lastNewline : maxChars) + "\n... (truncated)";
}
