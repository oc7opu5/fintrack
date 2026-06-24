"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Bot,
  Key,
  Settings,
  Zap,
  Check,
  X,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
} from "lucide-react";

interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  envKey: string;
  baseUrl?: string;
  models: string[];
  docsUrl: string;
  freeTier?: string;
}

const providers: ProviderConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o-mini, fast and accurate",
    envKey: "OPENAI_API_KEY",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
    docsUrl: "https://platform.openai.com/api-keys",
    freeTier: "$5 free credit",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models, excellent reasoning",
    envKey: "ANTHROPIC_API_KEY",
    models: ["claude-3-haiku-20240307", "claude-3-sonnet-20240229"],
    docsUrl: "https://console.anthropic.com/",
    freeTier: "Pay per use",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Fast, generous free tier",
    envKey: "GOOGLE_AI_API_KEY",
    models: ["gemini-1.5-flash", "gemini-1.5-pro"],
    docsUrl: "https://aistudio.google.com/apikey",
    freeTier: "15 RPM free",
  },
  {
    id: "groq",
    name: "Groq",
    description: "Ultra-fast inference, free tier",
    envKey: "GROQ_API_KEY",
    models: ["llama-3.1-8b-instant", "llama-3.1-70b-versatile", "mixtral-8x7b-32768"],
    docsUrl: "https://console.groq.com/keys",
    freeTier: "Free tier available",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "Affordable, good quality",
    envKey: "DEEPSEEK_API_KEY",
    models: ["deepseek-chat", "deepseek-coder"],
    docsUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "mistral",
    name: "Mistral",
    description: "European AI, fast models",
    envKey: "MISTRAL_API_KEY",
    models: ["mistral-small-latest", "mistral-medium-latest"],
    docsUrl: "https://console.mistral.ai/api-keys",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access 100+ models via one API",
    envKey: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
    models: ["meta-llama/llama-3.1-8b-instruct:free", "anthropic/claude-3-haiku", "openai/gpt-4o-mini"],
    docsUrl: "https://openrouter.ai/keys",
    freeTier: "Many free models",
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    description: "Run models locally, free forever",
    envKey: "OLLAMA_BASE_URL",
    baseUrl: "http://localhost:11434",
    models: ["llama3.2", "phi3", "qwen2:1.5b", "gemma2:2b"],
    docsUrl: "https://ollama.ai",
    freeTier: "100% free",
  },
];

interface CustomProvider {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export default function AISettingsPage() {
  const [activeProvider, setActiveProvider] = useState("");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Load saved settings from localStorage
    const saved = localStorage.getItem("fintrack_ai_settings");
    if (saved) {
      const data = JSON.parse(saved);
      setActiveProvider(data.activeProvider || "");
      setApiKeys(data.apiKeys || {});
      setCustomProviders(data.customProviders || []);
    }
  }, []);

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem(
      "fintrack_ai_settings",
      JSON.stringify({
        activeProvider,
        apiKeys,
        customProviders,
      })
    );
    setTimeout(() => setSaving(false), 1000);
  };

  const handleTestProvider = async (providerId: string) => {
    setTesting(providerId);
    setTestResult((prev) => ({ ...prev, [providerId]: false }));

    // Simulate test
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const success = apiKeys[providerId]?.length > 0 || providerId === "ollama";

    setTestResult((prev) => ({ ...prev, [providerId]: success }));
    setTesting(null);
  };

  const addCustomProvider = () => {
    setCustomProviders([
      ...customProviders,
      { name: "", baseUrl: "", apiKey: "", model: "" },
    ]);
  };

  const removeCustomProvider = (index: number) => {
    setCustomProviders(customProviders.filter((_, i) => i !== index));
  };

  const updateCustomProvider = (
    index: number,
    field: keyof CustomProvider,
    value: string
  ) => {
    const updated = [...customProviders];
    updated[index] = { ...updated[index], [field]: value };
    setCustomProviders(updated);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">AI Settings</h1>
        <p className="text-muted-foreground">
          Configure AI providers for transaction parsing and chat assistant
        </p>
      </div>

      <Tabs defaultValue="providers">
        <TabsList>
          <TabsTrigger value="providers">
            <Bot className="w-4 h-4 mr-2" />
            Providers
          </TabsTrigger>
          <TabsTrigger value="custom">
            <Plus className="w-4 h-4 mr-2" />
            Custom Models
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <Settings className="w-4 h-4 mr-2" />
            Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          {/* Active Provider */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Active Provider
              </CardTitle>
              <CardDescription>
                Select which AI provider to use for transaction parsing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={activeProvider} onValueChange={setActiveProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Auto-detect (first available)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Auto-detect</SelectItem>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {apiKeys[p.id] ? "✓" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Provider Cards */}
          <div className="grid gap-4">
            {providers.map((provider) => (
              <Card
                key={provider.id}
                className={
                  activeProvider === provider.id
                    ? "border-primary"
                    : ""
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {provider.name}
                          {activeProvider === provider.id && (
                            <Badge variant="default" className="text-xs">
                              Active
                            </Badge>
                          )}
                          {testResult[provider.id] && (
                            <Badge variant="default" className="text-xs bg-emerald-500">
                              <Check className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {provider.description}
                        </p>
                      </div>
                    </div>
                    {provider.freeTier && (
                      <Badge variant="secondary">{provider.freeTier}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder={`Enter ${provider.name} API key`}
                        value={apiKeys[provider.id] || ""}
                        onChange={(e) =>
                          setApiKeys({ ...apiKeys, [provider.id]: e.target.value })
                        }
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestProvider(provider.id)}
                        disabled={testing === provider.id}
                      >
                        {testing === provider.id ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          "Test"
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Models: {provider.models.join(", ")}
                    </span>
                    <a
                      href={provider.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      Get API Key <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Custom AI Providers
              </CardTitle>
              <CardDescription>
                Add any OpenAI-compatible API (LocalAI, vLLM, LiteLLM, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {customProviders.map((cp, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Provider {index + 1}</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCustomProvider(index)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input
                        placeholder="My AI Provider"
                        value={cp.name}
                        onChange={(e) =>
                          updateCustomProvider(index, "name", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Model</Label>
                      <Input
                        placeholder="model-name"
                        value={cp.model}
                        onChange={(e) =>
                          updateCustomProvider(index, "model", e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Base URL</Label>
                    <Input
                      placeholder="https://api.example.com/v1"
                      value={cp.baseUrl}
                      onChange={(e) =>
                        updateCustomProvider(index, "baseUrl", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">API Key</Label>
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={cp.apiKey}
                      onChange={(e) =>
                        updateCustomProvider(index, "apiKey", e.target.value)
                      }
                    />
                  </div>
                </div>
              ))}

              <Button variant="outline" onClick={addCustomProvider} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Provider
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                AI Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-parse transactions</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically parse pasted text into transactions
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Show confidence scores</p>
                  <p className="text-sm text-muted-foreground">
                    Display AI confidence percentage on parsed transactions
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable chat assistant</p>
                  <p className="text-sm text-muted-foreground">
                    Allow AI to analyze your finances and give advice
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
