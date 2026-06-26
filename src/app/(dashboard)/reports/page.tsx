"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  ArrowRight,
  PieChart,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function ReportsPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const { data: monthlyData, isLoading } = trpc.transaction.monthlySummary.useQuery({ year: selectedYear, month: selectedMonth });
  const { data: prevData } = trpc.transaction.monthlySummary.useQuery({
    year: selectedMonth === 1 ? selectedYear - 1 : selectedYear,
    month: selectedMonth === 1 ? 12 : selectedMonth - 1,
  });
  const { data: txData } = trpc.transaction.list.useQuery({ limit: 200, dateFrom: new Date(selectedYear, selectedMonth - 1, 1), dateTo: new Date(selectedYear, selectedMonth, 0, 23, 59, 59) });

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const daysPassed = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1 ? now.getDate() : daysInMonth;
  const daysRemaining = daysInMonth - daysPassed;

  const savingsRate = monthlyData && monthlyData.income > 0 ? ((monthlyData.savings / monthlyData.income) * 100).toFixed(1) : "0";

  // Category breakdown
  const categoryTotals: Record<string, number> = {};
  const txList = (txData?.transactions || []) as any[];
  txList.filter((t: any) => t.type === "EXPENSE").forEach((t: any) => {
    const cat = t.category?.name || "Other";
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount);
  });
  const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);
  const maxCatAmount = sortedCategories[0]?.[1] || 1;

  // Trend
  const expenseTrend = prevData && prevData.expense > 0 ? (((monthlyData?.expense || 0) - prevData.expense) / prevData.expense * 100).toFixed(1) : null;
  const incomeTrend = prevData && prevData.income > 0 ? (((monthlyData?.income || 0) - prevData.income) / prevData.income * 100).toFixed(1) : null;

  const prevMonth = () => { if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(selectedYear - 1); } else { setSelectedMonth(selectedMonth - 1); } };
  const nextMonth = () => { if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(selectedYear + 1); } else { setSelectedMonth(selectedMonth + 1); } };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Reports</h1><p className="text-muted-foreground">Analyze your financial data</p></div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-4">
            <Button variant="outline" size="icon" onClick={prevMonth}><ArrowLeft className="w-4 h-4" /></Button>
            <div className="text-center"><p className="text-lg font-semibold">{months[selectedMonth - 1]} {selectedYear}</p></div>
            <Button variant="outline" size="icon" onClick={nextMonth}><ArrowRight className="w-4 h-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map((i) => <Card key={i} className="animate-pulse"><CardContent className="pt-6"><div className="h-24 bg-muted rounded" /></CardContent></Card>)}</div>
      ) : monthlyData ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" /><p className="text-sm text-muted-foreground">Income</p></div>
                  {incomeTrend && <Badge variant={Number(incomeTrend) >= 0 ? "default" : "destructive"} className="text-xs">{Number(incomeTrend) >= 0 ? "+" : ""}{incomeTrend}%</Badge>}
                </div>
                <p className="text-2xl font-bold text-emerald-500">{formatCurrency(monthlyData.income)}</p>
                <p className="text-xs text-muted-foreground">{monthlyData.incomeCount} transactions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><TrendingDown className="w-4 h-4 text-rose-500" /><p className="text-sm text-muted-foreground">Expenses</p></div>
                  {expenseTrend && <Badge variant={Number(expenseTrend) <= 0 ? "default" : "destructive"} className="text-xs">{Number(expenseTrend) >= 0 ? "+" : ""}{expenseTrend}%</Badge>}
                </div>
                <p className="text-2xl font-bold text-rose-500">{formatCurrency(monthlyData.expense)}</p>
                <p className="text-xs text-muted-foreground">{monthlyData.expenseCount} transactions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /><p className="text-sm text-muted-foreground">Net Savings</p></div>
                <p className={`text-2xl font-bold ${monthlyData.savings >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{formatCurrency(monthlyData.savings)}</p>
                <p className="text-xs text-muted-foreground">{savingsRate}% savings rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Income vs Expense Bar */}
          <Card>
            <CardHeader><CardTitle>Income vs Expenses</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1"><span className="text-emerald-500">Income</span><span>{formatCurrency(monthlyData.income)}</span></div>
                  <div className="w-full bg-muted rounded-full h-4"><div className="bg-emerald-500 h-4 rounded-full transition-all" style={{ width: `${monthlyData.income > 0 ? Math.min((monthlyData.income / Math.max(monthlyData.income, monthlyData.expense)) * 100, 100) : 0}%` }} /></div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1"><span className="text-rose-500">Expenses</span><span>{formatCurrency(monthlyData.expense)}</span></div>
                  <div className="w-full bg-muted rounded-full h-4"><div className="bg-rose-500 h-4 rounded-full transition-all" style={{ width: `${monthlyData.expense > 0 ? Math.min((monthlyData.expense / Math.max(monthlyData.income, monthlyData.expense)) * 100, 100) : 0}%` }} /></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          {sortedCategories.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><PieChart className="w-5 h-5" /> Spending by Category</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sortedCategories.map(([cat, amount]) => (
                    <div key={cat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{cat}</span>
                        <span className="font-medium">{formatCurrency(amount)} ({((amount / (monthlyData.expense || 1)) * 100).toFixed(0)}%)</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2"><div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${(amount / maxCatAmount) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Daily Average</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-muted-foreground">Avg. Daily Spending</span><span className="font-medium">{formatCurrency(monthlyData.expense / daysPassed)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Days Remaining</span><span className="font-medium">{daysRemaining}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Projected Monthly</span><span className="font-medium">{formatCurrency((monthlyData.expense / daysPassed) * daysInMonth)}</span></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Insights</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {monthlyData.savings > 0 ? <p className="text-emerald-500">Saving {savingsRate}% of income this month.</p> : <p className="text-rose-500">Spending more than earning this month.</p>}
                  {expenseTrend && <p className="text-muted-foreground">Expenses {Number(expenseTrend) >= 0 ? "up" : "down"} {Math.abs(Number(expenseTrend))}% vs last month.</p>}
                  {monthlyData.expenseCount > 0 && <p className="text-muted-foreground">Average transaction: {formatCurrency(monthlyData.expense / monthlyData.expenseCount)}</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card><CardContent className="pt-6"><div className="text-center py-8"><BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No data for this period</p></div></CardContent></Card>
      )}
    </div>
  );
}
