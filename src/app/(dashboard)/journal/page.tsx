"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Notebook, Sparkles, Calendar, TrendingUp, TrendingDown, BarChart3, Loader2, Wallet } from "lucide-react";

export default function JournalPage() {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [extractedTxs, setExtractedTxs] = useState<any[]>([]);
  const [summary, setSummary] = useState("");
  const [saveStatus, setSaveStatus] = useState("");

  const utils = trpc.useUtils();
  const { data: entries } = trpc.journal.list.useQuery({ limit: 20 });
  const { data: journalSummary } = trpc.journal.summary.useQuery({ period: "monthly" });

  const parseMutation = trpc.ai.parse.useMutation();
  const createJournalEntry = trpc.journal.create.useMutation({
    onSuccess: () => {
      utils.journal.list.invalidate();
      utils.journal.summary.invalidate();
      setSaveStatus("Saved ✓");
      setTimeout(() => setSaveStatus(""), 3000);
    },
  });

  const handleParseAndSave = async () => {
    if (!rawText.trim()) return;
    setParsing(true);

    try {
      const result = await parseMutation.mutateAsync({ input: rawText });
      if (result.success) {
        const txs = result.transactions || [];
        setExtractedTxs(txs);
        await createJournalEntry.mutateAsync({
          rawText,
          extractedTxs: txs,
          summary: `Parsed ${txs.length} transaction(s): ${txs.map((t: any) => `${t.description} (${formatCurrency(t.amount)})`).join(", ")}`,
          tags: txs.map((t: any) => t.category).filter(Boolean),
        });
        setSummary(`Found ${txs.length} transaction(s) from your journal entry.`);
        setRawText("");
      }
    } catch (e) {
      setSummary("Failed to parse. Try being more specific.");
    }
    setParsing(false);
  };

  const handleSaveRaw = async () => {
    if (!rawText.trim()) return;
    await createJournalEntry.mutateAsync({
      rawText,
      extractedTxs: [],
      summary: "Saved as raw journal entry",
      tags: [],
    });
    setRawText("");
    setSaveStatus("Saved ✓");
    setTimeout(() => setSaveStatus(""), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Notebook className="w-6 h-6" />AI Money Journal</h1>
          <p className="text-muted-foreground">Write freely - AI extracts transactions automatically</p>
        </div>
      </div>

      {/* Input Area */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5" />New Journal Entry</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder='Write your daily money journal... 
Example: "Spent 500 BDT on lunch, received 5000 from freelance work. Also bought groceries for 1200 with bKash."'
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="min-h-[120px]"
          />
          <div className="flex gap-2">
            <Button onClick={handleParseAndSave} disabled={!rawText.trim() || parsing} className="gap-2">
              {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {parsing ? "Parsing..." : "Parse & Save"}
            </Button>
            <Button variant="outline" onClick={handleSaveRaw} disabled={!rawText.trim() || createJournalEntry.isPending}>
              Save Raw Note
            </Button>
            {saveStatus && <p className="text-sm text-emerald-500 flex items-center">{saveStatus}</p>}
          </div>
          {extractedTxs.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="font-medium text-sm mb-2">Extracted Transactions:</p>
              <div className="space-y-2">
                {extractedTxs.map((tx: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {tx.type === "INCOME" ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-rose-500" />}
                      <span>{tx.description}</span>
                      {tx.category && <Badge variant="outline" className="text-xs">{tx.category}</Badge>}
                    </div>
                    <span className={tx.type === "INCOME" ? "text-emerald-500 font-medium" : "text-rose-500 font-medium"}>
                      {tx.type === "INCOME" ? "+" : "-"}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Journal Summary */}
      {journalSummary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" /><p className="text-sm text-muted-foreground">Monthly Income</p></div><p className="text-2xl font-bold text-emerald-500">{formatCurrency(journalSummary.income)}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><TrendingDown className="w-4 h-4 text-rose-500" /><p className="text-sm text-muted-foreground">Monthly Expense</p></div><p className="text-2xl font-bold text-rose-500">{formatCurrency(journalSummary.expense)}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" /><p className="text-sm text-muted-foreground">Net Flow</p></div><p className={`text-2xl font-bold ${journalSummary.net >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{formatCurrency(journalSummary.net)}</p></CardContent></Card>
        </div>
      )}

      {/* Journals & Categories */}
      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries">Journal Entries</TabsTrigger>
          <TabsTrigger value="categories">Category Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="mt-4">
          {entries && entries.length > 0 ? (
            <div className="space-y-4">
              {entries.map((entry: any) => (
                <Card key={entry.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{formatDate(entry.createdAt)}</span>
                          {entry.sentiment && <Badge variant="outline" className="text-xs">{entry.sentiment}</Badge>}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{entry.rawText}</p>
                        {entry.tags && entry.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {entry.tags.map((tag: string, i: number) => (
                              <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        )}
                        {entry.summary && <p className="text-xs text-muted-foreground mt-2 italic">{entry.summary}</p>}
                      </div>
                    </div>
                    {entry.extractedTxs && (entry.extractedTxs as any).length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="space-y-1">
                          {(entry.extractedTxs as any[]).map((tx: any, i: number) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="flex items-center gap-1">{tx.type === "INCOME" ? "💰" : "💸"} {tx.description}</span>
                              <span className={tx.type === "INCOME" ? "text-emerald-500" : "text-rose-500"}>{tx.type === "INCOME" ? "+" : "-"}{formatCurrency(tx.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : <Card><CardContent className="pt-6"><p className="text-muted-foreground text-center py-8">No journal entries yet. Write your first one above!</p></CardContent></Card>}
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          {journalSummary?.categories && journalSummary.categories.length > 0 ? (
            <Card><CardContent className="pt-6">
              <div className="space-y-3">
                {journalSummary.categories.map((cat: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#FF6384"][i % 6] }} />
                      <div>
                        <p className="font-medium text-sm">{cat.name}</p>
                        <p className="text-xs text-muted-foreground">{cat.percentage}% of expenses</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(cat.amount)}</p>
                      <div className="w-24 h-1.5 bg-muted rounded-full mt-1">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, cat.percentage)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          ) : <Card><CardContent className="pt-6"><p className="text-muted-foreground text-center py-8">No category data yet</p></CardContent></Card>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
