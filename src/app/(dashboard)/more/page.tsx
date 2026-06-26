"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PieChart,
  BarChart3,
  Settings,
  RefreshCw,
  CreditCard,
  LogOut,
  Bot,
  Sparkles,
} from "lucide-react";
import { signOut } from "next-auth/react";

const moreItems = [
  { name: "Subscriptions", href: "/subscriptions", icon: RefreshCw, description: "Track recurring payments" },
  { name: "Budget", href: "/budget", icon: PieChart, description: "Set spending limits" },
  { name: "Reports", href: "/reports", icon: BarChart3, description: "View analytics" },
  { name: "AI Assistant", href: "/chat", icon: Bot, description: "Chat with AI about finances" },
  { name: "AI Settings", href: "/settings/ai", icon: Sparkles, description: "Configure AI providers" },
  { name: "Settings", href: "/settings", icon: Settings, description: "Manage account" },
];

export default function MorePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">More</h1>
        <p className="text-muted-foreground">Additional features and settings</p>
      </div>
      <div className="space-y-3">
        {moreItems.map((item) => (
          <Link key={item.name} href={item.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center"><item.icon className="w-5 h-5 text-primary" /></div>
                  <div><p className="font-medium">{item.name}</p><p className="text-sm text-muted-foreground">{item.description}</p></div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <Button variant="outline" className="w-full" onClick={() => signOut({ callbackUrl: "/login" })}><LogOut className="w-4 h-4 mr-2" />Sign out</Button>
    </div>
  );
}
