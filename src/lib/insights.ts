// AI Insight Engine for MindLedger AI
// Generates spending patterns, risk detection, debt stress scores, savings capacity

export interface FinancialSnapshot {
  monthlyIncome: number;
  monthlyExpense: number;
  totalBalance: number;
  totalDebt: number;
  monthlyDebtPayments: number;
  categoryBreakdown: Array<{ category: string; amount: number; percentage: number }>;
  subscriptionCost: number;
  previousMonthExpense?: number;
  previousMonthIncome?: number;
}

export interface InsightResult {
  type: "spending_pattern" | "risk_alert" | "savings_tip" | "debt_stress" | "financial_health";
  title: string;
  content: string;
  severity: "info" | "warning" | "critical";
  metadata: Record<string, any>;
}

// Generate all insights for a financial snapshot
export function generateInsights(snapshot: FinancialSnapshot): InsightResult[] {
  const insights: InsightResult[] = [];

  // Spending pattern analysis
  const spendingInsights = analyzeSpending(snapshot);
  insights.push(...spendingInsights);

  // Risk detection
  const riskInsights = detectRisks(snapshot);
  insights.push(...riskInsights);

  // Savings tips
  const savingsTips = generateSavingsTips(snapshot);
  insights.push(...savingsTips);

  // Debt stress analysis
  const debtInsights = analyzeDebtStress(snapshot);
  insights.push(...debtInsights);

  // Financial health score
  const healthInsight = calculateFinancialHealth(snapshot);
  insights.push(healthInsight);

  return insights;
}

function analyzeSpending(snapshot: FinancialSnapshot): InsightResult[] {
  const insights: InsightResult[] = [];
  const topCategory = snapshot.categoryBreakdown[0];

  if (topCategory && topCategory.percentage > 40) {
    insights.push({
      type: "spending_pattern",
      title: `High concentration in ${topCategory.category}`,
      content: `${topCategory.category} accounts for ${topCategory.percentage}% of your expenses this month. Consider reducing this by 15% to save approximately ${formatBDT(Math.round(topCategory.amount * 0.15))} per month.`,
      severity: topCategory.percentage > 50 ? "critical" : "warning",
      metadata: { category: topCategory.category, percentage: topCategory.percentage, potentialSavings: Math.round(topCategory.amount * 0.15) },
    });
  }

  // Food & Dining overspending
  const food = snapshot.categoryBreakdown.find(c => c.category.toLowerCase().includes("food"));
  if (food && food.percentage > 30) {
    insights.push({
      type: "spending_pattern",
      title: "Food spending is high",
      content: `Food & Dining is ${food.percentage}% of expenses. Consider meal prepping - saving just 15% on food could free up ${formatBDT(Math.round(food.amount * 0.15))} monthly.`,
      severity: "warning",
      metadata: { category: food.category, percentage: food.percentage },
    });
  }

  // Month-over-month change
  if (snapshot.previousMonthExpense && snapshot.previousMonthExpense > 0) {
    const change = Math.round(((snapshot.monthlyExpense - snapshot.previousMonthExpense) / snapshot.previousMonthExpense) * 100);
    if (change > 20) {
      insights.push({
        type: "spending_pattern",
        title: `Spending increased ${change}% vs last month`,
        content: `Monthly expenses jumped from ${formatBDT(snapshot.previousMonthExpense)} to ${formatBDT(snapshot.monthlyExpense)}. Review recent transactions to identify the cause.`,
        severity: change > 40 ? "critical" : "warning",
        metadata: { changePercent: change, previousMonth: snapshot.previousMonthExpense },
      });
    } else if (change < -10) {
      insights.push({
        type: "spending_pattern",
        title: `Spending decreased ${Math.abs(change)}%`,
        content: `Great job! Expenses dropped ${Math.abs(change)}% from last month. Keep it up!`,
        severity: "info",
        metadata: { changePercent: change },
      });
    }
  }

  return insights;
}

