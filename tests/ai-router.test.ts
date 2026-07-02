import { describe, it, expect } from 'vitest'
import {
  getModeSystemPrompt,
  DEFAULT_TASK_ROUTING,
  PROVIDER_CONFIGS,
  type TaskType,
} from '@/lib/ai/router'

describe('AI Router', () => {
  describe('getModeSystemPrompt', () => {
    it('returns coach prompt', () => {
      const prompt = getModeSystemPrompt('coach')
      expect(prompt).toContain('Financial Coach')
      expect(prompt).toContain('Budgeting advice')
      expect(prompt).toContain('BDT')
    })

    it('returns debt manager prompt', () => {
      const prompt = getModeSystemPrompt('debt_manager')
      expect(prompt).toContain('Debt Manager')
      expect(prompt).toContain('EMI planning')
      expect(prompt).toContain('snowball')
    })

    it('returns analyst prompt', () => {
      const prompt = getModeSystemPrompt('analyst')
      expect(prompt).toContain('Financial Analyst')
      expect(prompt).toContain('Month-over-month')
      expect(prompt).toContain('health scoring')
    })

    it('all prompts contain markdown formatting instruction', () => {
      const modes = ['coach', 'debt_manager', 'analyst'] as const
      for (const mode of modes) {
        expect(getModeSystemPrompt(mode)).toContain('markdown')
      }
    })
  })

  describe('DEFAULT_TASK_ROUTING', () => {
    it('has config for all task types', () => {
      const taskTypes: TaskType[] = ['parser', 'chat', 'insight', 'debt_analysis']
      for (const type of taskTypes) {
        expect(DEFAULT_TASK_ROUTING[type]).toBeDefined()
        expect(DEFAULT_TASK_ROUTING[type].recommendedProvider).toBeTruthy()
        expect(DEFAULT_TASK_ROUTING[type].recommendedModel).toBeTruthy()
        expect(typeof DEFAULT_TASK_ROUTING[type].temperature).toBe('number')
      }
    })

    it('parser has low temperature for precise output', () => {
      expect(DEFAULT_TASK_ROUTING.parser.temperature).toBe(0.1)
    })

    it('chat has higher temperature for creative responses', () => {
      expect(DEFAULT_TASK_ROUTING.chat.temperature).toBeGreaterThan(0.5)
    })

    it('debt_analysis uses rule-based (local) routing', () => {
      const debt = DEFAULT_TASK_ROUTING.debt_analysis
      expect(debt.recommendedProvider).toBe('local')
      expect(debt.recommendedModel).toBe('rule-based')
    })
  })

  describe('PROVIDER_CONFIGS', () => {
    it('has OpenAI configured as OpenAI-compatible', () => {
      const openai = PROVIDER_CONFIGS.find(p => p.id === 'openai')
      expect(openai).toBeDefined()
      expect(openai!.isOpenAICompatible).toBe(true)
      expect(openai!.baseUrl).toContain('openai.com')
    })

    it('has Anthropic as non-OpenAI-compatible', () => {
      const anthropic = PROVIDER_CONFIGS.find(p => p.id === 'anthropic')
      expect(anthropic).toBeDefined()
      expect(anthropic!.isOpenAICompatible).toBe(false)
    })

    it('all providers have required fields', () => {
      for (const config of PROVIDER_CONFIGS) {
        expect(config.id).toBeTruthy()
        expect(config.name).toBeTruthy()
        expect(config.defaultModel).toBeTruthy()
        expect(config.envKey).toBeTruthy()
        expect(typeof config.isOpenAICompatible).toBe('boolean')
      }
    })

    it('includes 10+ providers', () => {
      expect(PROVIDER_CONFIGS.length).toBeGreaterThanOrEqual(9)
    })

    it('OpenCode Zen and OpenRouter are available', () => {
      const ids = PROVIDER_CONFIGS.map(p => p.id)
      expect(ids).toContain('opencode-zen')
      expect(ids).toContain('openrouter')
    })

    it('includes Ollama for local models', () => {
      const ollama = PROVIDER_CONFIGS.find(p => p.id === 'ollama')
      expect(ollama).toBeDefined()
      expect(ollama!.isOpenAICompatible).toBe(true)
    })
  })
})
