"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftRight, Plus, Send, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function TransactionsPage() {
  const [chatInput, setChatInput] = useState("");
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [manualTransaction, setManualTransaction] = useState({
    accountId: "",
    categoryId: "",
    type: "EXPENSE" as "INCOME" | "EXPENSE",
    amount: 0,
    description: "",
    note: "",
    date: new Date().toISOString().split("T")[0],
  });

  const utils = trpc.useUtils();
  const { data: accounts } = trpc.account.list.useQuery();
  const { data: transactionsData, isLoading } = trpc.transaction.list.useQuery({
    page: 1,
    limit: 50,
  });

  const createTransaction = trpc.transaction.create.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      setIsManualDialogOpen(false);
      setManualTransaction({
        accountId: "",
        categoryId: "",
        type: "EXPENSE",
        amount: 0,
        description: "",
        note: "",
        date: new Date().toISOString().split("T")[0],
      });
    },
  });

  const handleChatSubmit = () => {
    if (!chatInput.trim()) return;

    // Parse simple patterns like "spent 500 on lunch" or "earned 5000 salary"
    const spentMatch = chatInput.match(/spent\s+(\d+)\s+(?:on\s+)?(.+)/i);
    const earnedMatch = chatInput.match(/earned\s+(\d+)\s+(.+)?/i);
    const receivedMatch = chatInput.match(/received\s+(\d+)\s+(.+)?/i);

    if (spentMatch) {
      const amount = parseInt(spentMatch[1]);
      const description = spentMatch[2];
      const defaultAccount = accounts?.find((a) => a.isDefault) || accounts?.[0];

      if (defaultAccount) {
        createTransaction.mutate({
          accountId: defaultAccount.id,
          type: "EXPENSE",
          amount,
          description,
          date: new Date(),
        });
        setChatInput("");
      }
    } else if (earnedMatch || receivedMatch) {
      const match = earnedMatch || receivedMatch;
      const amount = parseInt(match![1]);
      const description = match![2] || "Income";
      const defaultAccount = accounts?.find((a) => a.isDefault) || accounts?.[0];

      if (defaultAccount) {
        createTransaction.mutate({
          accountId: defaultAccount.id,
          type: "INCOME",
          amount,
          description,
          date: new Date(),
        });
        setChatInput("");
      }
    }
  };

  const handleManualSubmit = () => {
    if (!manualTransaction.accountId || !manualTransaction.description) return;
    createTransaction.mutate({
      ...manualTransaction,
      date: new Date(manualTransaction.date),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">Track your income and expenses</p>
        </div>
      </div>

      {/* Chat Input */}
      <Card className="border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-2">
            <Send className="w-4 h-4 text-primary" />
            <p className="text-sm font-medium">Quick Entry</p>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder='Type something like "spent 500 on lunch" or "earned 5000 salary"'
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleChatSubmit();
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={handleChatSubmit}
              disabled={!chatInput.trim() || createTransaction.isPending}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Try: &quot;spent 200 on groceries&quot;, &quot;earned 50000 salary&quot;, &quot;received 1000 refund&quot;
          </p>
        </CardContent>
      </Card>

      {/* Manual Entry Dialog */}
      <div className="flex justify-end">
        <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Manual Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Transaction</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={manualTransaction.type}
                    onValueChange={(value: "INCOME" | "EXPENSE") =>
                      setManualTransaction({ ...manualTransaction, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXPENSE">
                        <div className="flex items-center gap-2">
                          <TrendingDown className="w-4 h-4 text-rose-500" />
                          Expense
                        </div>
                      </SelectItem>
                      <SelectItem value="INCOME">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                          Income
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Account</Label>
                  <Select
                    value={manualTransaction.accountId}
                    onValueChange={(value) =>
                      setManualTransaction({ ...manualTransaction, accountId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="What was this for?"
                  value={manualTransaction.description}
                  onChange={(e) =>
                    setManualTransaction({
                      ...manualTransaction,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={manualTransaction.amount || ""}
                    onChange={(e) =>
                      setManualTransaction({
                        ...manualTransaction,
                        amount: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={manualTransaction.date}
                    onChange={(e) =>
                      setManualTransaction({
                        ...manualTransaction,
                        date: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Note (optional)</Label>
                <Textarea
                  placeholder="Additional notes..."
                  value={manualTransaction.note}
                  onChange={(e) =>
                    setManualTransaction({ ...manualTransaction, note: e.target.value })
                  }
                />
              </div>
              <Button
                onClick={handleManualSubmit}
                className="w-full"
                disabled={createTransaction.isPending}
              >
                {createTransaction.isPending ? "Adding..." : "Add Transaction"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : transactionsData?.transactions && transactionsData.transactions.length > 0 ? (
            <div className="space-y-3">
              {(transactionsData.transactions as any[]).map((transaction: any) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        transaction.type === "INCOME"
                          ? "bg-emerald-500/10"
                          : "bg-rose-500/10"
                      }`}
                    >
                      {transaction.type === "INCOME" ? (
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-rose-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{transaction.account.name}</span>
                        {transaction.category && (
                          <>
                            <span>·</span>
                            <Badge variant="secondary" className="text-xs">
                              {transaction.category.icon} {transaction.category.name}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        transaction.type === "INCOME"
                          ? "text-emerald-500"
                          : "text-rose-500"
                      }`}
                    >
                      {transaction.type === "INCOME" ? "+" : "-"}
                      {formatCurrency(Number(transaction.amount))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(transaction.date)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <ArrowLeftRight className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No transactions yet</p>
              <p className="text-sm text-muted-foreground">
                Use the quick entry above or add manually
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
