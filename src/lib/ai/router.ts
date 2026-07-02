// AI Router System for MindLedger AI
// Routes different task types to appropriate AI models/providers

export type TaskType = "parser" | "chat" | "insight" | "debt_analysis";
export type ProviderId = "openai" | "openrouter" | "custom" | "opencode-zen" | "anthropic" | "gemini" | "groq" | "deepseek" | "mistral" | "ollama" | "local";

export interface AIRequest {
  taskType: TaskType;
  provider: ProviderId;
  model: string;
  prompt: string;
  temperature: number;
  systemPrompt?: string;
  maxTokens?: number;
}

export interface AIResponse {
  success: boolean;
  content?: string;
  provider: string;
  model: string;
  latencyMs: number;
  error?: string;
}

export interface TaskConfig {
  taskType: TaskType;
  provider: ProviderId;
  model: string;
  temperature: number;
}

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  defaultModel: string;
  baseUrl: string;
  envKey: string;
  isOpenAICompatible: boolean;
}

// All supported provider configurations
export const PROVIDER_CONFIGS: ProviderConfig[] = [
  { id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1", envKey: "OPENAI_API_KEY", isOpenAICompatible: true },
  { id: "anthropic", name: "Anthropic", defaultModel: "claude-3-5-haiku-20241022", baseUrl: "https://api.anthropic.com/v1", envKey: "ANTHROPIC_API_KEY", isOpenAICompatible: false },
  { id: "gemini", name: "Google Gemini", defaultModel: "gemini-1.5-flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta", envKey: "GOOGLE_AI_API_KEY", isOpenAICompatible: false },
  { id: "groq", name: "Groq", defaultModel: "llama-3.1-8b-instant", baseUrl: "https://api.groq.com/openai/v1", envKey: "GROQ_API_KEY", isOpenAICompatible: true },
  { id: "deepseek", name: "DeepSeek", defaultModel: "deepseek-chat", baseUrl: "https://api.deepseek.com/v1", envKey: "DEEPSEEK_API_KEY", isOpenAICompatible: true },
  { id: "mistral", name: "Mistral", defaultModel: "mistral-small-latest", baseUrl: "https://api.mistral.ai/v1", envKey: "MISTRAL_API_KEY", isOpenAICompatible: true },
  { id: "opencode-zen", name: "OpenCode Zen", defaultModel: "deepseek-v4-flash-free", baseUrl: "https://opencode.ai/zen/v1", envKey: "OPENCODE_ZEN_API_KEY", isOpenAICompatible: true },
  { id: "openrouter", name: "OpenRouter", defaultModel: "meta-llama/llama-3.1-8b-instruct:free", baseUrl: "https://openrouter.ai/api/v1", envKey: "OPENROUTER_API_KEY", isOpenAICompatible: true },
  { id: "ollama", name: "Ollama (Local)", defaultModel: "llama3.2", baseUrl: "", envKey: "OLLAMA_BASE_URL", isOpenAICompatible: true },
];

// Default task routing based on task type
export const DEFAULT_TASK_ROUTING: Record<TaskType, { recommendedProvider: ProviderId; recommendedModel: string; temperature: number }> = {
  parser: { recommendedProvider: "openai", recommendedModel: "gpt-4o-mini", temperature: 0.1 },
  chat: { recommendedProvider: "opencode-zen", recommendedModel: "deepseek-v4-flash-free", temperature: 0.7 },
  insight: { recommendedProvider: "groq", recommendedModel: "llama-3.1-8b-instant", temperature: 0.5 },
  debt_analysis: { recommendedProvider: "local" as ProviderId, recommendedModel: "rule-based", temperature: 0 },
};

// Get available models for a provider
export async function fetchProviderModels(
  provider: ProviderId,
  config: ProviderConfig,
  apiKey: string
): Promise<string[]> {
  const defaultModels: Record<ProviderId, string[]> = {
    openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1", "gpt-5"],
    openrouter: ["meta-llama/llama-3.1-8b-instruct:free", "openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet"],
    custom: [],
    "opencode-zen": ["deepseek-v4-flash-free", "deepseek-v4-flash", "gpt-5.4-mini"],
    anthropic: ["claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022"],
    gemini: ["gemini-1.5-flash", "gemini-1.5-pro"],
    groq: ["llama-3.1-8b-instant", "llama-3.1-70b-versatile", "mixtral-8x7b"],
    deepseek: ["deepseek-chat", "deepseek-reasoner"],
    mistral: ["mistral-small-latest", "mistral-medium-latest"],
    ollama: ["llama3.2", "mistral", "gemma2"],
    local: [],
  };

  if (!config.isOpenAICompatible || !config.baseUrl) {
    return defaultModels[provider] || [];
  }

  try {
    const res = await fetch(`${config.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const data = await res.json();
      return (data.data || []).map((m: any) => m.id).sort();
    }
  } catch (e) {
    console.warn(`Failed to fetch models for ${provider}`, e);
  }

  return defaultModels[provider] || [];
}

// Build a system prompt based on chat mode
export function getModeSystemPrompt(mode: "coach" | "debt_manager" | "analyst"): string {
  const prompts: Record<string, string> = {
    coach: `You are MindLedger AI's Financial Coach. You help users improve their financial habits.

Focus on:
- Budgeting advice and spending discipline
- Overspending alerts and category breakdowns
- Saving tips and emergency fund building
- Cash flow management
- Understandable, actionable advice

Format: Use markdown. Be encouraging but honest. Include specific numbers.
Always reference BDT (৳) currency. Give concrete examples.`,

    debt_manager: `You are MindLedger AI's Debt Manager. You specialize in debt strategy.

Focus on:
- Credit card payoff acceleration strategies
- EMI planning and restructuring
- Debt avalanche vs snowball comparisons
- Interest cost analysis
- Minimum payment vs extra payment scenarios
- Debt stress risk assessment

Format: Use markdown with tables for comparisons. Include exact calculations.
Show "Pay: X BDT this month" format for debts.
Compare scenarios: what happens if you pay minimum vs extra.`,

    analyst: `You are MindLedger AI's Financial Analyst. You provide data-driven insights.

Focus on:
- Spending patterns and trend analysis
- Category-wise percentage breakdowns
- Month-over-month and year-over-year comparisons
- Financial health scoring (0-100)
- Savings capacity and debt burden analysis
- Risk detection (high discretionary spending, low savings rate)

Format: Use markdown with tables, bullet points, and clear metrics.
Always show percentages and comparisons. Be precise with numbers.`,
  };

  return prompts[mode] || prompts.coach;
}
