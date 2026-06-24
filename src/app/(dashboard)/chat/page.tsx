"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import {
  Bot,
  Send,
  User,
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  RefreshCw,
  Sparkles,
  Loader2,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  "How much did I spend this month?",
  "What are my top expense categories?",
  "Am I saving enough?",
  "Review my subscriptions",
  "Show my spending trend",
  "Tips to save money",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hi! I'm your AI financial assistant. I can help you understand your spending, suggest savings, and answer questions about your finances. What would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const { data: netWorth } = trpc.account.netWorth.useQuery();
  const { data: monthly } = trpc.transaction.monthlySummary.useQuery({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });
  const { data: transactions } = trpc.transaction.list.useQuery({ limit: 50 });
  const { data: subscriptions } = trpc.subscription.list.useQuery();
  const { data: accounts } = trpc.account.list.useQuery();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateResponse = (userMessage: string): string => {
    const lower = userMessage.toLowerCase();
    const balance = netWorth?.netWorth ?? 0;
    const income = monthly?.income ?? 0;
    const expense = monthly?.expense ?? 0;
    const savings = monthly?.savings ?? 0;
    const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;

    // Net worth / balance
    if (
      lower.includes("balance") ||
      lower.includes("net worth") ||
      lower.includes("total")
    ) {
      return `Your current net worth is ৳${balance.toLocaleString()}. This is calculated from all your accounts minus credit card balances.`;
    }

    // Monthly summary
    if (
      lower.includes("spend") ||
      lower.includes("expense") ||
      lower.includes("this month")
    ) {
      return `This month:\n- Income: ৳${income.toLocaleString()}\n- Expenses: ৳${expense.toLocaleString()}\n- Net: ৳${savings.toLocaleString()}\n\nYou've saved ${savingsRate}% of your income this month.`;
    }

    // Income
    if (lower.includes("income") || lower.includes("earn") || lower.includes("salary")) {
      return `Your income this month is ৳${income.toLocaleString()}. ${savingsRate >= 20 ? "Great job maintaining a healthy savings rate!" : "Consider ways to increase your income or reduce expenses."}`;
    }

    // Savings
    if (lower.includes("saving") || lower.includes("save")) {
      const savingsGoal = income * 0.2;
      return `You've saved ৳${savings.toLocaleString()} this month (${savingsRate}% savings rate).\n\n${savingsRate >= 20 ? "Excellent! You're meeting the 20% savings benchmark." : `To reach the 20% goal, you'd need to save ৳${(savingsGoal - savings).toLocaleString()} more.`}`;
    }

    // Subscriptions
    if (lower.includes("subscription") || lower.includes("recurring")) {
      const subCount = subscriptions?.length ?? 0;
      const activeSubs = subscriptions?.filter((s) => s.status === "ACTIVE") ?? [];
      if (activeSubs.length === 0) {
        return "You don't have any active subscriptions tracked. Add them in the Subscriptions tab to monitor recurring expenses.";
      }
      const totalMonthly = activeSubs.reduce((sum, s) => {
        const amt = Number(s.amount);
        if (s.billingCycle === "YEARLY") return sum + amt / 12;
        if (s.billingCycle === "QUARTERLY") return sum + amt / 3;
        return sum + amt;
      }, 0);
      const list = activeSubs.map((s) => `- ${s.name}: ৳${Number(s.amount)}/${s.billingCycle.toLowerCase()}`).join("\n");
      return `You have ${activeSubs.length} active subscriptions totaling ~৳${Math.round(totalMonthly).toLocaleString()}/month:\n\n${list}\n\nConsider if all are still needed.`;
    }

    // Categories / top spending
    if (lower.includes("category") || lower.includes("top") || lower.includes("where")) {
      const txs = (transactions?.transactions ?? []) as any[];
      const categoryTotals: Record<string, number> = {};
      txs
        .filter((t: any) => t.type === "EXPENSE")
        .forEach((t: any) => {
          const cat = t.category?.name || "Other";
          categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount);
        });

      const sorted = Object.entries(categoryTotals)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      if (sorted.length === 0) {
        return "No expense data available yet. Start adding transactions to see category breakdowns.";
      }

      const breakdown = sorted
        .map(([cat, amt], i) => `${i + 1}. ${cat}: ৳${amt.toLocaleString()}`)
        .join("\n");
      return `Your top spending categories:\n\n${breakdown}\n\nTotal tracked: ৳${expense.toLocaleString()}`;
    }

    // Accounts
    if (lower.includes("account") || lower.includes("bkash") || lower.includes("bank")) {
      const accs = accounts ?? [];
      if (accs.length === 0) {
        return "No accounts added yet. Go to Accounts to add your first one.";
      }
      const list = accs.map((a) => `- ${a.name} (${a.type}): ৳${Number(a.balance).toLocaleString()}`).join("\n");
      return `Your accounts:\n\n${list}\n\nTotal: ৳${balance.toLocaleString()}`;
    }

    // Tips
    if (lower.includes("tip") || lower.includes("advice") || lower.includes("suggest")) {
      const tips = [];
      if (savingsRate < 20) tips.push("Try to save at least 20% of your income.");
      if (expense > income) tips.push("You're spending more than you earn. Review your expenses.");
      const subCost = subscriptions?.filter((s) => s.status === "ACTIVE").length ?? 0;
      if (subCost > 3) tips.push("You have many subscriptions. Consider cancelling unused ones.");
      tips.push("Track all expenses to identify spending patterns.");
      tips.push("Set budget limits for each category.");
      return `Here are some tips:\n\n${tips.map((t, i) => `${i + 1}. ${t}`).join("\n")}`;
    }

    // Trend
    if (lower.includes("trend") || lower.includes("pattern")) {
      return `Based on your recent data:\n- Monthly income: ৳${income.toLocaleString()}\n- Monthly expenses: ৳${expense.toLocaleString()}\n- Savings rate: ${savingsRate}%\n\n${savingsRate > 20 ? "You're on a healthy financial path!" : "Focus on reducing expenses to improve your savings rate."}`;
    }

    // Default response
    return `I can help you with:\n- **Balance/Net Worth** - Your current financial position\n- **Monthly Summary** - Income vs expenses\n- **Categories** - Where you spend the most\n- **Subscriptions** - Recurring payments\n- **Accounts** - All your accounts\n- **Tips** - Personalized financial advice\n- **Trends** - Spending patterns\n\nTry asking about any of these!`;
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Simulate AI thinking
    setTimeout(() => {
      const response = generateResponse(input);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 800);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6" />
            AI Assistant
          </h1>
          <p className="text-muted-foreground">
            Your personal financial advisor
          </p>
        </div>
        <Badge variant="secondary">
          <Sparkles className="w-3 h-3 mr-1" />
          AI Powered
        </Badge>
      </div>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    message.role === "user"
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  }`}
                >
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {message.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg p-3">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        {/* Suggestions */}
        {messages.length <= 2 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-muted-foreground mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestionClick(s)}
                  className="text-xs"
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder="Ask about your finances..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isTyping) {
                  handleSend();
                }
              }}
              disabled={isTyping}
            />
            <Button onClick={handleSend} disabled={!input.trim() || isTyping}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
