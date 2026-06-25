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
import { trpc } from "@/lib/trpc/client";
import {
  Bot,
  Settings,
  Zap,
  Check,
  X,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  docsUrl: string;
  freeTier?: string;
  defaultModel: string;
}

const providers: ProviderConfig[] = [
  { id: "openai", name: "OpenAI", description: "GPT-4o-mini, fast and accurate", docsUrl: "https://platform.openai.com/api-keys", freeTier: "$5 free credit", defaultModel: "gpt-4o-mini" },
  { id: "anthropic", name: "Anthropic", description: "Claude models, excellent reasoning", docsUrl: "https://console.anthropic.com/", defaultModel: "claude-3-5-haiku-20241022" },
  { id: "gemini", name: "Google Gemini", description: "Fast, generous free tier", docsUrl: "https://aistudio.google.com/apikey", freeTier: "15 RPM free", defaultModel: "gemini-1.5-flash" },
  { id: "groq", name: "Groq", description: "Ultra-fast inference, free tier", docsUrl: "https://console.groq.com/keys", freeTier: "Free tier", defaultModel: "llama-3.1-8b-instant" },
  { id: "deepseek", name: "DeepSeek", description: "Affordable, good quality", docsUrl: "https://platform.deepseek.com/api_keys", defaultModel: "deepseek-chat" },
  { id: "mistral", name: "Mistral", description: "European AI, fast models", docsUrl: "https://console.mistral.ai/api-keys", defaultModel: "mistral-small-latest" },
  { id: "openrouter", name: "OpenRouter", description: "Access 100+ models via one API", docsUrl: "https://openrouter.ai/keys", freeTier: "Many free models", defaultModel: "meta-llama/llama-3.1-8b-instruct:free" },
  { id: "opencode-zen", name: "OpenCode Zen", description: "Curated models by OpenCode team", docsUrl: "https://opencode.ai/auth", freeTier: "Free models", defaultModel: "deepseek-v4-flash-free" },
  { id: "ollama", name: "Ollama (Local)", description: "Run models locally, free forever", docsUrl: "https://ollama.ai", freeTier: "100% free", defaultModel: "llama3.2" },
];

