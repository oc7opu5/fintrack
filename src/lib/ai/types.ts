export interface ParsedTransaction {
  type: "INCOME" | "EXPENSE";
  amount: number;
  description: string;
  category?: string;
  account?: string;
  date: string;
  confidence: number;
}

export interface ParseResult {
  success: boolean;
  transaction?: ParsedTransaction;
  transactions?: ParsedTransaction[];
  error?: string;
  provider: string;
  model: string;
  latencyMs: number;
}