function detectRisks(snapshot: FinancialSnapshot): InsightResult[] {
  const insights: InsightResult[] = [];
  const savingsRate = snapshot.monthlyIncome > 0
    ? ((snapshot.monthlyIncome - snapshot.monthlyExpense) / snapshot.monthlyIncome) * 100
    : 0;

  // Low savings rate
  if (savingsRate < 10 && snapshot.monthlyIncome > 0) {
    insights.push({
      type: "risk_alert",
      title: `Low savings rate: ${Math.round(savingsRate)}%`,
      content: `With ${formatBDT(snapshot.monthlyIncome)} monthly income and ${formatBDT(snapshot.monthlyExpense)} expenses, you're saving only ${Math.round(savingsRate)}%. Aim for at least 20%. That means reducing expenses by ${formatBDT(Math.round(snapshot.monthlyExpense - snapshot.monthlyIncome * 0.8))} per month.`,
      severity: savingsRate < 0 ? "critical" : "warning",
      metadata: { savingsRate, savingsAmount: snapshot.monthlyIncome - snapshot.monthlyExpense },
    });
  }

  // High discretionary spending
  const discretionary = snapshot.categoryBreakdown
    .filter(c => !["rent", "bills", "utilities", "healthcare", "education"].includes(c.category.toLowerCase()))
    .reduce((s, c) => s + c.percentage, 0);

  if (discretionary > 60) {
    insights.push({
      type: "risk_alert",
      title: "High discretionary spending",
      content: `${Math.round(discretionary)}% of expenses are discretionary. While enjoying life is important, consider setting a discretionary budget of 50% max.`,
      severity: "warning",
      metadata: { discretionaryPercent: Math.round(discretionary) },
    });
  }

  // Spending more than earning
  if (snapshot.monthlyExpense > snapshot.monthlyIncome && snapshot.monthlyIncome > 0) {
    const deficit = snapshot.monthlyExpense - snapshot.monthlyIncome;
    insights.push({
      type: "risk_alert",
      title: "Overspending alert",
      content: `You spent ${formatBDT(deficit)} more than you earned this month. At this rate, your balances will deplete in ${snapshot.totalBalance > 0 ? Math.round(snapshot.totalBalance / deficit) : 0} months.`,
      severity: "critical",
      metadata: { deficit },
    });
  }

  return insights;
}

function generateSavingsTips(snapshot: FinancialSnapshot): InsightResult[] {
  const insights: InsightResult[] = [];

  // Subscription optimization
  if (snapshot.subscriptionCost > 0) {
    const annualCost = snapshot.subscriptionCost * 12;
    insights.push({
      type: "savings_tip",
      title: "Subscription review",
      content: `You spend ${formatBDT(snapshot.subscriptionCost)}/month (${formatBDT(annualCost)}/year) on subscriptions. Review each one - cancel unused ones to save potentially ${formatBDT(Math.round(annualCost * 0.3))} per year.`,
      severity: "info",
      metadata: { monthlyCost: snapshot.subscriptionCost, annualCost },
    });
  }

  // Savings capacity
  const potentialSavings = snapshot.monthlyIncome > 0
    ? Math.round(snapshot.monthlyIncome * 0.3)
    : 0;

  if (potentialSavings > 0) {
    insights.push({
      type: "savings_tip",
      title: "Savings capacity",
      content: `Based on your income, you could save up to ${formatBDT(potentialSavings)}/month by following the 50/30/20 rule. Your current savings: ${formatBDT(snapshot.monthlyIncome - snapshot.monthlyExpense)}/month.`,
      severity: "info",
      metadata: { potentialSavings, currentSavings: snapshot.monthlyIncome - snapshot.monthlyExpense },
    });
  }

  return insights;
}

function analyzeDebtStress(snapshot: FinancialSnapshot): InsightResult[] {
  const insights: InsightResult[] = [];

  if (snapshot.totalDebt <= 0) return insights;

  // Debt-to-income ratio
  const debtToIncome = snapshot.monthlyIncome > 0
    ? (snapshot.monthlyDebtPayments / snapshot.monthlyIncome) * 100
    : 0;

  const stressScore = calculateDebtStressScore(snapshot);

  if (debtToIncome > 40) {
    insights.push({
      type: "debt_stress",
      title: `Critical debt stress score: ${stressScore}/100`,
      content: `Your debt payments consume ${Math.round(debtToIncome)}% of monthly income (${formatBDT(snapshot.monthlyDebtPayments)}/month). This is dangerously high. Consider: debt consolidation, negotiating rates, or increasing income.`,
      severity: "critical",
      metadata: { debtToIncome, stressScore, monthlyDebtPayments: snapshot.monthlyDebtPayments },
    });
  } else if (debtToIncome > 25) {
    insights.push({
      type: "debt_stress",
      title: `Moderate debt stress score: ${stressScore}/100`,
      content: `Debt payments are ${Math.round(debtToIncome)}% of income (${formatBDT(snapshot.monthlyDebtPayments)}/month). Try to keep it below 25%. Focus on paying down highest-interest debts first.`,
      severity: "warning",
      metadata: { debtToIncome, stressScore },
    });
  } else if (snapshot.totalDebt > 0) {
    insights.push({
      type: "debt_stress",
      title: `Healthy debt stress score: ${stressScore}/100`,
      content: `Your debt burden is manageable at ${Math.round(debtToIncome)}% of income. Keep it up and pay extra toward principal when possible.`,
      severity: "info",
      metadata: { debtToIncome, stressScore },
    });
  }

  return insights;
}

