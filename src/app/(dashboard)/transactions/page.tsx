"use client";

import { useState, useRef } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeftRight,
  Plus,
  Send,
  TrendingUp,
  TrendingDown,
  Sparkles,
  CreditCard,
  AlertCircle,
  Check,
  Mail,
  FileText,
  Image,
  Upload,
  Loader2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

type ParsedTx = {
  type: "INCOME" | "EXPENSE";
  amount: number;
  description: string;
  category?: string;
  account?: string;
  date: string;
  confidence: number;
};

export default function TransactionsPage() {
  const [chatInput, setChatInput] = useState("");
  const [parseResult, setParseResult] = useState<any>(null);
  const [selectedTxs, setSelectedTxs] = useState<Set<number>>(new Set());
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [manualTransaction, setManualTransaction] = useState({
    accountId: "",
    categoryId: "",
    creditCardId: "",
    type: "EXPENSE" as "INCOME" | "EXPENSE",
    amount: 0,
    description: "",
    note: "",
    date: new Date().toISOString().split("T")[0],
  });

  const utils = trpc.useUtils();
  const { data: accounts } = trpc.account.list.useQuery();
  const { data: categories } = trpc.category.list.useQuery();
  const { data: creditCards } = trpc.creditCard.list.useQuery();
  const { data: transactionsData, isLoading } = trpc.transaction.list.useQuery({
    page: 1,
    limit: 50,
  });

  const createTransaction = trpc.transaction.create.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      utils.account.list.invalidate();
      utils.creditCard.list.invalidate();
    },
    onError: (error: Error) => {
      console.error("Failed to create transaction:", error.message);
    },
  } as any);

  const parseMutation = trpc.ai.parse.useMutation({
    onSuccess: (result: any) => {
      if (result.success) {
        setParseResult(result);
        // Auto-select all transactions
        const txs = result.transactions || (result.transaction ? [result.transaction] : []);
        setSelectedTxs(new Set(txs.map((_: any, i: number) => i)));
      }
    },
  } as any);

  const transactions: ParsedTx[] = parseResult?.transactions || 
    (parseResult?.transaction ? [parseResult.transaction] : []);

  const handleChatSubmit = () => {
    if (!chatInput.trim()) return;
    parseMutation.mutate({ input: chatInput });
  };

  const toggleTxSelection = (index: number) => {
    setSelectedTxs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleAcceptParsed = () => {
    if (!transactions.length || !accounts?.length) return;

    const selected = transactions.filter((_, i) => selectedTxs.has(i));
    
    for (const txn of selected) {
      const account = accounts.find(
        (a) => a.name.toLowerCase().includes(txn.account?.toLowerCase() || "") || a.isDefault
      ) || accounts[0];

      const category = categories?.find(
        (c) => c.name.toLowerCase().includes(txn.category?.toLowerCase() || "")
      );

      createTransaction.mutate({
        accountId: account.id,
        categoryId: category?.id,
        type: txn.type,
        amount: txn.amount,
        description: txn.description,
        date: new Date(txn.date),
      });
    }

    setParseResult(null);
    setSelectedTxs(new Set());
    setChatInput("");
  };

  const [formError, setFormError] = useState("");

  const handleManualSubmit = () => {
    setFormError("");
    if (!manualTransaction.accountId) {
      setFormError("Please select an account");
      return;
    }
    if (!manualTransaction.description.trim()) {
      setFormError("Please enter a description");
      return;
    }
    if (!manualTransaction.amount || manualTransaction.amount <= 0) {
      setFormError("Please enter a valid amount");
      return;
    }
    createTransaction.mutate({
      ...manualTransaction,
      categoryId: manualTransaction.categoryId || undefined,
      creditCardId: manualTransaction.creditCardId || undefined,
      date: new Date(manualTransaction.date),
    } as any);
    setIsManualDialogOpen(false);
  };

  const resetManualForm = () => {
    setManualTransaction({
      accountId: "",
      categoryId: "",
      creditCardId: "",
      type: "EXPENSE",
      amount: 0,
      description: "",
      note: "",
      date: new Date().toISOString().split("T")[0],
    });
    setFormError("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">Track your income and expenses</p>
        </div>
      </div>

      {/* AI Chat Input */}
      <Card className="border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <p className="text-sm font-medium">AI-Powered Quick Entry</p>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder='Try: "spent 500 on lunch, earned 50000 salary, ride 200 taka"'
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !parseResult) {
                  handleChatSubmit();
                }
              }}
              className="flex-1"
              disabled={parseMutation.isPending}
            />
            <Button
              onClick={handleChatSubmit}
              disabled={!chatInput.trim() || parseMutation.isPending}
            >
              {parseMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Enter multiple transactions separated by commas. AI will parse them all.
          </p>
        </CardContent>
      </Card>

      {/* Parsed Transactions Preview */}
      {parseResult?.success && transactions.length > 0 && (
        <Card className="border-emerald-500/50 bg-emerald-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <p className="text-sm font-medium text-emerald-500">
                  AI Parsed {transactions.length} Transaction{transactions.length > 1 ? "s" : ""}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {Math.round(transactions.reduce((acc: number, t: ParsedTx) => acc + t.confidence, 0) / transactions.length * 100)}% confidence
              </Badge>
            </div>

            <div className="space-y-3">
              {transactions.map((tx: ParsedTx, index: number) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    selectedTxs.has(index) 
                      ? "bg-emerald-500/10 border-emerald-500/30" 
                      : "bg-background hover:bg-accent/50"
                  }`}
                >
                  <button
                    onClick={() => toggleTxSelection(index)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedTxs.has(index)
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-muted-foreground/30"
                    }`}
                  >
                    {selectedTxs.has(index) && <Check className="w-3 h-3" />}
                  </button>
                  
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    tx.type === "INCOME" ? "bg-emerald-500/10" : "bg-rose-500/10"
                  }`}>
                    {tx.type === "INCOME" ? (
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-rose-500" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.category || "Other"} · {tx.account || "Default"} · {tx.date}
                    </p>
                  </div>
                  
                  <span className={`font-semibold ${
                    tx.type === "INCOME" ? "text-emerald-500" : "text-rose-500"
                  }`}>
                    {tx.type === "INCOME" ? "+" : "-"}
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <Button onClick={handleAcceptParsed} disabled={createTransaction.isPending || selectedTxs.size === 0}>
                {createTransaction.isPending ? (
                  "Adding..."
                ) : (
                  `Add ${selectedTxs.size} Selected`
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setParseResult(null);
                  setSelectedTxs(new Set());
                  setChatInput("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (selectedTxs.size === transactions.length) {
                    setSelectedTxs(new Set());
                  } else {
                    setSelectedTxs(new Set(transactions.map((_: any, i: number) => i)));
                  }
                }}
              >
                {selectedTxs.size === transactions.length ? "Deselect All" : "Select All"}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-2">
              Parsed using {parseResult.provider} ({parseResult.model}) in {parseResult.latencyMs}ms
            </p>
          </CardContent>
        </Card>
      )}

      {/* Manual Entry Dialog */}
      <div className="flex justify-end">
        <Dialog open={isManualDialogOpen} onOpenChange={(open) => {
          setIsManualDialogOpen(open);
          if (!open) resetManualForm();
        }}>
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
              {formError && (
                <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  <AlertCircle className="w-4 h-4" />
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={manualTransaction.type}
                    onValueChange={(value: "INCOME" | "EXPENSE") =>
                      setManualTransaction({ ...manualTransaction, type: value, creditCardId: "" })
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
              {manualTransaction.type === "EXPENSE" && creditCards && creditCards.length > 0 && (
                <div className="space-y-2">
                  <Label>Charge to Credit Card (optional)</Label>
                  <Select
                    value={manualTransaction.creditCardId}
                    onValueChange={(value) =>
                      setManualTransaction({ ...manualTransaction, creditCardId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None - regular expense" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None - regular expense</SelectItem>
                      {creditCards.map((card) => (
                        <SelectItem key={card.id} value={card.id}>
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-3 h-3" />
                            {card.name}
                            <span className="text-muted-foreground">
                              ({formatCurrency(Number(card.availableCredit))} available)
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={manualTransaction.categoryId}
                    onValueChange={(value) =>
                      setManualTransaction({ ...manualTransaction, categoryId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Label>Note (optional)</Label>
                  <Input
                    placeholder="Additional notes"
                    value={manualTransaction.note}
                    onChange={(e) =>
                      setManualTransaction({ ...manualTransaction, note: e.target.value })
                    }
                  />
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
          ) : (transactionsData?.transactions as any[]) && (transactionsData!.transactions as any[]).length > 0 ? (
            <div className="space-y-3">
              {(transactionsData!.transactions as any[]).map((transaction: any) => (
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
                        <span>{transaction.account?.name}</span>
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
                Use the AI-powered quick entry above to add your first transaction
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
