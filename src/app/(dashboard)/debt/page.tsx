"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, CreditCard, DollarSign, Calendar, TrendingUp, Users, ArrowRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function DebtTrackerPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [selectedInstallmentNo, setSelectedInstallmentNo] = useState(0);

  const [newDebt, setNewDebt] = useState<{ name: string; type: string; calculationMode: string; principalAmount: number; interestRate: number; tenure: number; startDate: string; creditLimit: number; lastFourDigits: string; lenderName: string; color: string; }>({
    name: "", type: "credit_card",
    calculationMode: "reducing_balance",
    principalAmount: 0, interestRate: 18, tenure: 12,
    startDate: new Date().toISOString().split("T")[0],
    creditLimit: 0, lastFourDigits: "", lenderName: "", color: "",
  });

  const utils = trpc.useUtils();
  const { data: debts } = trpc.debt.list.useQuery();
  const { data: debtSummary } = trpc.debt.summary.useQuery();
  const { data: selectedDebt } = trpc.debt.getById.useQuery({ id: selectedDebtId || "" }, { enabled: !!selectedDebtId });

  const createDebt = trpc.debt.create.useMutation({
    onSuccess: () => {
      utils.debt.list.invalidate(); utils.debt.summary.invalidate();
      setIsAddOpen(false);
      setNewDebt({ name: "", type: "credit_card", calculationMode: "reducing_balance", principalAmount: 0, interestRate: 18, tenure: 12, startDate: new Date().toISOString().split("T")[0], creditLimit: 0, lastFourDigits: "", lenderName: "", color: "" });
    },
  });

  const payInstallment = trpc.debt.payInstallment.useMutation({
    onSuccess: () => {
      utils.debt.list.invalidate(); utils.debt.summary.invalidate(); utils.debt.getById.invalidate({ id: selectedDebtId || "" });
      setIsPayOpen(false); setSelectedInstallmentNo(0);
    },
  });

  const typeIcons: Record<string, string> = { credit_card: "💳", personal_loan: "🏦", installment: "📱", informal: "👤" };
  const typeLabels: Record<string, string> = { credit_card: "Credit Card", personal_loan: "Personal Loan", installment: "Installment", informal: "Informal Debt" };
  const debtsList = debts || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Debt Tracker</h1><p className="text-muted-foreground">Credit cards, loans, installments & informal debt</p></div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Add Debt</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add New Debt</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2"><Label>Type</Label><Select value={newDebt.type} onValueChange={(v: any) => setNewDebt({ ...newDebt, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="credit_card">Credit Card</SelectItem><SelectItem value="personal_loan">Personal Loan</SelectItem><SelectItem value="installment">Installment</SelectItem><SelectItem value="informal">Informal Debt</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Name</Label><Input placeholder="e.g., Visa Card, Personal Loan" value={newDebt.name} onChange={(e) => setNewDebt({ ...newDebt, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Calculation Mode</Label><Select value={newDebt.calculationMode} onValueChange={(v: any) => setNewDebt({ ...newDebt, calculationMode: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="reducing_balance">Reducing Balance (interest on remaining)</SelectItem><SelectItem value="static">Static Balance (flat interest)</SelectItem></SelectContent></Select></div>
              <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Amount</Label><Input type="number" value={newDebt.principalAmount || ""} onChange={(e) => setNewDebt({ ...newDebt, principalAmount: parseFloat(e.target.value) || 0 })} /></div><div className="space-y-2"><Label>Interest Rate (%)</Label><Input type="number" value={newDebt.interestRate || ""} onChange={(e) => setNewDebt({ ...newDebt, interestRate: parseFloat(e.target.value) || 0 })} /></div></div>
              <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Tenure (months)</Label><Input type="number" value={newDebt.tenure || ""} onChange={(e) => setNewDebt({ ...newDebt, tenure: parseInt(e.target.value) || 12 })} /></div><div className="space-y-2"><Label>Start Date</Label><Input type="date" value={newDebt.startDate} onChange={(e) => setNewDebt({ ...newDebt, startDate: e.target.value })} /></div></div>
              {newDebt.type === "credit_card" && <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Credit Limit</Label><Input type="number" value={newDebt.creditLimit || ""} onChange={(e) => setNewDebt({ ...newDebt, creditLimit: parseFloat(e.target.value) || 0 })} /></div><div className="space-y-2"><Label>Last 4 Digits</Label><Input placeholder="1234" value={newDebt.lastFourDigits} onChange={(e) => setNewDebt({ ...newDebt, lastFourDigits: e.target.value })} /></div></div>}
              {newDebt.type === "informal" && <div className="space-y-2"><Label>Lender Name</Label><Input placeholder="e.g., Friend's Name" value={newDebt.lenderName} onChange={(e) => setNewDebt({ ...newDebt, lenderName: e.target.value })} /></div>}
              <Button onClick={() => createDebt.mutate({...newDebt, type: newDebt.type as "credit_card" | "personal_loan" | "installment" | "informal", calculationMode: newDebt.calculationMode as "reducing_balance" | "static" })} className="w-full" disabled={createDebt.isPending}>{createDebt.isPending ? "Creating..." : "Create Debt"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {debtSummary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-rose-500" /><p className="text-sm text-muted-foreground">Total Outstanding</p></div><p className="text-2xl font-bold text-rose-500">{formatCurrency(debtSummary.totalOutstanding)}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /><p className="text-sm text-muted-foreground">Due Monthly</p></div><p className="text-2xl font-bold">{formatCurrency(debtSummary.totalMonthlyDue)}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-amber-500" /><p className="text-sm text-muted-foreground">Monthly Interest</p></div><p className="text-2xl font-bold text-amber-500">{formatCurrency(debtSummary.totalInterestPortion)}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-muted-foreground" /><p className="text-sm text-muted-foreground">Active Debts</p></div><p className="text-2xl font-bold">{debtSummary.debtCount}</p></CardContent></Card>
        </div>
      )}

      {debtSummary?.strategy && (
        <Card><CardHeader><CardTitle>Paydown Strategy</CardTitle></CardHeader><CardContent><div className="grid md:grid-cols-2 gap-4"><div className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-lg"><p className="font-medium text-sm text-rose-600 dark:text-rose-400 flex items-center gap-1"><ArrowRight className="w-3 h-3" />Avalanche (Highest Interest First)</p><div className="flex flex-wrap gap-1 mt-1">{debtSummary.strategy.avalanche.map((n: string, i: number) => <Badge key={n} variant="destructive" className="text-xs">{i + 1}. {n}</Badge>)}</div></div><div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg"><p className="font-medium text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><ArrowRight className="w-3 h-3" />Snowball (Smallest Balance First)</p><div className="flex flex-wrap gap-1 mt-1">{debtSummary.strategy.snowball.map((n: string, i: number) => <Badge key={n} variant="default" className="text-xs">{i + 1}. {n}</Badge>)}</div></div></div></CardContent></Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {debtsList.map((debt: any) => (
          <Card key={debt.id} className={`cursor-pointer hover:shadow-md ${selectedDebtId === debt.id ? "ring-2 ring-primary" : ""}`} onClick={() => setSelectedDebtId(debt.id)}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4"><div><div className="flex items-center gap-2"><span className="text-xl">{typeIcons[debt.type] || "💰"}</span><p className="font-medium">{debt.name}</p></div><div className="flex gap-2 mt-1"><Badge variant="outline" className="text-xs">{typeLabels[debt.type] || debt.type}</Badge><Badge variant="secondary" className="text-xs">{debt.calculationMode === "reducing_balance" ? "Reducing" : "Static"}</Badge>{debt.status !== "ACTIVE" && <Badge variant="secondary" className="text-xs">{debt.status}</Badge>}</div></div>{debt.lenderName && <Badge variant="outline" className="flex items-center gap-1"><Users className="w-3 h-3" />{debt.lenderName}</Badge>}</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Outstanding</span><span className="font-bold text-rose-500">{formatCurrency(Number(debt.outstandingAmount))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Monthly Due</span><span className="font-medium">{formatCurrency(Number(debt.monthlyDue || 0))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Interest/Month</span><span className="font-medium text-amber-500">{formatCurrency(Number(debt.interestPortion || 0))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Interest Rate</span><span>{Number(debt.interestRate)}%</span></div>
                {debt.tenure && <div className="flex justify-between"><span className="text-muted-foreground">Tenure</span><span>{debt.tenure} months</span></div>}
              </div>
              <Progress value={debt.principalAmount > 0 ? ((Number(debt.principalAmount) - Number(debt.outstandingAmount)) / Number(debt.principalAmount)) * 100 : 0} className="h-1.5 mt-3" />
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedDebt && selectedDebt.installments && selectedDebt.installments.length > 0 && (
        <Card><CardHeader><CardTitle>Installment Schedule - {selectedDebt.name}</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left py-2">#</th><th className="text-right py-2">Total</th><th className="text-right py-2">Principal</th><th className="text-right py-2">Interest</th><th className="text-right py-2">Remaining</th><th className="text-right py-2">Due Date</th><th className="text-center py-2">Status</th></tr></thead><tbody>{selectedDebt.installments.map((inst: any) => (<tr key={inst.id} className="border-b last:border-0"><td className="py-2">{inst.installmentNo}</td><td className="text-right">{formatCurrency(Number(inst.totalPayment))}</td><td className="text-right">{formatCurrency(Number(inst.principalPortion))}</td><td className="text-right text-amber-500">{formatCurrency(Number(inst.interestPortion))}</td><td className="text-right">{formatCurrency(Number(inst.outstandingAfter))}</td><td className="text-right text-xs">{formatDate(inst.dueDate)}</td><td className="text-center">{inst.status === "PAID" ? <Badge variant="default" className="text-xs">Paid</Badge> : <Button size="sm" variant="outline" className="h-6 text-xs" onClick={(e) => { e.stopPropagation(); setSelectedInstallmentNo(inst.installmentNo); setIsPayOpen(true); }}>Pay</Button>}</td></tr>))}</tbody></table></div></CardContent></Card>
      )}

      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pay Installment #{selectedInstallmentNo}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {selectedDebt?.installments && (() => { const inst = selectedDebt.installments.find((i: any) => i.installmentNo === selectedInstallmentNo && i.status !== "PAID"); if (!inst) return <p>Installment not found or already paid.</p>; return (<><div className="p-4 bg-muted/50 rounded-lg space-y-2"><div className="flex justify-between"><span>Total Payment</span><span className="font-bold">{formatCurrency(Number(inst.totalPayment))}</span></div><div className="flex justify-between"><span>Principal</span><span>{formatCurrency(Number(inst.principalPortion))}</span></div><div className="flex justify-between"><span>Interest</span><span className="text-amber-500">{formatCurrency(Number(inst.interestPortion))}</span></div></div><p className="text-sm text-muted-foreground">Pay: {formatCurrency(Number(inst.totalPayment))} this month. Interest portion: {formatCurrency(Number(inst.interestPortion))}. Remaining balance after payment: {formatCurrency(Number(inst.outstandingAfter))}.</p><Button onClick={() => payInstallment.mutate({ debtId: selectedDebtId!, installmentNo: selectedInstallmentNo })} className="w-full" disabled={payInstallment.isPending}>{payInstallment.isPending ? "Processing..." : `Pay ${formatCurrency(Number(inst.totalPayment))}`}</Button></>); })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
