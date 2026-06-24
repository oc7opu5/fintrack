// Email parser - extract transactions from email text
export function parseEmailContent(emailContent: string): string[] {
  const transactions: string[] = [];

  // Common email patterns for receipts/transactions
  const patterns = [
    // "You spent $X on Y"
    /(?:you\s+)?(?:spent|paid|charged|purchased)\s+\$?(\d+(?:\.\d{2})?)\s+(?:on|for|at)\s+(.+?)(?:\.|$)/gi,
    // "Payment of $X to Y"
    /payment\s+of\s+\$?(\d+(?:\.\d{2})?)\s+to\s+(.+?)(?:\.|$)/gi,
    // "Transaction: $X - Y"
    /transaction:?\s*\$?(\d+(?:\.\d{2})?)\s*[-–]\s*(.+?)(?:\.|$)/gi,
    // "$X debit/credit at Y"
    /\$?(\d+(?:\.\d{2})?)\s+(?:debit|credit)\s+(?:at|from|to)\s+(.+?)(?:\.|$)/gi,
    // "Order #XXX confirmed. Total: $X"
    /order\s+#?\w+.*?total:?\s*\$?(\d+(?:\.\d{2})?)/gi,
    // BDT patterns
    /(?:spent|paid|bought)\s+(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:taka|bdt|tk)\s+(?:on|for|at)\s+(.+?)(?:\.|$)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(emailContent)) !== null) {
      const amount = match[1];
      const description = match[2]?.trim() || "Transaction";
      transactions.push(`spent ${amount} on ${description}`);
    }
  }

  return transactions;
}

// PDF receipt parser (extracts text patterns)
export function parseReceiptText(text: string): {
  merchant?: string;
  amount?: number;
  date?: string;
  items?: Array<{ name: string; price: number }>;
} {
  const result: { merchant?: string; amount?: number; date?: string; items?: Array<{ name: string; price: number }> } = {};

  // Extract total amount
  const totalPatterns = [
    /total:?\s*\$?([\d,]+(?:\.\d{2})?)/i,
    /amount\s+due:?\s*\$?([\d,]+(?:\.\d{2})?)/i,
    /grand\s+total:?\s*\$?([\d,]+(?:\.\d{2})?)/i,
    /(?:taka|bdt|tk)\s*([\d,]+(?:\.\d{2})?)/i,
  ];

  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.amount = parseFloat(match[1].replace(/,/g, ""));
      break;
    }
  }

  // Extract date
  const datePatterns = [
    /date:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4})/i,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.date = match[1];
      break;
    }
  }

  // Extract merchant (first meaningful line or "Store: X")
  const merchantPatterns = [
    /store:?\s*(.+)/i,
    /merchant:?\s*(.+)/i,
    /vendor:?\s*(.+)/i,
  ];

  for (const pattern of merchantPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.merchant = match[1].trim();
      break;
    }
  }

  // Extract line items
  const itemPattern = /(.+?)\s+\$?([\d,]+(?:\.\d{2})?)$/gm;
  const items: Array<{ name: string; price: number }> = [];
  let itemMatch;

  while ((itemMatch = itemPattern.exec(text)) !== null) {
    const name = itemMatch[1].trim();
    const price = parseFloat(itemMatch[2].replace(/,/g, ""));
    if (name.length > 1 && price > 0 && !name.toLowerCase().includes("total")) {
      items.push({ name, price });
    }
  }

  if (items.length > 0) {
    result.items = items;
  }

  return result;
}

// Image/OCR text parser
export function parseOCRText(text: string): string[] {
  // Similar to email parser but optimized for OCR output
  const transactions: string[] = [];

  const patterns = [
    // Receipt-style
    /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*$/gm,
    // With item names
    /(.+?)\s+(\d+(?:,\d{3})*(?:\.\d{2})?)\s*$/gm,
    // Total lines
    /total:?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
  ];

  // Find all amounts
  const amounts: number[] = [];
  const amountRegex = /(\d+(?:,\d{3})*(?:\.\d{2})?)/g;
  let match;

  while ((match = amountRegex.exec(text)) !== null) {
    const num = parseFloat(match[1].replace(/,/g, ""));
    if (num > 0 && num < 1000000) {
      amounts.push(num);
    }
  }

  // The largest amount is likely the total
  if (amounts.length > 0) {
    const maxAmount = Math.max(...amounts);
    transactions.push(`spent ${maxAmount} on receipt`);
  }

  return transactions;
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
