"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import {
  Bot,
  Send,
  User,
  Sparkles,
  Loader2,
  AlertCircle,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Wallet,
  TrendingUp,
  TrendingDown,
  CreditCard,
  BarChart3,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: string;
  model?: string;
  latencyMs?: number;
  timestamp: Date;
  isError?: boolean;
}

const SUGGESTIONS = [
  { text: "How much did I spend this month?", icon: TrendingDown },
  { text: "What are my top expenses?", icon: BarChart3 },
  { text: "Am I saving enough?", icon: TrendingUp },
  { text: "Review my subscriptions", icon: CreditCard },
  { text: "Show my account balances", icon: Wallet },
  { text: "Give me financial advice", icon: Sparkles },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const { data: history } = trpc.ai.getHistory.useQuery({ limit: 50 });
  const { data: modelsData } = trpc.ai.getModels.useQuery();
  const chatMutation = trpc.ai.chat.useMutation();
  const clearMutation = trpc.ai.clearHistory.useMutation({
    onSuccess: () => {
      setMessages([]);
      utils.ai.getHistory.invalidate();
    },
  });
  const updateSettingsMutation = trpc.aiSettings.save.useMutation({
    onSuccess: () => utils.aiSettings.get.invalidate(),
  });
  const { data: aiSettings } = trpc.aiSettings.get.useQuery();

  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [aiOnlyMode, setAiOnlyMode] = useState<boolean>(true);

  // Load history
  useEffect(() => {
    if (history && messages.length === 0) {
      setMessages(history.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        provider: m.provider || undefined,
        model: m.model || undefined,
        timestamp: new Date(m.createdAt),
      })));
    }
  }, [history]);

  // Load settings
  useEffect(() => {
    const md = modelsData as any;
    if (md) {
      setSelectedProvider(md.activeProvider || "");
      setSelectedModel(md.activeModel || "");
    }
    const s = aiSettings as any;
    if (s) {
      setAiOnlyMode(s.preferences?.disableLocalFallback ?? true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(modelsData), JSON.stringify(aiSettings)]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (text?: string) => {
    const msg = text || input.trim();
    if (!msg || chatMutation.isPending) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: msg,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    chatMutation.mutate(
      { message: msg },
      {
        onSuccess: (result) => {
          const assistantMessage: Message = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: result.success ? result.response : result.response || "Sorry, I couldn't process that.",
            provider: result.provider,
            model: result.model,
            latencyMs: result.latencyMs,
            timestamp: new Date(),
            isError: !result.success,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        },
        onError: (error) => {
          setMessages((prev) => [...prev, {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `Error: ${error.message}`,
            timestamp: new Date(),
            isError: true,
          }]);
        },
      }
    );
  };

  const handleRetry = (failedMessage: Message) => {
    const idx = messages.findIndex((m) => m.id === failedMessage.id);
    if (idx > 0) {
      const prevUserMsg = messages[idx - 1];
      if (prevUserMsg.role === "user") {
        setMessages((prev) => prev.filter((m) => m.id !== failedMessage.id));
        handleSend(prevUserMsg.content);
      }
    }
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleModelChange = (provider: string, model: string) => {
    setSelectedProvider(provider);
    setSelectedModel(model);
    updateSettingsMutation.mutate({ activeProvider: provider, activeModel: model });
  };

  const toggleAiOnly = () => {
    const newValue = !aiOnlyMode;
    setAiOnlyMode(newValue);
    updateSettingsMutation.mutate({
      preferences: { autoParse: true, showConfidence: true, enableChat: true, disableLocalFallback: newValue },
    });
  };

  const availableProviders: Record<string, { name: string; models: string[]; hasKey?: boolean }> = (modelsData as any)?.providers || {};

  const formatMessage = (content: string) => {
    return content.split("\n").map((line, i) => {
      if (line.startsWith("- ")) {
        return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
      }
      if (line.startsWith("═")) {
        return <div key={i} className="font-bold mt-2">{line}</div>;
      }
      return <span key={i}>{line}<br /></span>;
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6" />
            AI Assistant
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Model Selector */}
          {Object.keys(availableProviders).length > 0 && (
            <>
              <Select value={selectedProvider} onValueChange={(v) => {
                const models = availableProviders[v]?.models || [];
                handleModelChange(v, models[0] || "");
              }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Select Provider" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(availableProviders).map(([id, p]) => (
                    <SelectItem key={id} value={id}>
                      {p.name} {p.hasKey ? "✓" : "(no key)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedProvider && availableProviders[selectedProvider] && (
                <Select value={selectedModel} onValueChange={(v) => handleModelChange(selectedProvider, v)}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Select Model" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProviders[selectedProvider].models.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}

          <Button variant={aiOnlyMode ? "default" : "outline"} size="sm" onClick={toggleAiOnly} className="gap-1">
            {aiOnlyMode ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            {aiOnlyMode ? "AI Only" : "AI + Local"}
          </Button>

          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Hi! I'm your AI financial assistant</h2>
                <p className="text-muted-foreground mt-1">
                  Ask me anything about your finances.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-md">
                {SUGGESTIONS.map((s) => (
                  <Button key={s.text} variant="outline" className="justify-start h-auto py-3 text-left" onClick={() => handleSend(s.text)}>
                    <s.icon className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="text-xs">{s.text}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-lg p-3 ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : message.isError
                  ? "bg-destructive/10 border border-destructive/20"
                  : "bg-muted"
              }`}>
                {message.isError && <AlertCircle className="w-4 h-4 text-destructive mb-1" />}
                <div className="text-sm whitespace-pre-wrap">{formatMessage(message.content)}</div>
                <div className="flex items-center justify-between mt-2 gap-2">
                  <div className="flex items-center gap-2">
                    <p className={`text-xs ${message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {message.provider && message.provider !== "local" && message.provider !== "none" && (
                      <Badge variant="outline" className="text-xs py-0">
                        {message.provider}/{message.model}
                        {message.latencyMs ? ` (${message.latencyMs}ms)` : ""}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {message.role === "assistant" && !message.isError && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleCopy(message.content, message.id)}>
                        {copiedId === message.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    )}
                    {message.isError && (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => handleRetry(message)}>
                        <RefreshCw className="w-3 h-3 mr-1" /> Retry
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              {message.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}

          {chatMutation.isPending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder="Ask about your finances..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !chatMutation.isPending) { e.preventDefault(); handleSend(); } }}
              disabled={chatMutation.isPending}
            />
            <Button onClick={() => handleSend()} disabled={!input.trim() || chatMutation.isPending}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
