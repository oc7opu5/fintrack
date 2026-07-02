// Enhanced Debt & Credit Engine for MindLedger AI
// Supports: credit cards, personal loans, informal debt, installments
// Two calculation modes: reducing balance & static balance

export type DebtType = "credit_card" | "personal_loan" | "installment" | "informal";
export type CalculationMode = "reducing_balance" | "static";

export interface DebtInput {
  name: string;
  type: DebtType;
  calculationMode: CalculationMode;
  principalAmount: number;
  interestRate: number; // annual percentage
  tenure?: number; // months (null for revolving)
  fixedEMI?: number; // for static mode override
  startDate: Date;
  dueDay?: number;
  creditLimit?: number;
  lastFourDigits?: string;
  lenderName?: string;
}

export interface InstallmentSchedule {
  installmentNo: number;
  principalPortion: number;
  interestPortion: number;
  totalPayment: number;
  outstandingAfter: number;
  dueDate: Date;
  status: "PENDING" | "PAID" | "OVERDUE";
}

export interface DebtCalculation {
  totalInterest: number;
  totalPayment: number;
  monthlyDue: number;
  interestPortion: number; // for current month
  schedule: InstallmentSchedule[];
  endDate: Date;
}

// Reducing Balance Mode: interest on remaining principal
export function calculateReducingBalance(input: DebtInput): DebtCalculation {
  const { principalAmount, interestRate, tenure = 12, startDate } = input;
  const monthlyRate = interestRate / 100 / 12;

  // EMI formula: P * r * (1+r)^n / ((1+r)^n - 1)
  const emi = monthlyRate > 0
    ? (principalAmount * monthlyRate * Math.pow(1 + monthlyRate, tenure)) /
      (Math.pow(1 + monthlyRate, tenure) - 1)
    : principalAmount / tenure;

  const schedule: InstallmentSchedule[] = [];
  let outstanding = principalAmount;
  let totalInterest = 0;

  for (let i = 1; i <= tenure; i++) {
    const interestPart = outstanding * monthlyRate;
    const principalPart = emi - interestPart;
    outstanding = Math.max(0, outstanding - principalPart);
    totalInterest += interestPart;

    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    schedule.push({
      installmentNo: i,
      principalPortion: Math.round(principalPart * 100) / 100,
      interestPortion: Math.round(interestPart * 100) / 100,
      totalPayment: Math.round(emi * 100) / 100,
      outstandingAfter: Math.round(outstanding * 100) / 100,
      dueDate,
      status: "PENDING",
    });
  }

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + tenure);

  return {
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPayment: Math.round((principalAmount + totalInterest) * 100) / 100,
    monthlyDue: Math.round(emi * 100) / 100,
    interestPortion: Math.round(principalAmount * monthlyRate * 100) / 100,
    schedule,
    endDate,
  };
}

// Static Balance Mode: principal/tenure + fixed interest on original amount
export function calculateStaticBalance(input: DebtInput): DebtCalculation {
  const { principalAmount, interestRate, tenure = 12, startDate, fixedEMI } = input;
  const monthlyRate = interestRate / 100 / 12;

  // Static: interest stays constant on original principal
  const monthlyInterest = principalAmount * monthlyRate;
  const monthlyPrincipal = principalAmount / tenure;
  const emi = fixedEMI || (monthlyPrincipal + monthlyInterest);

  const schedule: InstallmentSchedule[] = [];
  let outstanding = principalAmount;
  let totalInterest = 0;

  for (let i = 1; i <= tenure; i++) {
    const interestPart = monthlyInterest;
    const principalPart = emi - interestPart;
    outstanding = Math.max(0, outstanding - principalPart);
    totalInterest += interestPart;

    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    schedule.push({
      installmentNo: i,
      principalPortion: Math.round(principalPart * 100) / 100,
      interestPortion: Math.round(interestPart * 100) / 100,
      totalPayment: Math.round(emi * 100) / 100,
      outstandingAfter: Math.round(outstanding * 100) / 100,
      dueDate,
      status: "PENDING",
    });
  }

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + tenure);

  return {
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPayment: Math.round((principalAmount + totalInterest) * 100) / 100,
    monthlyDue: Math.round(emi * 100) / 100,
    interestPortion: Math.round(monthlyInterest * 100) / 100,
    schedule,
    endDate,
  };
}

// Calculate debt for credit card (revolving, minimum payment)
export function calculateCreditCardDues(
  balance: number,
  creditLimit: number,
  interestRate: number,
  minimumPaymentPercent: number = 5
): {
  monthlyDue: number;
  interestPortion: number;
  minimumPayment: number;
  utilization: number;
  warning: string | null;
} {
  const monthlyRate = interestRate / 100 / 12;
  const interestPortion = balance * monthlyRate;
  const minimumPayment = Math.max(
    balance * (minimumPaymentPercent / 100),
    interestPortion + 500 // minimum 500 BDT over interest
  );
  const utilization = creditLimit > 0 ? (balance / creditLimit) * 100 : 0;

  let warning: string | null = null;
  if (utilization > 80) warning = "High credit utilization - may affect credit score";
  else if (utilization > 60) warning = "Moderate credit utilization - consider reducing balance";

  return {
    monthlyDue: Math.round(minimumPayment * 100) / 100,
    interestPortion: Math.round(interestPortion * 100) / 100,
    minimumPayment: Math.round(minimumPayment * 100) / 100,
    utilization: Math.round(utilization * 100) / 100,
    warning,
  };
}

// Format debt output for display
export function formatDebtOutput(
  debtName: string,
  calc: DebtCalculation,
  currencySymbol: string = "৳"
): string {
  const lines = [
    `**${debtName}**`,
    `• Pay: ${currencySymbol}${calc.monthlyDue.toLocaleString()} this month`,
    `• Interest portion: ${currencySymbol}${calc.interestPortion.toLocaleString()}`,
    `• Remaining: ${currencySymbol}${calc.schedule[0]?.outstandingAfter.toLocaleString() || "0"} after next payment`,
    `• Total to pay: ${currencySymbol}${calc.totalPayment.toLocaleString()} over ${calc.schedule.length} months`,
    `• Total interest: ${currencySymbol}${calc.totalInterest.toLocaleString()}`,
    `• Payoff date: ${calc.endDate.toLocaleDateString("en-BD", { month: "long", year: "numeric" })}`,
  ];
  return lines.join("\n");
}

// Get paydown strategy: debt avalanche vs snowball
export function getPaydownStrategy(
  debts: Array<{
    name: string;
    outstanding: number;
    interestRate: number;
    monthlyDue: number;
  }>
): {
  avalanche: string[]; // highest interest first
  snowball: string[]; // smallest balance first
  totalMonthly: number;
} {
  const avalanche = [...debts]
    .sort((a, b) => b.interestRate - a.interestRate)
    .map((d) => d.name);

  const snowball = [...debts]
    .sort((a, b) => a.outstanding - b.outstanding)
    .map((d) => d.name);

  return {
    avalanche,
    snowball,
    totalMonthly: debts.reduce((s, d) => s + d.monthlyDue, 0),
  };
}
