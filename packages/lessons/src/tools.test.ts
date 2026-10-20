import { expect, test } from 'vitest'

import { rules } from './rules.ts'
import {
  cardPayoff,
  compoundGrowth,
  dependentStandardDeduction,
  incomeTax,
  initialValues,
  loanPayment,
  tools,
  weeklyPaycheck,
} from './tools.ts'

test('income tax applies each bracket only to income inside it', () => {
  expect(incomeTax(0)).toBe(0)
  expect(incomeTax(12_400)).toBe(1_240)
  // 10% of 12,400 + 12% of the next 7,600
  expect(incomeTax(20_000)).toBe(2_152)
  expect(incomeTax(50_400)).toBe(1_240 + 4_560)
})

test('a part-time wage under the standard deduction owes no federal income tax', () => {
  expect(weeklyPaycheck(15, 20, 0)).toEqual({
    gross: 300,
    socialSecurity: 18.6,
    medicare: 4.35,
    federal: 0,
    state: 0,
    net: 277.05,
  })
})

test('a dependent with only wages deducts earned income plus $450, capped', () => {
  expect(dependentStandardDeduction(500)).toBe(rules.dependentMinimumDeduction)
  expect(dependentStandardDeduction(5_000)).toBe(5_450)
  expect(dependentStandardDeduction(40_000)).toBe(rules.standardDeduction)
})

test('compound growth with no interest is the sum of deposits', () => {
  expect(compoundGrowth(100, 50, 0, 1)).toEqual({
    deposited: 700,
    balance: 700,
    interest: 0,
  })
  expect(compoundGrowth(1_000, 0, 12, 1).balance).toBe(1_126.83)
})

test('a payment that does not cover interest never pays a card off', () => {
  expect(cardPayoff(1_000, 24, 20)._tag).toBe('NeverPaidOff')
  const payoff = cardPayoff(1_000, 24, 100)
  expect(payoff._tag).toBe('PaidOff')
  expect(payoff._tag === 'PaidOff' && payoff.months).toBe(12)
})

test('loan payments match the amortization formula', () => {
  expect(loanPayment(12_000, 0, 12)).toBe(1_000)
  expect(loanPayment(13_000, 8, 60)).toBe(263.59)
})

test('every tool computes its own defaults without blank results', () => {
  for (const tool of tools) {
    const result = tool.compute(initialValues(tool))
    expect(result.rows.length).toBeGreaterThan(0)
    expect(
      result.rows.every(
        (row) => row.value !== '' && !row.value.includes('NaN'),
      ),
    ).toBe(true)
  }
})
