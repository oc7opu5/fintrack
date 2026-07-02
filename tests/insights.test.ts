import { describe, it, expect } from 'vitest'
import {
  generateInsights,
  type FinancialSnapshot,
} from '@/lib/insights'

describe('AI Insight Engine', () => {
  const baseSnapshot: FinancialSnapshot = {
    monthlyIncome: 50000,
    monthlyExpense: 35000,
    totalBalance: 100000,
    totalDebt: 50000,
    monthlyDebtPayments: 8000,
    categoryBreakdown: [
      { category: 'Food & Dining', amount: 14000, percentage: 40 },
      { category: 'Transportation', amount: 5000, percentage: 14 },
      { category: 'Entertainment', amount: 4000, percentage: 11 },
      { category: 'Shopping', amount: 3500, percentage: 10 },
      { category: 'Bills', amount: 8500, percentage: 24 },
    ],
    subscriptionCost: 1500,
  }

  describe('generateInsights', () => {
    it('generates financial health score insight', () => {
      const insights = generateInsights(baseSnapshot)
      const health = insights.find(i => i.type === 'financial_health')
      expect(health).toBeDefined()
      expect(health!.title).toContain('Health Score')
      expect(health!.metadata.healthScore).toBeDefined()
      expect(typeof health!.metadata.healthScore).toBe('number')
    })

    it('detects high concentration spending pattern', () => {
      const snapshot = {
        ...baseSnapshot,
        categoryBreakdown: [
          { category: 'Food & Dining', amount: 20000, percentage: 57 },
          { category: 'Other', amount: 15000, percentage: 43 },
        ],
      }
      const insights = generateInsights(snapshot)
      const spending = insights.find(i => i.type === 'spending_pattern')
      expect(spending).toBeDefined()
      if (spending) {
        expect(spending.title).toContain('High concentration')
        expect(spending.severity).toBe('critical')
      }
    })

    it('flags low savings rate as risk', () => {
      const snapshot = {
        ...baseSnapshot,
        monthlyExpense: 49000,
      }
      const insights = generateInsights(snapshot)
      const risk = insights.find(i => i.type === 'risk_alert')
      expect(risk).toBeDefined()
      if (risk) {
        expect(risk.title.toLowerCase()).toContain('low savings')
      }
    })

    it('detects overspending when expenses exceed income', () => {
      const snapshot = {
        ...baseSnapshot,
        monthlyExpense: 55000,
      }
      const insights = generateInsights(snapshot)
      const overspend = insights.find(i =>
        i.type === 'risk_alert' && i.title.toLowerCase().includes('overspending')
      )
      expect(overspend).toBeDefined()
      if (overspend) {
        expect(overspend.severity).toBe('critical')
      }
    })

    it('generates subscription savings tip', () => {
      const snapshot = {
        ...baseSnapshot,
        subscriptionCost: 3000,
      }
      const insights = generateInsights(snapshot)
      const tip = insights.find(i => i.type === 'savings_tip')
      expect(tip).toBeDefined()
      if (tip) {
        expect(tip.title.toLowerCase()).toContain('subscription')
      }
    })

    it('detects debt stress with high DTI', () => {
      const snapshot = {
        ...baseSnapshot,
        monthlyDebtPayments: 25000, // 50% DTI
        monthlyIncome: 50000,
      }
      const insights = generateInsights(snapshot)
      const stress = insights.find(i => i.type === 'debt_stress')
      expect(stress).toBeDefined()
      if (stress) {
        expect(stress.severity).toBe('critical')
        expect(stress.title.toLowerCase()).toContain('stress score')
      }
    })

    it('returns info severity for healthy debt ratio', () => {
      const snapshot = {
        ...baseSnapshot,
        monthlyDebtPayments: 5000,
        totalDebt: 10000,
      }
      const insights = generateInsights(snapshot)
      const stress = insights.find(i => i.type === 'debt_stress')
      if (stress) {
        expect(stress.severity).toBe('info')
      }
    })

    it('detects food overspending', () => {
      const snapshot = {
        ...baseSnapshot,
        categoryBreakdown: [
          { category: 'Food & Dining', amount: 15000, percentage: 43 },
          { category: 'Other', amount: 20000, percentage: 57 },
        ],
      }
      const insights = generateInsights(snapshot)
      const food = insights.find(i =>
        i.type === 'spending_pattern' && i.title.toLowerCase().includes('food')
      )
      expect(food).toBeDefined()
    })

    it('does not generate debt stress when no debt', () => {
      const snapshot = {
        ...baseSnapshot,
        totalDebt: 0,
        monthlyDebtPayments: 0,
      }
      const insights = generateInsights(snapshot)
      const stress = insights.filter(i => i.type === 'debt_stress')
      expect(stress.length).toBe(0)
    })

    it('all insights have required fields', () => {
      const insights = generateInsights(baseSnapshot)
      for (const insight of insights) {
        expect(insight.type).toBeTruthy()
        expect(insight.title).toBeTruthy()
        expect(insight.content).toBeTruthy()
        expect(['info', 'warning', 'critical']).toContain(insight.severity)
        expect(insight.metadata).toBeDefined()
      }
    })

    it('financial health score is between 0 and 100', () => {
      const insights = generateInsights(baseSnapshot)
      const health = insights.find(i => i.type === 'financial_health')
      expect(health).toBeDefined()
      if (health) {
        expect(health.metadata.healthScore).toBeGreaterThanOrEqual(0)
        expect(health.metadata.healthScore).toBeLessThanOrEqual(100)
      }
    })
  })

  describe('edge cases', () => {
    it('handles zero income gracefully', () => {
      const snapshot: FinancialSnapshot = {
        monthlyIncome: 0,
        monthlyExpense: 5000,
        totalBalance: 5000,
        totalDebt: 0,
        monthlyDebtPayments: 0,
        categoryBreakdown: [{ category: 'Food', amount: 5000, percentage: 100 }],
        subscriptionCost: 0,
      }
      const insights = generateInsights(snapshot)
      expect(insights.length).toBeGreaterThanOrEqual(0)
    })

    it('handles zero expenses', () => {
      const snapshot: FinancialSnapshot = {
        monthlyIncome: 50000,
        monthlyExpense: 0,
        totalBalance: 200000,
        totalDebt: 0,
        monthlyDebtPayments: 0,
        categoryBreakdown: [],
        subscriptionCost: 0,
      }
      const insights = generateInsights(snapshot)
      expect(insights.length).toBeGreaterThanOrEqual(0)
    })

    it('handles previous month comparison for increased spending', () => {
      const snapshot: FinancialSnapshot = {
        ...baseSnapshot,
        monthlyExpense: 40000,
        previousMonthExpense: 20000,
      }
      const insights = generateInsights(snapshot)
      const pattern = insights.find(i =>
        i.type === 'spending_pattern' && i.title.toLowerCase().includes('increased')
      )
      expect(pattern).toBeDefined()
    })

    it('handles previous month comparison for decreased spending', () => {
      const snapshot: FinancialSnapshot = {
        ...baseSnapshot,
        monthlyExpense: 15000,
        previousMonthExpense: 30000,
      }
      const insights = generateInsights(snapshot)
      const pattern = insights.find(i =>
        i.type === 'spending_pattern' && i.title.toLowerCase().includes('decreased')
      )
      expect(pattern).toBeDefined()
    })
  })
})
