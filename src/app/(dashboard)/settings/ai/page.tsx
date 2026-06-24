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
import { Separator } from "@/components/ui/separator";
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
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
} from "lucide-react";

interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  envKey: string;
  models: string[];
  docsUrl: string;
  freeTier?: string;
  fetchModels?: (apiKey: string) => Promise<string[]>;
}

// Model fetching functions
async function fetchOpenAIModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await res.json();
    return data.data
      ?.filter((m: any) => m.id.includes("gpt"))
      .map((m: any) => m.id)
      .sort() || [];
  } catch { return []; }
}

async function fetchGroqModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await res.json();
    return data.data?.map((m: any) => m.id).sort() || [];
  } catch { return []; }
}

async function fetchAnthropicModels(apiKey: string): Promise<string[]> {
  // Anthropic doesn't have a models endpoint, return known models
  return ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"];
}

async function fetchGeminiModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    return data.models
      ?.filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m: any) => m.name.replace("models/", ""))
      .sort() || [];
  } catch { return []; }
}

async function fetchMistralModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch("https://api.mistral.ai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await res.json();
    return data.data?.map((m: any) => m.id).sort() || [];
  } catch { return []; }
}

async function fetchDeepSeekModels(apiKey: string): Promise<string[]> {
  return ["deepseek-chat", "deepseek-reasoner"];
}

async function fetchOpenRouterModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await res.json();
    return data.data?.map((m: any) => m.id).sort().slice(0, 50) || [];
  } catch { return []; }
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
    fetchModels: fetchOpenAIModels,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models, excellent reasoning",
    envKey: "ANTHROPIC_API_KEY",
    models: ["claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"],
    docsUrl: "https://console.anthropic.com/",
    fetchModels: fetchAnthropicModels,
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Fast, generous free tier",
    envKey: "GOOGLE_AI_API_KEY",
    models: ["gemini-1.5-flash", "gemini-1.5-pro"],
    docsUrl: "https://aistudio.google.com/apikey",
    freeTier: "15 RPM free",
    fetchModels: fetchGeminiModels,
  },
  {
    id: "groq",
    name: "Groq",
    description: "Ultra-fast inference, free tier",
    envKey: "GROQ_API_KEY",
    models: ["llama-3.1-8b-instant", "llama-3.1-70b-versatile"],
    docsUrl: "https://console.groq.com/keys",
    freeTier: "Free tier available",
    fetchModels: fetchGroqModels,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "Affordable, good quality",
    envKey: "DEEPSEEK_API_KEY",
    models: ["deepseek-chat", "deepseek-reasoner"],
    docsUrl: "https://platform.deepseek.com/api_keys",
    fetchModels: fetchDeepSeekModels,
  },
  {
    id: "mistral",
    name: "Mistral",
    description: "European AI, fast models",
    envKey: "MISTRAL_API_KEY",
    models: ["mistral-small-latest", "mistral-medium-latest"],
    docsUrl: "https://console.mistral.ai/api-keys",
    fetchModels: fetchMistralModels,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access 100+ models via one API",
    envKey: "OPENROUTER_API_KEY",
    models: ["meta-llama/llama-3.1-8b-instruct:free"],
    docsUrl: "https://openrouter.ai/keys",
    freeTier: "Many free models",
    fetchModels: fetchOpenRouterModels,
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    description: "Run models locally, free forever",
    envKey: "OLLAMA_BASE_URL",
    models: ["llama3.2", "phi3", "qwen2:1.5b"],
    docsUrl: "https://ollama.ai",
    freeTier: "100% free",
  },
];

interface Settings {
  activeProvider: string;
  apiKeys: Record<string, string>;
  models: Record<string, string>;
  fallbackProvider: string;
  fallbackModel: string;
  customProviders: Array<{
    name: string;
    baseUrl: string;
    apiKey: string;
    model: string;
  }>;
  preferences: {
    autoParse: boolean;
    showConfidence: boolean;
    enableChat: boolean;
  };
}

const defaultSettings: Settings = {
  activeProvider: "",
  apiKeys: {},
  models: {},
  fallbackProvider: "",
  fallbackModel: "",
  customProviders: [],
  preferences: {
    autoParse: true,
    showConfidence: true,
    enableChat: true,
  },
};

