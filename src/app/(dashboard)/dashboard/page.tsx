"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Plus, Bot, CreditCard, Calendar, DollarSign, BarChart3, RefreshCw, AlertTriangle, Lightbulb, Bell } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from "recharts";

type Transaction = { id: string; description: string; amount: string | number; type: "INCOME" | "EXPENSE" | "TRANSFER"; date: string | Date; account: { type: string; name: string }; category: { name: string } | null; };
type Subscription = { id: string; name: string; amount: string | number; billingCycle: string; nextBillingDate: string | Date | null; };
type Insight = { id: string; type: string; title: string; content: string; severity: string; isRead: boolean };

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#FF6384", "#36A2EB", "#FF9F40"];

const SEVERITY_ICONS: Record<string, any> = {
  info: Lightbulb,
  warning: AlertTriangle,
  critical: Bell,
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const now = new Date();

  const { data: netWorth } = trpc.account.netWorth.useQuery();
  const { data: monthly } = trpc.transaction.monthlySummary.useQuery({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const { data: recentTx } = trpc.transaction.list.useQuery({ limit: 5 });
  const { data: subs } = trpc.subscription.list.useQuery();
  const { data: debtSummary } = trpc.debt.summary.useQuery();
  const { data: currencyList } = trpc.currency.list.useQuery();
  const { data: insights } = trpc.insight.list.useQuery({ unreadOnly: false });
  const generateInsights = trpc.insight.generate.useMutation();

  const transactions = (recentTx?.transactions ?? []) as Transaction[];
  const subscriptions = (subs ?? []) as Subscription[];
  const savingsPercent = monthly?.income ? Math.round((monthly.savings / monthly.income) * 100) : 0;

  const categoryData = (monthly as any)?.categories || [];
  const pieData = categoryData.map((c: any) => ({ name: c.name, value: c.amount }));

  const trendData = [
    { month: "Jan", income: 0, expense: 0 },
    { month: "Feb", income: 0, expense: 0 },
    { month: "Mar", income: 0, expense: 0 },
    { month: "Apr", income: 0, expense: 0 },
    { month: "May", income: 0, expense: 0 },
    { month: "Jun", income: monthly?.income || 0, expense: monthly?.expense || 0 },
  ];

  const debtCurveData = debtSummary?.strategy ? [
    { name: "Now", amount: debtSummary.totalOutstanding },
    ...Array.from({ length: 6 }, (_, i) => {
      const remaining = Math.max(0, debtSummary.totalOutstanding - (debtSummary.totalMonthlyDue * (i + 1)));
      return { name: `Month ${i + 1}`, amount: remaining };
    }),
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {session?.user?.name?.split(" ")[0] || "there"}!</h1>
          <p className="text-muted-foreground">Your MindLedger financial overview</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => router.push("/transactions")}><Plus className="w-4 h-4 mr-1" />Add Transaction</Button>
          <Button size="sm" variant="outline" onClick={() => router.push("/chat")}><Bot className="w-4 h-4 mr-1" />AI Chat</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Balance</CardTitle><Wallet className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(netWorth?.netWorth ?? 0)}</div><p className="text-xs text-muted-foreground">Across all accounts</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Income This Month</CardTitle><TrendingUp className="h-4 w-4 text-emerald-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-emerald-500">{formatCurrency(monthly?.income ?? 0)}</div><p className="text-xs text-muted-foreground">{monthly?.incomeCount ?? 0} transactions</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Expenses This Month</CardTitle><TrendingDown className="h-4 w-4 text-rose-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-rose-500">{formatCurrency(monthly?.expense ?? 0)}</div><p className="text-xs text-muted-foreground">{monthly?.expenseCount ?? 0} transactions</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Savings</CardTitle><PiggyBank className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(monthly?.savings ?? 0)}</div><p className="text-xs text-muted-foreground">{savingsPercent}% of income saved</p></CardContent></Card>
      </div>

      {debtSummary && debtSummary.debtCount > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-rose-500" /><p className="text-sm text-muted-foreground">Total Debt</p></div><p className="text-2xl font-bold text-rose-500">{formatCurrency(debtSummary.totalOutstanding)}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /><p className="text-sm text-muted-foreground">Due This Month</p></div><p className="text-2xl font-bold">{formatCurrency(debtSummary.totalMonthlyDue)}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-amber-500" /><p className="text-sm text-muted-foreground">Interest This Month</p></div><p className="text-2xl font-bold text-amber-500">{formatCurrency(debtSummary.totalInterestPortion)}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-muted-foreground" /><p className="text-sm text-muted-foreground">Active Debts</p></div><p className="text-2xl font-bold">{debtSummary.debtCount}</p><div className="flex gap-1 mt-1 flex-wrap">{(Object.entries(debtSummary.byType) as [string, number][]).filter(([, amt]) => amt > 0).map(([type, amt]) => (<Badge key={type} variant="outline" className="text-xs">{type.replace("_", " ")}: {formatCurrency(amt)}</Badge>))}</div></CardContent></Card>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="w-5 h-5" />Category Breakdown</CardTitle></CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={40} label={(props: any) => `${props.name || ''} ${props.percent ? (props.percent * 100).toFixed(0) : 0}%`}>
                    {pieData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(val: any) => formatCurrency(val as number)} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-center py-12">No category data yet</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5" />Spending Trend</CardTitle></CardHeader>
          <CardContent>
            {trendData.some(d => d.income > 0 || d.expense > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v: any) => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(val: any) => formatCurrency(val as number)} />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#10b981" name="Income" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="expense" stroke="#ef4444" name="Expense" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-center py-12">More data needed for trend</p>}
          </CardContent>
        </Card>

        {debtCurveData.length > 1 && (
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><CreditCard className="w-5 h-5" />Debt Paydown Projection</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={debtCurveData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v: any) => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(val: any) => formatCurrency(val as number)} />
                  <Area type="monotone" dataKey="amount" stroke="#8884d8" fill="#8884d8" fillOpacity={0.2} name="Remaining Balance" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {currencyList && currencyList.length > 1 && (
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><DollarSign className="w-5 h-5" />Multi-Currency Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {currencyList.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{c.symbol}</span>
                      <div>
                        <p className="font-medium">{c.code} - {c.name}</p>
                        <p className="text-xs text-muted-foreground">1 {c.code} = {Number(c.rateToBase).toLocaleString()} BDT</p>
                      </div>
                    </div>
                    <Badge variant={c.isBase ? "default" : "outline"}>{c.isBase ? "Base" : "Foreign"}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {insights && (insights as Insight[]).length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2"><Lightbulb className="w-5 h-5" />AI Insights</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => generateInsights.mutate()} disabled={generateInsights.isPending}>
              <RefreshCw className={`w-4 h-4 mr-1 ${generateInsights.isPending ? "animate-spin" : ""}`} />Refresh
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {(insights as Insight[]).slice(0, 4).map((insight) => {
                const Icon = SEVERITY_ICONS[insight.severity] || Lightbulb;
                const severityColor = insight.severity === "critical" ? "border-l-rose-500 bg-rose-50 dark:bg-rose-950/20" :
                  insight.severity === "warning" ? "border-l-amber-500 bg-amber-50 dark:bg-amber-950/20" : "border-l-blue-500 bg-blue-50 dark:bg-blue-950/20";
                return (
                  <div key={insight.id} className={`p-4 border-l-4 rounded-r-lg ${severityColor}`}>
                    <div className="flex items-start gap-2">
                      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{insight.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{insight.content}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 grid-cols-2 md:grid-cols-6">
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => router.push("/transactions")}><TrendingUp className="w-5 h-5" /><span className="text-xs">Transactions</span></Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => router.push("/subscriptions")}><RefreshCw className="w-5 h-5" /><span className="text-xs">Subscriptions</span></Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => router.push("/credit-cards")}><CreditCard className="w-5 h-5" /><span className="text-xs">Debt Tracker</span></Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => router.push("/reports")}><BarChart3 className="w-5 h-5" /><span className="text-xs">Reports</span></Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => router.push("/chat")}><Bot className="w-5 h-5" /><span className="text-xs">AI Chat</span></Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => router.push("/budget")}><PiggyBank className="w-5 h-5" /><span className="text-xs">Budget</span></Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Recent Transactions</CardTitle><Button variant="ghost" size="sm" onClick={() => router.push("/transactions")}>View All</Button></CardHeader>
          <CardContent>
            {transactions.length ? <div className="space-y-3">{transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm">{tx.type === "INCOME" ? "💰" : "💸"}</div>
                  <div><p className="text-sm font-medium">{tx.description}</p><p className="text-xs text-muted-foreground">{tx.category?.name || tx.account.name} · {formatDate(tx.date)}</p></div>
                </div>
                <span className={tx.type === "INCOME" ? "text-emerald-500 font-medium text-sm" : "text-rose-500 font-medium text-sm"}>{tx.type === "INCOME" ? "+" : "-"}{formatCurrency(Number(tx.amount))}</span>
              </div>
            ))}</div> : <p className="text-muted-foreground text-center py-8">No transactions yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Upcoming Subscriptions</CardTitle><Button variant="ghost" size="sm" onClick={() => router.push("/subscriptions")}>View All</Button></CardHeader>
          <CardContent>
            {subscriptions.length ? <div className="space-y-3">{subscriptions.slice(0, 5).map((sub) => (
              <div key={sub.id} className="flex items-center justify-between">
                <div><p className="text-sm font-medium">{sub.name}</p><p className="text-xs text-muted-foreground">{sub.billingCycle} · {sub.nextBillingDate ? formatDate(sub.nextBillingDate) : "N/A"}</p></div>
                <span className="text-sm font-medium">{formatCurrency(Number(sub.amount))}</span>
              </div>
            ))}</div> : <p className="text-muted-foreground text-center py-8">No subscriptions tracked yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
