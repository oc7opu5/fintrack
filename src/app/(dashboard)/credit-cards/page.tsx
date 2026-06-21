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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  CreditCard,
  TrendingDown,
  Calendar,
  DollarSign,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function CreditCardsPage() {
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const [newCard, setNewCard] = useState({
    name: "",
    creditLimit: 0,
    interestRate: 0,
    billingDay: 1,
    dueDay: 15,
  });

  const [newLoan, setNewLoan] = useState({
    creditCardId: "",
    name: "",
    principalAmount: 0,
    interestRate: 18,
    totalInstallments: 12,
    startDate: new Date().toISOString().split("T")[0],
  });

  const utils = trpc.useUtils();

  const { data: cards, isLoading } = trpc.creditCard?.list?.useQuery() ?? {
    data: null,
    isLoading: false,
  };
  const { data: selectedCard } = trpc.creditCard?.getById?.useQuery(
    { id: selectedCardId || "" },
    { enabled: !!selectedCardId }
  ) ?? { data: null };

  // Fallback empty arrays if creditCard router not available
  const cardsList = cards || [];
  const selectedCardData = selectedCard;

  const createCard = trpc.creditCard?.create?.useMutation({
    onSuccess: () => {
      utils.creditCard?.list?.invalidate();
      setIsAddCardOpen(false);
      setNewCard({ name: "", creditLimit: 0, interestRate: 0, billingDay: 1, dueDay: 15 });
    },
  });

  const createLoan = trpc.loan?.create?.useMutation({
    onSuccess: () => {
      utils.creditCard?.getById?.invalidate({ id: selectedCardId || "" });
      setIsAddLoanOpen(false);
      setNewLoan({
        creditCardId: "",
        name: "",
        principalAmount: 0,
        interestRate: 18,
        totalInstallments: 12,
        startDate: new Date().toISOString().split("T")[0],
      });
    },
  });

  const totalBalance = cardsList.reduce(
    (sum, card) => sum + Number(card.currentBalance),
    0
  );
  const totalLimit = cardsList.reduce(
    (sum, card) => sum + Number(card.creditLimit),
    0
  );
  const totalAvailable = cardsList.reduce(
    (sum, card) => sum + Number(card.availableCredit),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Credit Cards</h1>
          <p className="text-muted-foreground">
            Manage cards and track installment loans
          </p>
        </div>
        <Dialog open={isAddCardOpen} onOpenChange={setIsAddCardOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Card
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Credit Card</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Card Name</Label>
                <Input
                  placeholder="e.g., Visa Platinum"
                  value={newCard.name}
                  onChange={(e) =>
                    setNewCard({ ...newCard, name: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Credit Limit</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newCard.creditLimit || ""}
                    onChange={(e) =>
                      setNewCard({
                        ...newCard,
                        creditLimit: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Interest Rate (%)</Label>
                  <Input
                    type="number"
                    placeholder="18"
                    value={newCard.interestRate || ""}
                    onChange={(e) =>
                      setNewCard({
                        ...newCard,
                        interestRate: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Billing Day</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={newCard.billingDay}
                    onChange={(e) =>
                      setNewCard({
                        ...newCard,
                        billingDay: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Due Day</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={newCard.dueDay}
                    onChange={(e) =>
                      setNewCard({
                        ...newCard,
                        dueDay: parseInt(e.target.value) || 15,
                      })
                    }
                  />
                </div>
              </div>
              <Button
                onClick={() => createCard?.mutate(newCard)}
                className="w-full"
                disabled={createCard?.isPending}
              >
                {createCard?.isPending ? "Adding..." : "Add Card"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-rose-500" />
              <p className="text-sm text-muted-foreground">Total Outstanding</p>
            </div>
            <p className="text-2xl font-bold text-rose-500">
              {formatCurrency(totalBalance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              <p className="text-sm text-muted-foreground">Total Credit Limit</p>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalLimit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-emerald-500" />
              <p className="text-sm text-muted-foreground">Available Credit</p>
            </div>
            <p className="text-2xl font-bold text-emerald-500">
              {formatCurrency(totalAvailable)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cards List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-32 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : cardsList.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {cardsList.map((card) => {
            const usage = Number(card.creditLimit)
              ? (Number(card.currentBalance) / Number(card.creditLimit)) * 100
              : 0;

            return (
              <Card
                key={card.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedCardId === card.id
                    ? "ring-2 ring-primary"
                    : ""
                }`}
                onClick={() => setSelectedCardId(card.id)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-8 bg-gradient-to-r from-slate-700 to-slate-900 rounded-md flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium">{card.name}</p>
                        {card.lastFourDigits && (
                          <p className="text-xs text-muted-foreground">
                            •••• {card.lastFourDigits}
                          </p>
                        )}
                      </div>
                    </div>
                    {usage > 80 && (
                      <Badge variant="destructive">High Usage</Badge>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Balance</span>
                        <span className="font-medium">
                          {formatCurrency(Number(card.currentBalance))}
                        </span>
                      </div>
                      <Progress value={usage} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Limit</p>
                        <p className="font-medium">
                          {formatCurrency(Number(card.creditLimit))}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Available</p>
                        <p className="font-medium text-emerald-500">
                          {formatCurrency(Number(card.availableCredit))}
                        </p>
                      </div>
                    </div>

                    {card.dueDay && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>Due on {card.dueDay}th of each month</span>
                      </div>
                    )}
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
              <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No credit cards yet</p>
              <p className="text-sm text-muted-foreground">
                Add your first credit card to start tracking
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loan Section */}
      {selectedCardId && selectedCardData && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Installment Loans</CardTitle>
            <Dialog open={isAddLoanOpen} onOpenChange={setIsAddLoanOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Loan
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Installment Loan</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Loan Name</Label>
                    <Input
                      placeholder="e.g., iPhone 15 Pro Installment"
                      value={newLoan.name}
                      onChange={(e) =>
                        setNewLoan({ ...newLoan, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Principal Amount</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={newLoan.principalAmount || ""}
                        onChange={(e) =>
                          setNewLoan({
                            ...newLoan,
                            principalAmount: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Interest Rate (%)</Label>
                      <Input
                        type="number"
                        placeholder="18"
                        value={newLoan.interestRate || ""}
                        onChange={(e) =>
                          setNewLoan({
                            ...newLoan,
                            interestRate: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Installments</Label>
                      <Input
                        type="number"
                        placeholder="12"
                        value={newLoan.totalInstallments || ""}
                        onChange={(e) =>
                          setNewLoan({
                            ...newLoan,
                            totalInstallments: parseInt(e.target.value) || 12,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={newLoan.startDate}
                        onChange={(e) =>
                          setNewLoan({ ...newLoan, startDate: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() =>
                      createLoan?.mutate({
                        ...newLoan,
                        creditCardId: selectedCardId,
                        startDate: new Date(newLoan.startDate),
                      })
                    }
                    className="w-full"
                    disabled={createLoan?.isPending}
                  >
                    {createLoan?.isPending ? "Creating..." : "Create Loan"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {selectedCardData.loans && selectedCardData.loans.length > 0 ? (
              <div className="space-y-4">
                {selectedCardData.loans.map((loan) => {
                  const paidPercent =
                    (loan.paidInstallments / loan.totalInstallments) * 100;
                  return (
                    <div
                      key={loan.id}
                      className="p-4 border rounded-lg space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{loan.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {loan.paidInstallments}/{loan.totalInstallments}{" "}
                            installments paid
                          </p>
                        </div>
                        <Badge
                          variant={
                            loan.status === "ACTIVE" ? "default" : "secondary"
                          }
                        >
                          {loan.status}
                        </Badge>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Progress</span>
                          <span>{paidPercent.toFixed(0)}%</span>
                        </div>
                        <Progress value={paidPercent} className="h-2" />
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Principal</p>
                          <p className="font-medium">
                            {formatCurrency(Number(loan.principalAmount))}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Outstanding</p>
                          <p className="font-medium text-rose-500">
                            {formatCurrency(Number(loan.outstandingAmount))}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Monthly EMI</p>
                          <p className="font-medium">
                            {formatCurrency(Number(loan.monthlyEMI))}
                          </p>
                        </div>
                      </div>

                      {loan.installments && loan.installments.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium mb-2">
                            Upcoming Installments
                          </p>
                          <div className="space-y-2">
                            {loan.installments
                              .filter((i) => i.status === "PENDING")
                              .slice(0, 3)
                              .map((inst) => (
                                <div
                                  key={inst.id}
                                  className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
                                >
                                  <span>
                                    #{inst.installmentNo} -{" "}
                                    {formatDate(inst.dueDate)}
                                  </span>
                                  <span className="font-medium">
                                    {formatCurrency(Number(inst.totalPayment))}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No loans on this card</p>
                <p className="text-sm text-muted-foreground">
                  Add an installment loan to track payments
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