export default function AISettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [fetchedModels, setFetchedModels] = useState<Record<string, string[]>>({});
  const [fetchingModels, setFetchingModels] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("fintrack_ai_settings");
    if (saved) {
      const data = JSON.parse(saved);
      setSettings({ ...defaultSettings, ...data });
    }
  }, []);

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem("fintrack_ai_settings", JSON.stringify(settings));
    setTimeout(() => setSaving(false), 1000);
  };

  const updateSettings = (updates: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const updateApiKey = (providerId: string, key: string) => {
    updateSettings({
      apiKeys: { ...settings.apiKeys, [providerId]: key },
      models: { ...settings.models, [providerId]: "" }, // Reset model when key changes
    });
  };

  const updateModel = (providerId: string, model: string) => {
    updateSettings({
      models: { ...settings.models, [providerId]: model },
    });
  };

  const testApiKey = async (providerId: string) => {
    const apiKey = settings.apiKeys[providerId];
    if (!apiKey) {
      setTestResults((prev) => ({
        ...prev,
        [providerId]: { success: false, message: "No API key provided" },
      }));
      return;
    }

    setTesting(providerId);
    setTestResults((prev) => ({ ...prev, [providerId]: { success: false, message: "Testing..." } }));

    try {
      let success = false;
      let message = "";

      switch (providerId) {
        case "openai": {
          const res = await fetch("https://api.openai.com/v1/models", {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          success = res.ok;
          message = res.ok ? "Connected successfully" : `Error: ${res.status}`;
          break;
        }
        case "anthropic": {
          // Anthropic doesn't have a simple test endpoint, try creating a minimal request
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-3-haiku-20240307",
              max_tokens: 1,
              messages: [{ role: "user", content: "hi" }],
            }),
          });
          success = res.ok || res.status === 400; // 400 means key works but request format issue
          message = res.ok ? "Connected successfully" : res.status === 400 ? "Key valid (test request)" : `Error: ${res.status}`;
          break;
        }
        case "gemini": {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
          success = res.ok;
          message = res.ok ? "Connected successfully" : `Error: ${res.status}`;
          break;
        }
        case "groq": {
          const res = await fetch("https://api.groq.com/openai/v1/models", {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          success = res.ok;
          message = res.ok ? "Connected successfully" : `Error: ${res.status}`;
          break;
        }
        case "deepseek": {
          const res = await fetch("https://api.deepseek.com/v1/models", {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          success = res.ok;
          message = res.ok ? "Connected successfully" : `Error: ${res.status}`;
          break;
        }
        case "mistral": {
          const res = await fetch("https://api.mistral.ai/v1/models", {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          success = res.ok;
          message = res.ok ? "Connected successfully" : `Error: ${res.status}`;
          break;
        }
        case "openrouter": {
          const res = await fetch("https://openrouter.ai/api/v1/models", {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          success = res.ok;
          message = res.ok ? "Connected successfully" : `Error: ${res.status}`;
          break;
        }
        case "ollama": {
          const baseUrl = settings.apiKeys["ollama"] || "http://localhost:11434";
          const res = await fetch(`${baseUrl}/api/tags`);
          success = res.ok;
          message = res.ok ? "Connected successfully" : "Ollama not running";
          break;
        }
      }

      setTestResults((prev) => ({ ...prev, [providerId]: { success, message } }));
    } catch (error) {
      setTestResults((prev) => ({
        ...prev,
        [providerId]: { success: false, message: "Connection failed" },
      }));
    }

    setTesting(null);
  };

  const fetchProviderModels = async (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    const apiKey = settings.apiKeys[providerId];

    if (!provider?.fetchModels || !apiKey) return;

    setFetchingModels(providerId);
    try {
      const models = await provider.fetchModels(apiKey);
      setFetchedModels((prev) => ({ ...prev, [providerId]: models }));
    } catch (error) {
      console.error("Failed to fetch models:", error);
    }
    setFetchingModels(null);
  };

  const activeModels = settings.activeProvider
    ? fetchedModels[settings.activeProvider] || providers.find((p) => p.id === settings.activeProvider)?.models || []
    : [];

  const fallbackModels = settings.fallbackProvider
    ? fetchedModels[settings.fallbackProvider] || providers.find((p) => p.id === settings.fallbackProvider)?.models || []
    : [];

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
          <TabsTrigger value="models">
            <Zap className="w-4 h-4 mr-2" />
            Models
          </TabsTrigger>
          <TabsTrigger value="custom">
            <Plus className="w-4 h-4 mr-2" />
            Custom
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <Settings className="w-4 h-4 mr-2" />
            Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          {providers.map((provider) => (
            <Card key={provider.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {provider.name}
                        {settings.activeProvider === provider.id && (
                          <Badge variant="default" className="text-xs">Primary</Badge>
                        )}
                        {settings.fallbackProvider === provider.id && (
                          <Badge variant="secondary" className="text-xs">Fallback</Badge>
                        )}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{provider.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {provider.freeTier && (
                      <Badge variant="outline">{provider.freeTier}</Badge>
                    )}
                    {testResults[provider.id] && (
                      <Badge
                        variant={testResults[provider.id].success ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {testResults[provider.id].success ? (
                          <><Check className="w-3 h-3 mr-1" /> {testResults[provider.id].message}</>
                        ) : (
                          <><X className="w-3 h-3 mr-1" /> {testResults[provider.id].message}</>
                        )}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder={`Enter ${provider.name} API key`}
                      value={settings.apiKeys[provider.id] || ""}
                      onChange={(e) => updateApiKey(provider.id, e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testApiKey(provider.id)}
                      disabled={testing === provider.id}
                    >
                      {testing === provider.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Test"
                      )}
                    </Button>
                    {provider.fetchModels && settings.apiKeys[provider.id] && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchProviderModels(provider.id)}
                        disabled={fetchingModels === provider.id}
                      >
                        {fetchingModels === provider.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {fetchedModels[provider.id] && fetchedModels[provider.id].length > 0 && (
                  <div className="space-y-2">
                    <Label>Available Models ({fetchedModels[provider.id].length})</Label>
                    <div className="max-h-32 overflow-y-auto text-sm text-muted-foreground border rounded p-2">
                      {fetchedModels[provider.id].join(", ")}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Default: {provider.models.join(", ")}
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
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Configuration</CardTitle>
              <CardDescription>
                Select which models to use for transaction parsing and chat
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Provider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Primary Provider</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const p = providers.find((pr) => pr.id === settings.activeProvider);
                      if (p?.fetchModels && settings.apiKeys[settings.activeProvider]) {
                        fetchProviderModels(settings.activeProvider);
                      }
                    }}
                    disabled={!settings.activeProvider}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" /> Refresh Models
                  </Button>
                </div>
                <Select
                  value={settings.activeProvider}
                  onValueChange={(v) => updateSettings({ activeProvider: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select primary provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {settings.apiKeys[p.id] ? "✓" : "(no key)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {settings.activeProvider && (
                  <Select
                    value={settings.models[settings.activeProvider] || ""}
                    onValueChange={(v) => updateModel(settings.activeProvider, v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {(fetchedModels[settings.activeProvider] || providers.find((p) => p.id === settings.activeProvider)?.models || []).map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Separator />

              {/* Fallback Provider */}
              <div className="space-y-3">
                <Label className="text-base">Fallback Provider</Label>
                <p className="text-sm text-muted-foreground">
                  Used when primary provider fails
                </p>
                <Select
                  value={settings.fallbackProvider}
                  onValueChange={(v) => updateSettings({ fallbackProvider: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select fallback provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {providers
                      .filter((p) => p.id !== settings.activeProvider)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} {settings.apiKeys[p.id] ? "✓" : "(no key)"}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                {settings.fallbackProvider && (
                  <Select
                    value={settings.fallbackModel}
                    onValueChange={(v) => updateSettings({ fallbackModel: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select fallback model" />
                    </SelectTrigger>
                    <SelectContent>
                      {(fetchedModels[settings.fallbackProvider] || providers.find((p) => p.id === settings.fallbackProvider)?.models || []).map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Separator />

              {/* Regex Fallback */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Regex Fallback</p>
                  <p className="text-sm text-muted-foreground">
                    Always enabled - works without any API key
                  </p>
                </div>
                <Badge variant="secondary">Always On</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Custom AI Providers</CardTitle>
              <CardDescription>
                Add any OpenAI-compatible API (LocalAI, vLLM, LiteLLM, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.customProviders.map((cp, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Provider {index + 1}</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const updated = settings.customProviders.filter((_, i) => i !== index);
                        updateSettings({ customProviders: updated });
                      }}
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
                        onChange={(e) => {
                          const updated = [...settings.customProviders];
                          updated[index] = { ...updated[index], name: e.target.value };
                          updateSettings({ customProviders: updated });
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Model</Label>
                      <Input
                        placeholder="model-name"
                        value={cp.model}
                        onChange={(e) => {
                          const updated = [...settings.customProviders];
                          updated[index] = { ...updated[index], model: e.target.value };
                          updateSettings({ customProviders: updated });
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Base URL</Label>
                    <Input
                      placeholder="https://api.example.com/v1"
                      value={cp.baseUrl}
                      onChange={(e) => {
                        const updated = [...settings.customProviders];
                        updated[index] = { ...updated[index], baseUrl: e.target.value };
                        updateSettings({ customProviders: updated });
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">API Key</Label>
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={cp.apiKey}
                      onChange={(e) => {
                        const updated = [...settings.customProviders];
                        updated[index] = { ...updated[index], apiKey: e.target.value };
                        updateSettings({ customProviders: updated });
                      }}
                    />
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                onClick={() =>
                  updateSettings({
                    customProviders: [
                      ...settings.customProviders,
                      { name: "", baseUrl: "", apiKey: "", model: "" },
                    ],
                  })
                }
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Provider
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-parse transactions</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically parse pasted text into transactions
                  </p>
                </div>
                <Switch
                  checked={settings.preferences.autoParse}
                  onCheckedChange={(v) =>
                    updateSettings({
                      preferences: { ...settings.preferences, autoParse: v },
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Show confidence scores</p>
                  <p className="text-sm text-muted-foreground">
                    Display AI confidence percentage on parsed transactions
                  </p>
                </div>
                <Switch
                  checked={settings.preferences.showConfidence}
                  onCheckedChange={(v) =>
                    updateSettings({
                      preferences: { ...settings.preferences, showConfidence: v },
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable chat assistant</p>
                  <p className="text-sm text-muted-foreground">
                    Allow AI to analyze your finances and give advice
                  </p>
                </div>
                <Switch
                  checked={settings.preferences.enableChat}
                  onCheckedChange={(v) =>
                    updateSettings({
                      preferences: { ...settings.preferences, enableChat: v },
                    })
                  }
                />
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
