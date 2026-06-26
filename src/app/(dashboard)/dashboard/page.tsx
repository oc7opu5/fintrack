"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Plus, ArrowLeftRight, RefreshCw, Bot } from "lucide-react";
import { formatCurrency, formatDate, getAccountTypeIcon } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";

type Transaction = { id: string; description: string; amount: string | number; type: "INCOME" | "EXPENSE" | "TRANSFER"; date: string | Date; account: { type: string; name: string }; category: { name: string } | null; };
type Subscription = { id: string; name: string; amount: string | number; billingCycle: string; nextBillingDate: string | Date | null; };

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const now = new Date();

  const { data: netWorth } = trpc.account.netWorth.useQuery();
  const { data: monthly } = trpc.transaction.monthlySummary.useQuery({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const { data: recentTx } = trpc.transaction.list.useQuery({ limit: 5 });
  const { data: subs } = trpc.subscription.list.useQuery();

  const transactions = (recentTx?.transactions ?? []) as Transaction[];
  const subscriptions = (subs ?? []) as Subscription[];
  const savingsPercent = monthly?.income ? Math.round((monthly.savings / monthly.income) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {session?.user?.name?.split(" ")[0] || "there"}!</h1>
          <p className="text-muted-foreground">Here&apos;s an overview of your finances</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => router.push("/transactions")}><Plus className="w-4 h-4 mr-1" />Add Transaction</Button>
          <Button size="sm" variant="outline" onClick={() => router.push("/chat")}><Bot className="w-4 h-4 mr-1" />AI Assistant</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Balance</CardTitle><Wallet className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(netWorth?.netWorth ?? 0)}</div><p className="text-xs text-muted-foreground">Across all accounts</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Income This Month</CardTitle><TrendingUp className="h-4 w-4 text-emerald-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-emerald-500">{formatCurrency(monthly?.income ?? 0)}</div><p className="text-xs text-muted-foreground">{monthly?.incomeCount ?? 0} transactions</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Expenses This Month</CardTitle><TrendingDown className="h-4 w-4 text-rose-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-rose-500">{formatCurrency(monthly?.expense ?? 0)}</div><p className="text-xs text-muted-foreground">{monthly?.expenseCount ?? 0} transactions</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Savings</CardTitle><PiggyBank className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(monthly?.savings ?? 0)}</div><p className="text-xs text-muted-foreground">{savingsPercent}% of income saved</p></CardContent></Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => router.push("/transactions")}><ArrowLeftRight className="w-5 h-5" /><span className="text-xs">Transactions</span></Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => router.push("/subscriptions")}><RefreshCw className="w-5 h-5" /><span className="text-xs">Subscriptions</span></Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => router.push("/reports")}><TrendingUp className="w-5 h-5" /><span className="text-xs">Reports</span></Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => router.push("/chat")}><Bot className="w-5 h-5" /><span className="text-xs">AI Chat</span></Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent Transactions</CardTitle></CardHeader>
          <CardContent>
            {transactions.length ? (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{getAccountTypeIcon(tx.account.type)}</span>
                      <div><p className="text-sm font-medium">{tx.description}</p><p className="text-xs text-muted-foreground">{tx.category?.name || tx.account.name} · {formatDate(tx.date)}</p></div>
                    </div>
                    <span className={tx.type === "INCOME" ? "text-emerald-500 font-medium" : "text-rose-500 font-medium"}>{tx.type === "INCOME" ? "+" : "-"}{formatCurrency(Number(tx.amount))}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-muted-foreground text-center py-8">No transactions yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Upcoming Subscriptions</CardTitle></CardHeader>
          <CardContent>
            {subscriptions.length ? (
              <div className="space-y-3">
                {subscriptions.slice(0, 5).map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">{sub.name}</p><p className="text-xs text-muted-foreground">{sub.billingCycle} · {sub.nextBillingDate ? formatDate(sub.nextBillingDate) : "N/A"}</p></div>
                    <span className="text-sm font-medium">{formatCurrency(Number(sub.amount))}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-muted-foreground text-center py-8">No subscriptions tracked yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
