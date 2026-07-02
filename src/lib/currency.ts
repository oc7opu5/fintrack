// Multi-Currency Engine for MindLedger AI
// Supports: BDT (base), USD, CAD with live conversion

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  rateToBase: number;
  isBase: boolean;
}

// Default currencies with rates (initial seed values)
export const DEFAULT_CURRENCIES: CurrencyInfo[] = [
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", rateToBase: 1, isBase: true },
  { code: "USD", name: "US Dollar", symbol: "$", rateToBase: 110, isBase: false },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", rateToBase: 80, isBase: false },
];

export const BASE_CURRENCY = "BDT";
export const SUPPORTED_CURRENCIES = ["BDT", "USD", "CAD"] as const;

// Convert amount from one currency to another via base (BDT)
export function convertCurrency(
  amount: number,
  fromCode: string,
  toCode: string,
  rates: Record<string, number>
): number {
  if (fromCode === toCode) return amount;

  const baseAmount = fromCode === BASE_CURRENCY
    ? amount
    : amount * rates[fromCode];

  return toCode === BASE_CURRENCY
    ? baseAmount
    : baseAmount / rates[toCode];
}

// Format currency with symbol and appropriate decimal places
export function formatCurrency(amount: number, currencyCode: string = "BDT"): string {
  const symbols: Record<string, string> = { BDT: "৳", USD: "$", CAD: "C$" };
  const symbol = symbols[currencyCode] || "৳";
  const decimals = currencyCode === "BDT" ? 0 : 2;

  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);

  return currencyCode === "BDT" ? `${symbol}${formatted}` : `${symbol}${formatted}`;
}

// Get current exchange rate
export async function fetchExchangeRates(apiKey?: string): Promise<Record<string, number>> {
  // Try free exchange rate API
  try {
    // Using exchangerate-api.com free tier or fallback to fixed rates
    const url = apiKey
      ? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/BDT`
      : "https://open.er-api.com/v6/latest/BDT";

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const rates: Record<string, number> = {};
      for (const code of SUPPORTED_CURRENCIES) {
        if (code === BASE_CURRENCY) {
          rates[code] = 1;
        } else if (data.rates?.[code]) {
          rates[code] = data.rates[code];
        }
      }
      return rates;
    }
  } catch (e) {
    console.warn("Failed to fetch exchange rates, using default rates", e);
  }

  // Fallback to default rates
  return { BDT: 1, USD: 110, CAD: 80 };
}

// Currency display helper for multi-currency summary
export function getMultiCurrencySummary(
  transactions: Array<{ amount: number; currency: string; type: "INCOME" | "EXPENSE" }>,
  rates: Record<string, number>
): {
  totalIncomeBDT: number;
  totalExpenseBDT: number;
  byCurrency: Record<string, { income: number; expense: number }>;
} {
  const summary = {
    totalIncomeBDT: 0,
    totalExpenseBDT: 0,
    byCurrency: {} as Record<string, { income: number; expense: number }>,
  };

  for (const tx of transactions) {
    const code = tx.currency || BASE_CURRENCY;
    if (!summary.byCurrency[code]) {
      summary.byCurrency[code] = { income: 0, expense: 0 };
    }

    if (tx.type === "INCOME") {
      summary.byCurrency[code].income += tx.amount;
    } else {
      summary.byCurrency[code].expense += tx.amount;
    }

    const bdtAmount = convertCurrency(tx.amount, code, BASE_CURRENCY, rates);
    if (tx.type === "INCOME") {
      summary.totalIncomeBDT += bdtAmount;
    } else {
      summary.totalExpenseBDT += bdtAmount;
    }
  }

  return summary;
}
