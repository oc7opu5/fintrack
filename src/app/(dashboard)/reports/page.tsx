"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function ReportsPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const { data: monthlyData, isLoading } =
    trpc.transaction?.monthlySummary?.useQuery({
      year: selectedYear,
      month: selectedMonth,
    }) ?? { data: null, isLoading: false };

  const savingsRate =
    monthlyData && monthlyData.income > 0
      ? ((monthlyData.savings / monthlyData.income) * 100).toFixed(1)
      : "0";

  const prevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Analyze your financial data</p>
        </div>
      </div>

      {/* Month Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-4">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="text-center">
              <p className="text-lg font-semibold">
                {months[selectedMonth - 1]} {selectedYear}
              </p>
            </div>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-24 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : monthlyData ? (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <p className="text-sm text-muted-foreground">Income</p>
                </div>
                <p className="text-2xl font-bold text-emerald-500">
                  {formatCurrency(monthlyData.income)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {monthlyData.incomeCount} transactions
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-rose-500" />
                  <p className="text-sm text-muted-foreground">Expenses</p>
                </div>
                <p className="text-2xl font-bold text-rose-500">
                  {formatCurrency(monthlyData.expense)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {monthlyData.expenseCount} transactions
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <p className="text-sm text-muted-foreground">Net Savings</p>
                </div>
                <p
                  className={`text-2xl font-bold ${
                    monthlyData.savings >= 0
                      ? "text-emerald-500"
                      : "text-rose-500"
                  }`}
                >
                  {formatCurrency(monthlyData.savings)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {savingsRate}% savings rate
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Income vs Expense Bar */}
          <Card>
            <CardHeader>
              <CardTitle>Income vs Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-emerald-500">Income</span>
                    <span>{formatCurrency(monthlyData.income)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-4">
                    <div
                      className="bg-emerald-500 h-4 rounded-full transition-all"
                      style={{
                        width: `${
                          monthlyData.income > 0
                            ? Math.min(
                                (monthlyData.income /
                                  Math.max(
                                    monthlyData.income,
                                    monthlyData.expense
                                  )) *
                                  100,
                                100
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-rose-500">Expenses</span>
                    <span>{formatCurrency(monthlyData.expense)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-4">
                    <div
                      className="bg-rose-500 h-4 rounded-full transition-all"
                      style={{
                        width: `${
                          monthlyData.expense > 0
                            ? Math.min(
                                (monthlyData.expense /
                                  Math.max(
                                    monthlyData.income,
                                    monthlyData.expense
                                  )) *
                                  100,
                                100
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Daily Average</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg. Daily Spending</span>
                    <span className="font-medium">
                      {formatCurrency(monthlyData.expense / 30)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Days Remaining</span>
                    <span className="font-medium">
                      {new Date(
                        selectedYear,
                        selectedMonth,
                        0
                      ).getDate() - now.getDate()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Budget for Rest of Month</span>
                    <span className="font-medium">
                      {formatCurrency(
                        monthlyData.expense / now.getDate() * (new Date(selectedYear, selectedMonth, 0).getDate() - now.getDate())
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {monthlyData.savings > 0 ? (
                    <p className="text-emerald-500">
                      ✓ You&apos;re saving {savingsRate}% of your income this month.
                    </p>
                  ) : (
                    <p className="text-rose-500">
                      ✗ You&apos;re spending more than you earn this month.
                    </p>
                  )}
                  {monthlyData.expenseCount > 0 && (
                    <p className="text-muted-foreground">
                      Average transaction:{" "}
                      {formatCurrency(monthlyData.expense / monthlyData.expenseCount)}
                    </p>
                  )}
                  {monthlyData.incomeCount > 0 && (
                    <p className="text-muted-foreground">
                      Income sources: {monthlyData.incomeCount}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No data for this period</p>
              <p className="text-sm text-muted-foreground">
                Add some transactions to see your reports
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
