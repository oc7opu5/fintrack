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
  Settings,
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

const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
  anthropic: ["claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"],
  gemini: ["gemini-1.5-flash", "gemini-1.5-pro"],
  groq: ["llama-3.1-8b-instant", "llama-3.1-70b-versatile"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  mistral: ["mistral-small-latest", "mistral-medium-latest"],
  "opencode-zen": ["deepseek-v4-flash-free", "deepseek-v4-flash", "gpt-5.4-mini", "claude-haiku-4-5"],
  openrouter: ["meta-llama/llama-3.1-8b-instruct:free"],
};

const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
  groq: "Groq",
  deepseek: "DeepSeek",
  mistral: "Mistral",
  "opencode-zen": "OpenCode Zen",
  openrouter: "OpenRouter",
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const { data: history } = trpc.ai.getHistory.useQuery({ limit: 50 });
  const { data: aiSettings } = trpc.aiSettings.get.useQuery();
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

  // Load settings
  useEffect(() => {
    if (aiSettings) {
      const s = aiSettings as any;
      setSelectedProvider(s.activeProvider || "");
      setSelectedModel(s.activeModel || "");
    }
  }, [aiSettings]);

  // Load history on mount
  useEffect(() => {
    if (history && messages.length === 0) {
      const loaded = history.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        provider: m.provider || undefined,
        model: m.model || undefined,
        timestamp: new Date(m.createdAt),
      }));
      setMessages(loaded);
    }
  }, [history]);

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
            content: result.success ? result.response : "Sorry, I couldn't process that.",
            provider: result.provider,
            model: result.model,
            latencyMs: result.latencyMs,
            timestamp: new Date(),
            isError: !result.success,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        },
        onError: (error) => {
          const errorMessage: Message = {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `Error: ${error.message}. Please try again.`,
            timestamp: new Date(),
            isError: true,
          };
          setMessages((prev) => [...prev, errorMessage]);
        },
      }
    );
  };

  const handleRetry = (failedMessage: Message) => {
    // Find the user message before the failed one
    const idx = messages.findIndex((m) => m.id === failedMessage.id);
    if (idx > 0) {
      const prevUserMsg = messages[idx - 1];
      if (prevUserMsg.role === "user") {
        // Remove failed message and retry
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

  const formatMessage = (content: string) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\n\n/g, "\n")
      .split("\n")
      .map((line, i) => {
        if (line.startsWith("- ")) {
          return <li key={i} className="ml-4">{line.slice(2)}</li>;
        }
        if (line.includes(":") && line.startsWith("═")) {
          return <div key={i} className="font-bold mt-2">{line}</div>;
        }
        return <span key={i}>{line}<br /></span>;
      });
  };

  const handleModelChange = (provider: string, model: string) => {
    setSelectedProvider(provider);
    setSelectedModel(model);
    updateSettingsMutation.mutate({ activeProvider: provider, activeModel: model });
  };

  const availableProviders = Object.keys(PROVIDER_MODELS).filter((p) => {
    const s = aiSettings as any;
    return s?.apiKeys?.[p]; // Only show providers with saved keys
  });

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6" />
            AI Financial Assistant
          </h1>
          <p className="text-muted-foreground">
            Analyzes your real financial data • Powered by AI
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Model Selector */}
          {availableProviders.length > 0 && (
            <div className="flex items-center gap-2">
              <Select
                value={selectedProvider}
                onValueChange={(v) => {
                  const models = PROVIDER_MODELS[v] || [];
                  handleModelChange(v, models[0] || "");
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PROVIDER_NAMES[p] || p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedProvider && PROVIDER_MODELS[selectedProvider] && (
                <Select
                  value={selectedModel}
                  onValueChange={(v) => handleModelChange(selectedProvider, v)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Model" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_MODELS[selectedProvider].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <Badge variant="secondary">
            <Sparkles className="w-3 h-3 mr-1" />
            {messages.length} messages
          </Badge>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
            >
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
                  I can analyze your spending, track subscriptions, and give personalized advice.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-md">
                {SUGGESTIONS.map((s) => (
                  <Button
                    key={s.text}
                    variant="outline"
                    className="justify-start h-auto py-3 text-left"
                    onClick={() => handleSend(s.text)}
                  >
                    <s.icon className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="text-xs">{s.text}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : message.isError
                    ? "bg-destructive/10 border border-destructive/20"
                    : "bg-muted"
                }`}
              >
                {message.isError && <AlertCircle className="w-4 h-4 text-destructive mb-1" />}
                <div className="text-sm whitespace-pre-wrap">{formatMessage(message.content)}</div>
                <div className="flex items-center justify-between mt-2 gap-2">
                  <div className="flex items-center gap-2">
                    <p className={`text-xs ${message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {message.provider && message.provider !== "local" && (
                      <Badge variant="outline" className="text-xs py-0">
                        {message.provider}/{message.model}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {message.role === "assistant" && !message.isError && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleCopy(message.content, message.id)}
                      >
                        {copiedId === message.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    )}
                    {message.isError && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => handleRetry(message)}
                      >
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

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder="Ask about your finances..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !chatMutation.isPending) {
                  e.preventDefault();
                  handleSend();
                }
              }}
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
