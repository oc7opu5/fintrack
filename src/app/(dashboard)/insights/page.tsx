"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Lightbulb, AlertTriangle, Bell, TrendingUp, TrendingDown, BarChart3, RefreshCw, Sparkles, Loader2 } from "lucide-react";

const SEVERITY_ICONS: Record<string, any> = { info: Lightbulb, warning: AlertTriangle, critical: Bell };
const TYPE_ICONS: Record<string, any> = {
  spending_pattern: BarChart3, risk_alert: AlertTriangle, savings_tip: Sparkles, debt_stress: TrendingDown, financial_health: TrendingUp,
};

export default function InsightsPage() {
  const utils = trpc.useUtils();
  const { data: insights, isLoading } = trpc.insight.list.useQuery({ unreadOnly: false });
  const markRead = trpc.insight.markRead.useMutation({ onSuccess: () => utils.insight.list.invalidate() });
  const markAllRead = trpc.insight.markAllRead.useMutation({ onSuccess: () => utils.insight.list.invalidate() });
  const generateInsights = trpc.insight.generate.useMutation({
    onSuccess: () => {
      utils.insight.list.invalidate();
      utils.insight.unreadCount.invalidate();
    },
  });

  const insightsList = insights || [];
  const unreadCount = insightsList.filter((i: any) => !i.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Lightbulb className="w-6 h-6" />AI Insights</h1>
          <p className="text-muted-foreground">Spending patterns, risk alerts, savings tips & financial health</p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>Mark All Read ({unreadCount})</Button>}
          <Button size="sm" onClick={() => generateInsights.mutate()} disabled={generateInsights.isPending} className="gap-1">
            {generateInsights.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {generateInsights.isPending ? "Generating..." : "Refresh Insights"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">{[1, 2, 3, 4].map((i) => <Card key={i} className="animate-pulse"><CardContent className="pt-6"><div className="h-24 bg-muted rounded" /></CardContent></Card>)}</div>
      ) : insightsList.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {insightsList.map((insight: any) => {
            const Icon = TYPE_ICONS[insight.type] || Lightbulb;
            const SeverityIcon = SEVERITY_ICONS[insight.severity] || Lightbulb;
            const borderColor = insight.severity === "critical" ? "border-rose-500" : insight.severity === "warning" ? "border-amber-500" : "border-blue-500";
            const bgColor = insight.severity === "critical" ? "bg-rose-50 dark:bg-rose-950/20" : insight.severity === "warning" ? "bg-amber-50 dark:bg-amber-950/20" : "bg-blue-50 dark:bg-blue-950/20";

            return (
              <Card key={insight.id} className={`border-l-4 ${borderColor} ${insight.isRead ? "opacity-70" : ""} ${bgColor} transition-all cursor-pointer`} onClick={() => { if (!insight.isRead) markRead.mutate({ id: insight.id }); }}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${insight.severity === "critical" ? "bg-rose-100 dark:bg-rose-900/20" : insight.severity === "warning" ? "bg-amber-100 dark:bg-amber-900/20" : "bg-blue-100 dark:bg-blue-900/20"}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{insight.title}</p>
                        <div className="flex items-center gap-1">
                          {!insight.isRead && <Badge variant="default" className="text-xs">New</Badge>}
                          <SeverityIcon className={`w-3 h-3 ${insight.severity === "critical" ? "text-rose-500" : insight.severity === "warning" ? "text-amber-500" : "text-blue-500"}`} />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">{insight.content}</p>
                      {insight.metadata && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {insight.metadata.healthScore !== undefined && <Badge variant="outline" className="text-xs">Health: {insight.metadata.healthScore}/100</Badge>}
                          {insight.metadata.stressScore !== undefined && <Badge variant="outline" className="text-xs">Stress: {insight.metadata.stressScore}/100</Badge>}
                          {insight.metadata.debtToIncome !== undefined && <Badge variant="outline" className="text-xs">DTI: {insight.metadata.debtToIncome}%</Badge>}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <Lightbulb className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Insights Yet</h2>
            <p className="text-muted-foreground mb-6">Generate AI-powered insights from your financial data.</p>
            <Button onClick={() => generateInsights.mutate()} size="lg" disabled={generateInsights.isPending} className="gap-2">
              <Sparkles className="w-5 h-5" />
              {generateInsights.isPending ? "Generating..." : "Generate Insights"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
