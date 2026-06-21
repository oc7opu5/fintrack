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
import { Plus, Wallet, CreditCard, Landmark, Smartphone } from "lucide-react";
import { formatCurrency, getAccountTypeIcon } from "@/lib/utils";

const accountTypes = [
  { value: "BKASH", label: "bKash", icon: Smartphone, color: "#E2136E" },
  { value: "NAGAD", label: "Nagad", icon: Smartphone, color: "#F6921E" },
  { value: "ROCKET", label: "Rocket", icon: Smartphone, color: "#ED1C24" },
  { value: "MOBILE_BANKING", label: "Mobile Banking", icon: Smartphone, color: "#1A73E8" },
  { value: "BANK_ACCOUNT", label: "Bank Account", icon: Landmark, color: "#1B5E20" },
  { value: "CREDIT_CARD", label: "Credit Card", icon: CreditCard, color: "#635BFF" },
  { value: "CASH", label: "Cash", icon: Wallet, color: "#4CAF50" },
  { value: "OTHER", label: "Other", icon: Wallet, color: "#757575" },
];

export default function AccountsPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: "",
    type: "BKASH" as "BKASH" | "NAGAD" | "ROCKET" | "MOBILE_BANKING" | "CREDIT_CARD" | "DEBIT_CARD" | "BANK_ACCOUNT" | "CASH" | "OTHER",
    balance: 0,
  });

  const utils = trpc.useUtils();
  const { data: accounts, isLoading } = trpc.account.list.useQuery();
  const { data: netWorth } = trpc.account.netWorth.useQuery();

  const createAccount = trpc.account.create.useMutation({
    onSuccess: () => {
      utils.account.list.invalidate();
      utils.account.netWorth.invalidate();
      setIsAddDialogOpen(false);
      setNewAccount({ name: "", type: "BKASH", balance: 0 });
    },
  });

  const handleCreate = () => {
    if (!newAccount.name) return;
    createAccount.mutate(newAccount);
  };

  const getAccountIcon = (type: string) => {
    const accountType = accountTypes.find((t) => t.value === type);
    if (accountType) {
      const Icon = accountType.icon;
      return <Icon className="w-5 h-5" style={{ color: accountType.color }} />;
    }
    return <Wallet className="w-5 h-5" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-muted-foreground">Manage your financial accounts</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Account Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., My bKash"
                  value={newAccount.name}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Account Type</Label>
                <Select
                  value={newAccount.type}
                  onValueChange={(value: "BKASH" | "NAGAD" | "ROCKET" | "MOBILE_BANKING" | "CREDIT_CARD" | "DEBIT_CARD" | "BANK_ACCOUNT" | "CASH" | "OTHER") =>
                    setNewAccount({ ...newAccount, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="w-4 h-4" style={{ color: type.color }} />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="balance">Current Balance</Label>
                <Input
                  id="balance"
                  type="number"
                  placeholder="0"
                  value={newAccount.balance || ""}
                  onChange={(e) =>
                    setNewAccount({
                      ...newAccount,
                      balance: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <Button
                onClick={handleCreate}
                className="w-full"
                disabled={createAccount.isPending}
              >
                {createAccount.isPending ? "Creating..." : "Create Account"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Net Worth Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Net Worth</p>
              <p className="text-3xl font-bold">
                {formatCurrency(netWorth?.netWorth || 0)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Assets</p>
              <p className="text-lg font-semibold text-emerald-500">
                {formatCurrency(netWorth?.totalAssets || 0)}
              </p>
              <p className="text-sm text-muted-foreground">Liabilities</p>
              <p className="text-lg font-semibold text-rose-500">
                {formatCurrency(netWorth?.totalLiabilities || 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounts List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts && accounts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: `${
                          accountTypes.find((t) => t.value === account.type)
                            ?.color || "#757575"
                        }20`,
                      }}
                    >
                      {getAccountIcon(account.type)}
                    </div>
                    <div>
                      <p className="font-medium">{account.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {accountTypes.find((t) => t.value === account.type)
                          ?.label || account.type}
                      </p>
                    </div>
                  </div>
                  {account.isDefault && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      Default
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-bold">
                    {formatCurrency(Number(account.balance))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {account._count.transactions} transactions
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Wallet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No accounts yet</p>
              <p className="text-sm text-muted-foreground">
                Add your first account to start tracking
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
