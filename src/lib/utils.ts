import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "BDT"): string {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-BD", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-BD", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getAccountTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    BKASH: "📱",
    NAGAD: "💳",
    ROCKET: "🚀",
    MOBILE_BANKING: "🏦",
    CREDIT_CARD: "💳",
    DEBIT_CARD: "💳",
    BANK_ACCOUNT: "🏛️",
    CASH: "💵",
    OTHER: "💰",
  };
  return icons[type] || "💰";
}

export function getAccountTypeColor(type: string): string {
  const colors: Record<string, string> = {
    BKASH: "#E2136E",
    NAGAD: "#F6921E",
    ROCKET: "#ED1C24",
    MOBILE_BANKING: "#1A73E8",
    CREDIT_CARD: "#635BFF",
    DEBIT_CARD: "#00A862",
    BANK_ACCOUNT: "#1B5E20",
    CASH: "#4CAF50",
    OTHER: "#757575",
  };
  return colors[type] || "#757575";
}