function calculateDebtStressScore(snapshot: FinancialSnapshot): number {
  const debtToIncome = snapshot.monthlyIncome > 0
    ? (snapshot.monthlyDebtPayments / snapshot.monthlyIncome) * 100
    : 0;

  const debtToBalance = snapshot.totalBalance > 0
    ? (snapshot.totalDebt / snapshot.totalBalance) * 100
    : snapshot.totalDebt > 0 ? 100 : 0;

  // 0-100 where 0 = best, 100 = worst
  const debtRatioScore = Math.min(100, debtToIncome * 2.5); // 40% DTI = 100
  const balanceRatioScore = Math.min(100, debtToBalance);
  const savingsPenalty = snapshot.monthlyIncome > 0
    ? Math.max(0, 100 - ((snapshot.monthlyIncome - snapshot.monthlyExpense) / snapshot.monthlyIncome) * 100)
    : 0;

  return Math.round((debtRatioScore * 0.5) + (balanceRatioScore * 0.25) + (savingsPenalty * 0.25));
}

function calculateFinancialHealth(snapshot: FinancialSnapshot): InsightResult {
  // 0-100 health score
  const savingsRate = snapshot.monthlyIncome > 0
    ? ((snapshot.monthlyIncome - snapshot.monthlyExpense) / snapshot.monthlyIncome) * 100
    : 0;

  const debtToIncome = snapshot.monthlyIncome > 0
    ? (snapshot.monthlyDebtPayments / snapshot.monthlyIncome) * 100
    : 0;

  // Score components
  const savingsScore = Math.min(100, savingsRate * 4); // 25% rate = 100
  const debtScore = Math.max(0, 100 - debtToIncome * 2.5); // 0% DTI = 100, 40% = 0
  const balanceScore = snapshot.totalBalance > 0 ? Math.min(100, Math.max(0, 60)) : 20;
  const stabilityScore = snapshot.previousMonthExpense
    ? Math.max(0, 100 - Math.abs(((snapshot.monthlyExpense - snapshot.previousMonthExpense) / snapshot.previousMonthExpense) * 200))
    : 50;

  const healthScore = Math.round(
    (savingsScore * 0.35) + (debtScore * 0.35) + (balanceScore * 0.15) + (stabilityScore * 0.15)
  );

  let assessment = "";
  if (healthScore >= 80) assessment = "Excellent! Your finances are in great shape. Keep doing what you're doing.";
  else if (healthScore >= 60) assessment = "Good. You're on the right track. Focus on building savings and reducing debt.";
  else if (healthScore >= 40) assessment = "Fair. Your finances need attention. Focus on reducing expenses and building an emergency fund.";
  else assessment = "Needs improvement. Take immediate action: cut unnecessary expenses, create a budget, and start saving.";

  return {
    type: "financial_health",
    title: `Financial Health Score: ${healthScore}/100`,
    content: assessment,
    severity: healthScore >= 60 ? "info" : healthScore >= 40 ? "warning" : "critical",
    metadata: {
      healthScore,
      components: { savingsScore, debtScore, balanceScore, stabilityScore },
      savingsRate: Math.round(savingsRate),
      debtToIncome: Math.round(debtToIncome),
    },
  };
}

function formatBDT(amount: number): string {
  return `৳${Math.round(amount).toLocaleString()}`;
}

// For AI-enhanced insights
export function buildInsightPrompt(snapshot: FinancialSnapshot): string {
  return `Analyze this financial data and provide 3-5 key insights:

Monthly Income: ৳${snapshot.monthlyIncome.toLocaleString()}
Monthly Expenses: ৳${snapshot.monthlyExpense.toLocaleString()}
Total Balance: ৳${snapshot.totalBalance.toLocaleString()}
Total Debt: ৳${snapshot.totalDebt.toLocaleString()}
Monthly Debt Payments: ৳${snapshot.monthlyDebtPayments.toLocaleString()}
Subscription Cost: ৳${snapshot.subscriptionCost.toLocaleString()}/month

Category Breakdown:
${snapshot.categoryBreakdown.map(c => `- ${c.category}: ৳${c.amount.toLocaleString()} (${c.percentage}%)`).join("\n")}

${snapshot.previousMonthExpense ? `Previous Month Expense: ৳${snapshot.previousMonthExpense.toLocaleString()}` : ""}

Provide analysis in this JSON format:
{
  "insights": [
    {
      "type": "spending_pattern" | "risk_alert" | "savings_tip" | "debt_stress" | "financial_health",
      "title": "short title",
      "content": "detailed analysis",
      "severity": "info" | "warning" | "critical"
    }
  ]
}`;
}
