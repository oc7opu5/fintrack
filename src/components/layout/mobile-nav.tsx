"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Notebook,
  Bot,
  MoreHorizontal,
} from "lucide-react";

const mainNav = [
  { name: "Home", href: "/dashboard", icon: LayoutDashboard },
  { name: "Journal", href: "/journal", icon: Notebook },
  { name: "Add", href: "/transactions/new", icon: ArrowLeftRight, isAction: true },
  { name: "AI Chat", href: "/chat", icon: Bot },
  { name: "More", href: "/more", icon: MoreHorizontal },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-50">
      <nav className="flex items-center justify-around h-16">
        {mainNav.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors",
                item.isAction
                  ? "text-primary"
                  : isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              {item.isAction ? (
                <div className="w-12 h-12 -mt-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                  <item.icon className="w-6 h-6 text-primary-foreground" />
                </div>
              ) : (
                <item.icon className="w-5 h-5" />
              )}
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
