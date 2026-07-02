import { describe, it, expect } from 'vitest'
import {
  convertCurrency,
  formatCurrency,
  getMultiCurrencySummary,
  BASE_CURRENCY,
  SUPPORTED_CURRENCIES,
} from '@/lib/currency'

describe('Currency Engine', () => {
  const rates = { BDT: 1, USD: 110, CAD: 80 }

  describe('convertCurrency', () => {
    it('returns same amount when from and to are the same', () => {
      expect(convertCurrency(1000, 'BDT', 'BDT', rates)).toBe(1000)
      expect(convertCurrency(50, 'USD', 'USD', rates)).toBe(50)
    })

    it('converts foreign currency to base (BDT)', () => {
      expect(convertCurrency(10, 'USD', 'BDT', rates)).toBe(1100)
      expect(convertCurrency(5, 'CAD', 'BDT', rates)).toBe(400)
    })

    it('converts base (BDT) to foreign currency', () => {
      expect(convertCurrency(1100, 'BDT', 'USD', rates)).toBe(10)
      expect(convertCurrency(800, 'BDT', 'CAD', rates)).toBe(10)
    })

    it('converts between two foreign currencies via base', () => {
      const result = convertCurrency(10, 'USD', 'CAD', rates)
      expect(result).toBeCloseTo(13.75, 2)
    })

    it('handles zero amount', () => {
      expect(convertCurrency(0, 'USD', 'BDT', rates)).toBe(0)
    })

    it('handles large amounts', () => {
      expect(convertCurrency(10000, 'USD', 'BDT', rates)).toBe(1100000)
    })
  })

  describe('formatCurrency', () => {
    it('formats BDT with ৳ and no decimals', () => {
      expect(formatCurrency(1000, 'BDT')).toBe('৳1,000')
      expect(formatCurrency(50000, 'BDT')).toBe('৳50,000')
    })

    it('formats USD with $ and 2 decimals', () => {
      expect(formatCurrency(10.5, 'USD')).toBe('$10.50')
    })

    it('formats CAD with C$ and 2 decimals', () => {
      expect(formatCurrency(25.99, 'CAD')).toBe('C$25.99')
    })
  })

  describe('getMultiCurrencySummary', () => {
    it('aggregates transactions by currency and converts to BDT', () => {
      const txs = [
        { amount: 50000, currency: 'BDT', type: 'INCOME' as const },
        { amount: 200, currency: 'USD', type: 'INCOME' as const },
        { amount: 1000, currency: 'BDT', type: 'EXPENSE' as const },
        { amount: 50, currency: 'CAD', type: 'EXPENSE' as const },
      ]
      const summary = getMultiCurrencySummary(txs, rates)
      expect(summary.totalIncomeBDT).toBe(72000)
      expect(summary.totalExpenseBDT).toBe(5000)
      expect(summary.byCurrency['BDT']).toEqual({ income: 50000, expense: 1000 })
      expect(summary.byCurrency['USD']).toEqual({ income: 200, expense: 0 })
    })

    it('handles empty transactions', () => {
      const summary = getMultiCurrencySummary([], rates)
      expect(summary.totalIncomeBDT).toBe(0)
      expect(summary.totalExpenseBDT).toBe(0)
    })
  })

  describe('constants', () => {
    it('BDT is base currency', () => {
      expect(BASE_CURRENCY).toBe('BDT')
    })

    it('supports BDT, USD, and CAD', () => {
      expect(SUPPORTED_CURRENCIES).toContain('BDT')
      expect(SUPPORTED_CURRENCIES).toContain('USD')
      expect(SUPPORTED_CURRENCIES).toContain('CAD')
    })
  })
})
