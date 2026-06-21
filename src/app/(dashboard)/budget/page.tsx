"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Plus, PieChart, AlertTriangle, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function BudgetPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newBudget, setNewBudget] = useState({
    name: "",
    amount: 0,
    categoryId: "",
    period: "MONTHLY" as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
    alertAt: 80,
    startDate: new Date().toISOString().split("T")[0],
  });

  const utils = trpc.useUtils();
  const { data: categories } = trpc.category?.list?.useQuery() ?? {
    data: null,
  };
  const { data: budgetOverview, isLoading } =
    trpc.budget?.overview?.useQuery() ?? { data: null, isLoading: false };

  const createBudget = trpc.budget?.create?.useMutation({
    onSuccess: () => {
      utils.budget?.overview?.invalidate();
      setIsAddDialogOpen(false);
      setNewBudget({
        name: "",
        amount: 0,
        categoryId: "",
        period: "MONTHLY",
        alertAt: 80,
        startDate: new Date().toISOString().split("T")[0],
      });
    },
  });

  const deleteBudget = trpc.budget?.delete?.useMutation({
    onSuccess: () => {
      utils.budget?.overview?.invalidate();
    },
  });

  const budgets = budgetOverview?.budgets || [];
  const totalBudget = budgetOverview?.totalBudget || 0;
  const totalSpent = budgetOverview?.totalSpent || 0;
  const totalRemaining = budgetOverview?.totalRemaining || 0;
  const overallPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const expenseCategories =
    categories?.filter((c: any) => c.type === "EXPENSE") || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budget</h1>
          <p className="text-muted-foreground">
            Set spending limits and track your budget
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Budget
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Budget</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Budget Name</Label>
                <Input
                  placeholder="e.g., Monthly Food Budget"
                  value={newBudget.name}
                  onChange={(e) =>
                    setNewBudget({ ...newBudget, name: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount Limit</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newBudget.amount || ""}
                    onChange={(e) =>
                      setNewBudget({
                        ...newBudget,
                        amount: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Period</Label>
                  <Select
                    value={newBudget.period}
                    onValueChange={(value: any) =>
                      setNewBudget({ ...newBudget, period: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="YEARLY">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category (optional)</Label>
                  <Select
                    value={newBudget.categoryId}
                    onValueChange={(value) =>
                      setNewBudget({ ...newBudget, categoryId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All expenses" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Alert at (%)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={newBudget.alertAt}
                    onChange={(e) =>
                      setNewBudget({
                        ...newBudget,
                        alertAt: parseInt(e.target.value) || 80,
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={newBudget.startDate}
                  onChange={(e) =>
                    setNewBudget({ ...newBudget, startDate: e.target.value })
                  }
                />
              </div>
              <Button
                onClick={() =>
                  createBudget?.mutate({
                    ...newBudget,
                    startDate: new Date(newBudget.startDate),
                    categoryId: newBudget.categoryId || undefined,
                  } as any)
                }
                className="w-full"
                disabled={createBudget?.isPending}
              >
                {createBudget?.isPending ? "Creating..." : "Create Budget"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overall Budget Summary */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Budget</p>
                <p className="text-3xl font-bold">{formatCurrency(totalBudget)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Spent</p>
                <p className="text-2xl font-bold text-rose-500">
                  {formatCurrency(totalSpent)}
                </p>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Overall Progress</span>
                <span>{overallPercent.toFixed(0)}%</span>
              </div>
              <Progress
                value={overallPercent}
                className={`h-3 ${
                  overallPercent > 100
                    ? "bg-rose-500"
                    : overallPercent > 80
                    ? "bg-yellow-500"
                    : ""
                }`}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {formatCurrency(totalRemaining)} remaining
              </span>
              {overallPercent > 100 && (
                <Badge variant="destructive">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Over budget!
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Categories */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-24 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : budgets.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => {
            const percent = budget.percentage || 0;
            const isOver = budget.isOverBudget;
            const isNear = budget.isNearLimit;

            return (
              <Card
                key={budget.id}
                className={`transition-shadow hover:shadow-md ${
                  isOver
                    ? "border-rose-500"
                    : isNear
                    ? "border-yellow-500"
                    : ""
                }`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-medium">{budget.name}</p>
                      {budget.category && (
                        <p className="text-sm text-muted-foreground">
                          {budget.category.icon} {budget.category.name}
                        </p>
                      )}
                    </div>
                    {isOver ? (
                      <Badge variant="destructive">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Over
                      </Badge>
                    ) : isNear ? (
                      <Badge
                        variant="outline"
                        className="border-yellow-500 text-yellow-500"
                      >
                        Near Limit
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-emerald-500">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        On Track
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold">
                        {formatCurrency(budget.actualSpent)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        of {formatCurrency(Number(budget.amount))}
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">
                          {percent.toFixed(0)}% used
                        </span>
                        <span className="text-muted-foreground">
                          {formatCurrency(budget.remaining)} left
                        </span>
                      </div>
                      <Progress
                        value={Math.min(percent, 100)}
                        className={`h-2 ${
                          isOver
                            ? "bg-rose-500"
                            : isNear
                            ? "bg-yellow-500"
                            : ""
                        }`}
                      />
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-xs text-muted-foreground">
                        {budget.period}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() =>
                          deleteBudget?.mutate({ id: budget.id })
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <PieChart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No budgets set</p>
              <p className="text-sm text-muted-foreground">
                Create your first budget to start tracking spending limits
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
