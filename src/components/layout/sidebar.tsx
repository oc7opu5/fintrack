"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  CreditCard,
  RefreshCw,
  PieChart,
  BarChart3,
  Settings,
  LogOut,
  Bot,
  Sparkles,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { name: "Accounts", href: "/accounts", icon: Wallet },
  { name: "Credit Cards", href: "/credit-cards", icon: CreditCard },
  { name: "Subscriptions", href: "/subscriptions", icon: RefreshCw },
  { name: "Budget", href: "/budget", icon: PieChart },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "AI Assistant", href: "/chat", icon: Bot },
  { name: "AI Settings", href: "/settings/ai", icon: Sparkles },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r bg-card">
      <div className="flex items-center gap-2 p-6 border-b">
        <Wallet className="w-8 h-8 text-primary" />
        <span className="text-xl font-bold">FinTrack</span>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="w-5 h-5" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