export default function AISettingsPage() {
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [fetchedModels, setFetchedModels] = useState<Record<string, string[]>>({});
  const [fetchingModels, setFetchingModels] = useState<string | null>(null);
  const [apiKeysInput, setApiKeysInput] = useState<Record<string, string>>({});

  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.aiSettings.get.useQuery();
  const saveMutation = trpc.aiSettings.save.useMutation({
    onSuccess: () => utils.aiSettings.get.invalidate(),
  });
  const testKeyMutation = trpc.aiSettings.testKey.useMutation();

  // Initialize API keys input from settings
  useEffect(() => {
    if (settings?.apiKeys) {
      const keys: Record<string, string> = {};
      for (const [provider, masked] of Object.entries(settings.apiKeys as Record<string, string>)) {
        keys[provider] = ""; // Don't show masked values in input
      }
      setApiKeysInput(keys);
    }
  }, [settings]);

  const handleTestAndFetch = async (providerId: string) => {
    const apiKey = apiKeysInput[providerId];
    if (!apiKey) return;

    setTesting(providerId);
    setTestResults((prev) => ({ ...prev, [providerId]: { success: false, message: "Testing..." } }));

    const result = await testKeyMutation.mutateAsync({ provider: providerId, apiKey });

    setTestResults((prev) => ({ ...prev, [providerId]: { success: result.success, message: result.message } }));

    if (result.success && result.models.length > 0) {
      setFetchedModels((prev) => ({ ...prev, [providerId]: result.models }));
    }

    setTesting(null);
  };

  const handleSave = () => {
    // Merge new API keys with existing (masked keys stay as-is)
    const mergedKeys: Record<string, string> = {};
    for (const [provider, key] of Object.entries(apiKeysInput)) {
      if (key) {
        mergedKeys[provider] = key;
      }
    }

    saveMutation.mutate({
      apiKeys: mergedKeys,
    });
  };

  const updateSetting = (field: string, value: string) => {
    saveMutation.mutate({ [field]: value } as any);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  const settingsData = settings as any;
  const activeProvider = settingsData?.activeProvider || "";
  const fallbackProvider = settingsData?.fallbackProvider || "";
  const activeModel = settingsData?.activeModel || "";
  const fallbackModel = settingsData?.fallbackModel || "";
  const preferences = settingsData?.preferences || { autoParse: true, showConfidence: true, enableChat: true };

  const getModelsForProvider = (providerId: string) => {
    return fetchedModels[providerId] || [providers.find((p) => p.id === providerId)?.defaultModel].filter(Boolean);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">AI Settings</h1>
        <p className="text-muted-foreground">Configure AI providers for transaction parsing and chat</p>
      </div>

      <Tabs defaultValue="providers">
        <TabsList>
          <TabsTrigger value="providers"><Bot className="w-4 h-4 mr-2" />Providers</TabsTrigger>
          <TabsTrigger value="models"><Zap className="w-4 h-4 mr-2" />Models</TabsTrigger>
          <TabsTrigger value="preferences"><Settings className="w-4 h-4 mr-2" />Preferences</TabsTrigger>
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
                        {activeProvider === provider.id && <Badge variant="default" className="text-xs">Primary</Badge>}
                        {fallbackProvider === provider.id && <Badge variant="secondary" className="text-xs">Fallback</Badge>}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{provider.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {provider.freeTier && <Badge variant="outline">{provider.freeTier}</Badge>}
                    {testResults[provider.id] && (
                      <Badge variant={testResults[provider.id].success ? "default" : "destructive"} className="text-xs">
                        {testResults[provider.id].success ? <><Check className="w-3 h-3 mr-1" />{testResults[provider.id].message}</> : <><X className="w-3 h-3 mr-1" />{testResults[provider.id].message}</>}
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
                      placeholder={settings?.apiKeys?.[provider.id] ? "Key saved (enter new to replace)" : `Enter ${provider.name} API key`}
                      value={apiKeysInput[provider.id] || ""}
                      onChange={(e) => setApiKeysInput({ ...apiKeysInput, [provider.id]: e.target.value })}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestAndFetch(provider.id)}
                      disabled={!apiKeysInput[provider.id] || testing === provider.id}
                    >
                      {testing === provider.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Test & Fetch Models"}
                    </Button>
                  </div>
                </div>

                {fetchedModels[provider.id] && fetchedModels[provider.id].length > 0 && (
                  <div className="space-y-2">
                    <Label>Available Models ({fetchedModels[provider.id].length})</Label>
                    <div className="max-h-32 overflow-y-auto text-sm border rounded p-2">
                      {fetchedModels[provider.id].map((m) => (
                        <Badge key={m} variant="outline" className="mr-1 mb-1">{m}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Default: {provider.defaultModel}</span>
                  <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
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
              <CardDescription>Select which models to use</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-base">Primary Provider</Label>
                <Select value={activeProvider} onValueChange={(v) => updateSetting("activeProvider", v)}>
                  <SelectTrigger><SelectValue placeholder="Auto-detect (first available)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Auto-detect</SelectItem>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeProvider && (
                  <Select value={activeModel} onValueChange={(v) => updateSetting("activeModel", v)}>
                    <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                    <SelectContent>
                      {getModelsForProvider(activeProvider).map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-base">Fallback Provider</Label>
                <p className="text-sm text-muted-foreground">Used when primary fails</p>
                <Select value={fallbackProvider} onValueChange={(v) => updateSetting("fallbackProvider", v)}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {providers.filter((p) => p.id !== activeProvider).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fallbackProvider && (
                  <Select value={fallbackModel} onValueChange={(v) => updateSetting("fallbackModel", v)}>
                    <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                    <SelectContent>
                      {getModelsForProvider(fallbackProvider).map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Regex Fallback</p>
                  <p className="text-sm text-muted-foreground">Always enabled - works without API key</p>
                </div>
                <Badge variant="secondary">Always On</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>AI Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-parse transactions</p>
                  <p className="text-sm text-muted-foreground">Automatically parse pasted text</p>
                </div>
                <Switch checked={preferences.autoParse} onCheckedChange={(v) => saveMutation.mutate({ preferences: { ...preferences, autoParse: v } })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Show confidence scores</p>
                  <p className="text-sm text-muted-foreground">Display AI confidence percentage</p>
                </div>
                <Switch checked={preferences.showConfidence} onCheckedChange={(v) => saveMutation.mutate({ preferences: { ...preferences, showConfidence: v } })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable chat assistant</p>
                  <p className="text-sm text-muted-foreground">Allow AI to analyze your finances</p>
                </div>
                <Switch checked={preferences.enableChat} onCheckedChange={(v) => saveMutation.mutate({ preferences: { ...preferences, enableChat: v } })} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save API Keys"}
        </Button>
      </div>
    </div>
  );
}
