import { describe, it, expect } from 'vitest'
import {
  calculateReducingBalance,
  calculateStaticBalance,
  calculateCreditCardDues,
  formatDebtOutput,
  getPaydownStrategy,
} from '@/lib/debt-engine'

describe('Debt Engine', () => {
  const startDate = new Date('2026-01-01')

  describe('calculateReducingBalance', () => {
    it('calculates correct EMI for 0% interest loan', () => {
      const result = calculateReducingBalance({
        name: 'Test Loan',
        type: 'personal_loan',
        calculationMode: 'reducing_balance',
        principalAmount: 12000,
        interestRate: 0,
        tenure: 12,
        startDate,
      })

      expect(result.monthlyDue).toBe(1000)
      expect(result.totalInterest).toBe(0)
      expect(result.totalPayment).toBe(12000)
      expect(result.schedule).toHaveLength(12)
    })

    it('calculates correct EMI with interest', () => {
      const result = calculateReducingBalance({
        name: 'Car Loan',
        type: 'personal_loan',
        calculationMode: 'reducing_balance',
        principalAmount: 100000,
        interestRate: 10,
        tenure: 12,
        startDate,
      })

      expect(result.monthlyDue).toBeGreaterThan(8333) // principal only would be 8333
      expect(result.totalInterest).toBeGreaterThan(0)
      expect(result.totalPayment).toBeGreaterThan(100000)
      expect(result.schedule).toHaveLength(12)

      // First installment should have highest interest
      expect(result.schedule[0].interestPortion).toBeGreaterThan(
        result.schedule[11].interestPortion
      )
    })

    it('tracks decreasing outstanding balance', () => {
      const result = calculateReducingBalance({
        name: 'Loan',
        type: 'personal_loan',
        calculationMode: 'reducing_balance',
        principalAmount: 12000,
        interestRate: 12,
        tenure: 12,
        startDate,
      })

      for (let i = 0; i < result.schedule.length - 1; i++) {
        expect(result.schedule[i].outstandingAfter).toBeGreaterThan(
          result.schedule[i + 1].outstandingAfter
        )
      }

      expect(result.schedule[11].outstandingAfter).toBeCloseTo(0, 1)
    })

    it('produces correct end date', () => {
      const result = calculateReducingBalance({
        name: 'Loan',
        type: 'personal_loan',
        calculationMode: 'reducing_balance',
        principalAmount: 12000,
        interestRate: 0,
        tenure: 12,
        startDate,
      })

      expect(result.endDate.getFullYear()).toBe(2027)
      expect(result.endDate.getMonth()).toBe(0) // January (12 months from Jan 2026)
    })

    it('first installment interest is principal * monthly rate', () => {
      const principal = 100000
      const annualRate = 12
      const monthlyRate = annualRate / 100 / 12

      const result = calculateReducingBalance({
        name: 'Loan',
        type: 'personal_loan',
        calculationMode: 'reducing_balance',
        principalAmount: principal,
        interestRate: annualRate,
        tenure: 12,
        startDate,
      })

      const expectedFirstInterest = principal * monthlyRate
      expect(result.schedule[0].interestPortion).toBeCloseTo(
        Math.round(expectedFirstInterest * 100) / 100,
        0
      )
    })

    it('total payments = principal + total interest', () => {
      const result = calculateReducingBalance({
        name: 'Loan',
        type: 'personal_loan',
        calculationMode: 'reducing_balance',
        principalAmount: 50000,
        interestRate: 18,
        tenure: 6,
        startDate,
      })

      const totalScheduled = result.schedule.reduce(
        (sum, inst) => sum + inst.totalPayment,
        0
      )
      expect(Math.round(totalScheduled)).toBeCloseTo(
        Math.round(result.totalPayment),
        0
      )
    })
  })

  describe('calculateStaticBalance', () => {
    it('calculates constant monthly interest', () => {
      const result = calculateStaticBalance({
        name: 'Static Loan',
        type: 'personal_loan',
        calculationMode: 'static',
        principalAmount: 12000,
        interestRate: 12,
        tenure: 12,
        startDate,
      })

      // Static: interest is same every month on original principal
      const firstInterest = result.schedule[0].interestPortion
      const lastInterest = result.schedule[11].interestPortion
      expect(firstInterest).toBe(lastInterest)
    })

    it('principal portion is constant in static mode', () => {
      const result = calculateStaticBalance({
        name: 'Static Loan',
        type: 'personal_loan',
        calculationMode: 'static',
        principalAmount: 12000,
        interestRate: 12,
        tenure: 12,
        startDate,
      })

      const firstPrincipal = result.schedule[0].principalPortion
      for (const inst of result.schedule) {
        expect(inst.principalPortion).toBeCloseTo(firstPrincipal, 1)
      }
    })

    it('total interest is higher than reducing balance', () => {
      const params = {
        name: 'Compare',
        type: 'personal_loan' as const,
        calculationMode: 'reducing_balance' as const,
        principalAmount: 100000,
        interestRate: 18,
        tenure: 12,
        startDate,
      }

      const reducing = calculateReducingBalance(params)
      const static_ = calculateStaticBalance({ ...params, calculationMode: 'static' })

      expect(static_.totalInterest).toBeGreaterThan(reducing.totalInterest)
    })

    it('honors custom fixed EMI', () => {
      const result = calculateStaticBalance({
        name: 'Fixed EMI',
        type: 'personal_loan',
        calculationMode: 'static',
        principalAmount: 12000,
        interestRate: 12,
        tenure: 12,
        startDate,
        fixedEMI: 1100,
      })

      expect(result.monthlyDue).toBe(1100)
    })

    it('schedule length equals tenure', () => {
      const result = calculateStaticBalance({
        name: 'Loan',
        type: 'installment',
        calculationMode: 'static',
        principalAmount: 24000,
        interestRate: 6,
        tenure: 24,
        startDate,
      })

      expect(result.schedule).toHaveLength(24)
    })
  })

  describe('calculateCreditCardDues', () => {
    it('calculates minimum payment and interest for credit card', () => {
      const result = calculateCreditCardDues(50000, 200000, 30, 5)

      expect(result.monthlyDue).toBeGreaterThan(0)
      expect(result.interestPortion).toBeGreaterThan(0)
      expect(result.utilization).toBe(25) // 50k/200k
      expect(result.warning).toBeNull()
    })

    it('warns on high utilization (>80%)', () => {
      const result = calculateCreditCardDues(170000, 200000, 30, 5)

      expect(result.utilization).toBe(85)
      expect(result.warning).toBeTruthy()
      expect(result.warning).toContain('High credit utilization')
    })

    it('warns on moderate utilization (>60%)', () => {
      const result = calculateCreditCardDues(140000, 200000, 30, 5)

      expect(result.utilization).toBe(70)
      expect(result.warning).toBeTruthy()
      expect(result.warning).toContain('Moderate')
    })

    it('calculates minimum payment as max of % of balance or interest + 500', () => {
      const result = calculateCreditCardDues(10000, 100000, 24, 5)
      // 5% of 10000 = 500, interest = 10000 * 2% = 200, min is max(500, 200+500=700) = 700
      expect(result.minimumPayment).toBeGreaterThanOrEqual(500)
    })

    it('handles zero balance', () => {
      const result = calculateCreditCardDues(0, 100000, 30, 5)

      expect(result.interestPortion).toBe(0)
      expect(result.utilization).toBe(0)
      expect(result.warning).toBeNull()
    })
  })

  describe('formatDebtOutput', () => {
    it('formats debt output with all required fields', () => {
      const calc = calculateReducingBalance({
        name: 'Visa Card',
        type: 'credit_card',
        calculationMode: 'reducing_balance',
        principalAmount: 50000,
        interestRate: 24,
        tenure: 6,
        startDate,
      })

      const output = formatDebtOutput('Visa Card', calc)

      expect(output).toContain('Visa Card')
      expect(output).toContain('Pay: ৳')
      expect(output).toContain('Interest portion: ৳')
      expect(output).toContain('Remaining: ৳')
      expect(output).toContain('Total to pay: ৳')
      expect(output).toContain('Total interest: ৳')
      expect(output).toContain('Payoff date:')
    })
  })

  describe('getPaydownStrategy', () => {
    it('orders by highest interest rate for avalanche', () => {
      const debts = [
        { name: 'Card A', outstanding: 50000, interestRate: 18, monthlyDue: 5000 },
        { name: 'Card B', outstanding: 100000, interestRate: 30, monthlyDue: 10000 },
        { name: 'Card C', outstanding: 20000, interestRate: 12, monthlyDue: 2000 },
      ]

      const result = getPaydownStrategy(debts)

      expect(result.avalanche).toEqual(['Card B', 'Card A', 'Card C'])
    })

    it('orders by smallest balance for snowball', () => {
      const debts = [
        { name: 'Card A', outstanding: 50000, interestRate: 18, monthlyDue: 5000 },
        { name: 'Card B', outstanding: 100000, interestRate: 30, monthlyDue: 10000 },
        { name: 'Card C', outstanding: 20000, interestRate: 12, monthlyDue: 2000 },
      ]

      const result = getPaydownStrategy(debts)

      expect(result.snowball).toEqual(['Card C', 'Card A', 'Card B'])
    })

    it('sums total monthly due', () => {
      const debts = [
        { name: 'A', outstanding: 1000, interestRate: 10, monthlyDue: 500 },
        { name: 'B', outstanding: 2000, interestRate: 20, monthlyDue: 800 },
      ]

      const result = getPaydownStrategy(debts)
      expect(result.totalMonthly).toBe(1300)
    })

    it('handles empty debts array', () => {
      const result = getPaydownStrategy([])
      expect(result.avalanche).toEqual([])
      expect(result.snowball).toEqual([])
      expect(result.totalMonthly).toBe(0)
    })
  })
})
