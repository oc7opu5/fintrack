"use client";

import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-background">
        <div className="flex">
          <Sidebar />
          <div className="flex-1 flex flex-col min-h-screen">
            <Topbar />
            <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6 overflow-auto">
              {children}
            </main>
          </div>
        </div>
        <MobileNav />
      </div>
    </SessionProvider>
  );
}
