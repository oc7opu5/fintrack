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
- Compare expenses across time periods (daily, weekly, monthly)
- Track subscription costs and suggest optimizations
- Provide personalized budget advice
- Explain financial concepts in simple terms
- Answer questions about specific transactions
- Calculate savings goals and progress
- Identify unusual spending patterns

RULES:
1. Always reference specific numbers from the financial data provided
2. Use BDT (৳) currency format
3. Be concise but actionable - prefer bullet points
4. When comparing periods, show percentage changes
5. For advice, provide 2-3 specific, actionable suggestions
6. Never fabricate data - only use what's provided in the context
7. If data is insufficient, say what additional info would help
8. Use simple language - avoid financial jargon unless explained

RESPONSE FORMAT:
- Start with a direct answer to the question
- Provide supporting data/numbers
- End with actionable next steps if applicable
- Use markdown formatting for readability`;

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
  accounts: Array<{ name: string; type: string; balance: number }>;
  transactions: Array<{
    description: string;
    amount: number;
    type: string;
    date: string | Date;
    category?: { name: string } | null;
    account?: { name: string } | null;
  }>;
  subscriptions: Array<{ name: string; amount: number; billingCycle: string }>;
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
  lines.push("💰 ACCOUNTS");
  for (const a of data.accounts) {
    lines.push(`- ${a.name} (${a.type}): ৳${a.balance.toLocaleString()}`);
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
