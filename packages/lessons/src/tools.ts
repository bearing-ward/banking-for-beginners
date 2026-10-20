import { Array, Option, pipe } from 'effect'

import { rules } from './rules.ts'

/**
 * Tools are the "Try it" calculators beside a lesson. Each is a pure function
 * from the reader's inputs to rows of results, so the page recomputes as they
 * type and tests can pin the arithmetic.
 */
export type FieldUnit = 'dollars' | 'percent' | 'years' | 'months' | 'hours'

export type Field = {
  readonly id: string
  readonly label: string
  readonly unit: FieldUnit
  readonly initial: number
  readonly min: number
  readonly max: number
  readonly step: number
}

export type ResultRow = {
  readonly label: string
  readonly value: string
  readonly isEmphasized: boolean
}

export type ToolResult = {
  readonly rows: ReadonlyArray<ResultRow>
  readonly note: string
}

export type Tool = {
  readonly id: string
  readonly title: string
  readonly intro: string
  readonly fields: ReadonlyArray<Field>
  readonly compute: (values: Readonly<Record<string, number>>) => ToolResult
}

// FORMAT

const dollarFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const wholeDollarFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export const dollars = (amount: number) => dollarFormat.format(amount)
export const wholeDollars = (amount: number) => wholeDollarFormat.format(amount)

/** A deduction, shown with a minus sign unless it is zero. */
const minus = (amount: number) =>
  roundCents(amount) === 0 ? dollars(0) : `−${dollars(amount)}`

const row = (
  label: string,
  value: string,
  isEmphasized = false,
): ResultRow => ({
  label,
  value,
  isEmphasized,
})

const roundCents = (amount: number) => Math.round(amount * 100) / 100

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`

const yearsAndMonths = (months: number) => {
  const years = Math.floor(months / 12)
  const rest = months % 12
  return years === 0
    ? plural(rest, 'month')
    : rest === 0
      ? plural(years, 'year')
      : `${plural(years, 'year')}, ${plural(rest, 'month')}`
}

const valueOf = (values: Readonly<Record<string, number>>, id: string) => {
  const value = values[id] ?? 0
  return Number.isFinite(value) ? value : 0
}

// MATH

/** Federal income tax on taxable income, for a single filer, by bracket. */
export const incomeTax = (taxableIncome: number) =>
  pipe(
    rules.brackets,
    Array.reduce({ tax: 0, floor: 0 }, (state, bracket) => {
      const taxed = Math.max(
        0,
        Math.min(taxableIncome, bracket.upTo) - state.floor,
      )
      return { tax: state.tax + taxed * bracket.rate, floor: bracket.upTo }
    }),
    (state) => roundCents(state.tax),
  )

/** The standard deduction of someone a parent claims as a dependent, with only job income. */
export const dependentStandardDeduction = (earnedIncome: number) =>
  Math.min(
    rules.standardDeduction,
    Math.max(
      rules.dependentMinimumDeduction,
      earnedIncome + rules.dependentEarnedIncomeAddOn,
    ),
  )

export type Paycheck = {
  readonly gross: number
  readonly socialSecurity: number
  readonly medicare: number
  readonly federal: number
  readonly state: number
  readonly net: number
}

/**
 * One week's pay, assuming the same hours all year, a single filer, and no
 * other income. Real withholding follows the W-4 and IRS tables, so treat this
 * as an estimate.
 */
export const weeklyPaycheck = (
  hourlyWage: number,
  hoursPerWeek: number,
  stateRatePercent: number,
): Paycheck => {
  const gross = roundCents(hourlyWage * hoursPerWeek)
  const yearly = gross * 52
  const federal = roundCents(
    incomeTax(Math.max(0, yearly - rules.standardDeduction)) / 52,
  )
  const socialSecurity = roundCents(gross * rules.socialSecurityRate)
  const medicare = roundCents(gross * rules.medicareRate)
  const state = roundCents((gross * stateRatePercent) / 100)
  return {
    gross,
    socialSecurity,
    medicare,
    federal,
    state,
    net: roundCents(gross - socialSecurity - medicare - federal - state),
  }
}

export type Growth = {
  readonly deposited: number
  readonly balance: number
  readonly interest: number
}

/** A starting amount plus a deposit each month, growing at a yearly rate compounded monthly. */
export const compoundGrowth = (
  start: number,
  monthlyDeposit: number,
  yearlyRatePercent: number,
  years: number,
): Growth => {
  const months = Math.max(0, Math.round(years * 12))
  const monthlyRate = yearlyRatePercent / 100 / 12
  const balance = Array.reduce(
    Array.makeBy(months, (month) => month),
    start,
    (total) => total * (1 + monthlyRate) + monthlyDeposit,
  )
  const deposited = start + monthlyDeposit * months
  return {
    deposited: roundCents(deposited),
    balance: roundCents(balance),
    interest: roundCents(balance - deposited),
  }
}

export type Payoff =
  | { readonly _tag: 'NeverPaidOff'; readonly firstMonthInterest: number }
  | {
      readonly _tag: 'PaidOff'
      readonly months: number
      readonly totalInterest: number
      readonly totalPaid: number
    }

const maxPayoffMonths = 1200

/** Paying a fixed amount each month on a card balance that charges interest monthly. */
export const cardPayoff = (
  balance: number,
  aprPercent: number,
  monthlyPayment: number,
): Payoff => {
  const monthlyRate = aprPercent / 100 / 12
  const firstMonthInterest = roundCents(balance * monthlyRate)
  if (balance <= 0) {
    return { _tag: 'PaidOff', months: 0, totalInterest: 0, totalPaid: 0 }
  }
  if (monthlyPayment <= firstMonthInterest) {
    return { _tag: 'NeverPaidOff', firstMonthInterest }
  }
  const step = (state: {
    readonly owed: number
    readonly months: number
    readonly interest: number
    readonly paid: number
  }): typeof state => {
    if (state.owed <= 0 || state.months >= maxPayoffMonths) {
      return state
    }
    const interest = roundCents(state.owed * monthlyRate)
    const payment = Math.min(monthlyPayment, state.owed + interest)
    return step({
      owed: roundCents(state.owed + interest - payment),
      months: state.months + 1,
      interest: state.interest + interest,
      paid: state.paid + payment,
    })
  }
  const final = step({ owed: balance, months: 0, interest: 0, paid: 0 })
  return {
    _tag: 'PaidOff',
    months: final.months,
    totalInterest: roundCents(final.interest),
    totalPaid: roundCents(final.paid),
  }
}

/** The fixed monthly payment that repays a loan over a number of months. */
export const loanPayment = (
  principal: number,
  aprPercent: number,
  months: number,
) => {
  if (months <= 0) {
    return 0
  }
  const monthlyRate = aprPercent / 100 / 12
  return roundCents(
    monthlyRate === 0
      ? principal / months
      : (principal * monthlyRate) / (1 - (1 + monthlyRate) ** -months),
  )
}

// TOOLS

const paycheck: Tool = {
  id: 'paycheck',
  title: 'Paycheck estimator',
  intro:
    'Estimate one week of pay from an hourly job: what you earn, what comes out, and what lands in your account.',
  fields: [
    {
      id: 'wage',
      label: 'Hourly wage',
      unit: 'dollars',
      initial: 15,
      min: 0,
      max: 200,
      step: 0.25,
    },
    {
      id: 'hours',
      label: 'Hours per week',
      unit: 'hours',
      initial: 20,
      min: 0,
      max: 80,
      step: 1,
    },
    {
      id: 'stateRate',
      label: 'State income tax rate',
      unit: 'percent',
      initial: 0,
      min: 0,
      max: 15,
      step: 0.1,
    },
  ],
  compute: (values) => {
    const pay = weeklyPaycheck(
      valueOf(values, 'wage'),
      valueOf(values, 'hours'),
      valueOf(values, 'stateRate'),
    )
    return {
      rows: [
        row('Gross pay', dollars(pay.gross)),
        row('Social Security (6.2%)', minus(pay.socialSecurity)),
        row('Medicare (1.45%)', minus(pay.medicare)),
        row('Federal income tax (estimate)', minus(pay.federal)),
        row('State income tax', minus(pay.state)),
        row('Net pay', dollars(pay.net), true),
        row('Net pay over a year', wholeDollars(pay.net * 52)),
      ],
      note: `Assumes the same hours every week of ${rules.year}, a single filer, and no other income. Your employer's withholding follows your W-4, so real checks differ.`,
    }
  },
}

const savingsGrowth: Tool = {
  id: 'compound-growth',
  title: 'Compound growth',
  intro:
    'See how a starting amount and a monthly deposit grow when interest earns interest.',
  fields: [
    {
      id: 'start',
      label: 'Starting amount',
      unit: 'dollars',
      initial: 500,
      min: 0,
      max: 1_000_000,
      step: 50,
    },
    {
      id: 'monthly',
      label: 'Added each month',
      unit: 'dollars',
      initial: 50,
      min: 0,
      max: 10_000,
      step: 5,
    },
    {
      id: 'rate',
      label: 'Yearly return',
      unit: 'percent',
      initial: 4,
      min: 0,
      max: 15,
      step: 0.1,
    },
    {
      id: 'years',
      label: 'Years',
      unit: 'years',
      initial: 10,
      min: 0,
      max: 60,
      step: 1,
    },
  ],
  compute: (values) => {
    const growth = compoundGrowth(
      valueOf(values, 'start'),
      valueOf(values, 'monthly'),
      valueOf(values, 'rate'),
      valueOf(values, 'years'),
    )
    return {
      rows: [
        row('You put in', dollars(growth.deposited)),
        row('Growth earned', dollars(growth.interest)),
        row('Ending balance', dollars(growth.balance), true),
      ],
      note: 'Compounded monthly at a steady rate. Savings rates change, and investments rise and fall from year to year.',
    }
  },
}

const budget: Tool = {
  id: 'budget',
  title: '50/30/20 budget',
  intro:
    'Split your monthly take-home pay into needs, wants, and saving. It is a starting point, not a rule.',
  fields: [
    {
      id: 'income',
      label: 'Monthly take-home pay',
      unit: 'dollars',
      initial: 2_400,
      min: 0,
      max: 50_000,
      step: 50,
    },
  ],
  compute: (values) => {
    const income = valueOf(values, 'income')
    return {
      rows: [
        row('Needs (50%): rent, food, transport, bills', dollars(income * 0.5)),
        row('Wants (30%): fun, eating out, hobbies', dollars(income * 0.3)),
        row('Saving and debt (20%)', dollars(income * 0.2), true),
      ],
      note: 'If needs take more than half, trim wants first, then look for cheaper needs such as a roommate or a cheaper phone plan.',
    }
  },
}

const creditCard: Tool = {
  id: 'card-payoff',
  title: 'Credit card payoff',
  intro:
    'See how long a card balance takes to pay off, and what it costs, at a fixed monthly payment.',
  fields: [
    {
      id: 'balance',
      label: 'Balance',
      unit: 'dollars',
      initial: 1_000,
      min: 0,
      max: 100_000,
      step: 50,
    },
    {
      id: 'apr',
      label: 'APR',
      unit: 'percent',
      initial: 24,
      min: 0,
      max: 40,
      step: 0.1,
    },
    {
      id: 'payment',
      label: 'Monthly payment',
      unit: 'dollars',
      initial: 50,
      min: 0,
      max: 10_000,
      step: 5,
    },
  ],
  compute: (values) => {
    const payoff = cardPayoff(
      valueOf(values, 'balance'),
      valueOf(values, 'apr'),
      valueOf(values, 'payment'),
    )
    return payoff._tag === 'NeverPaidOff'
      ? {
          rows: [
            row(
              'Interest charged in month one',
              dollars(payoff.firstMonthInterest),
            ),
            row('Time to pay off', 'Never', true),
          ],
          note: 'Your payment does not cover the interest, so the balance never shrinks. Pay more than the interest each month.',
        }
      : {
          rows: [
            row('Time to pay off', yearsAndMonths(payoff.months), true),
            row('Interest paid', dollars(payoff.totalInterest)),
            row('Total paid', dollars(payoff.totalPaid)),
          ],
          note: 'Assumes no new purchases and the same APR the whole time. Late payments can raise the APR.',
        }
  },
}

const emergencyFund: Tool = {
  id: 'emergency-fund',
  title: 'Emergency fund planner',
  intro:
    'Work out how big your safety cushion should be and how long it takes to build.',
  fields: [
    {
      id: 'essentials',
      label: 'Monthly must-pay costs',
      unit: 'dollars',
      initial: 1_500,
      min: 0,
      max: 50_000,
      step: 50,
    },
    {
      id: 'months',
      label: 'Months to cover',
      unit: 'months',
      initial: 3,
      min: 1,
      max: 12,
      step: 1,
    },
    {
      id: 'saved',
      label: 'Already saved',
      unit: 'dollars',
      initial: 200,
      min: 0,
      max: 500_000,
      step: 50,
    },
    {
      id: 'monthly',
      label: 'Saved each month',
      unit: 'dollars',
      initial: 150,
      min: 0,
      max: 50_000,
      step: 10,
    },
  ],
  compute: (values) => {
    const goal = valueOf(values, 'essentials') * valueOf(values, 'months')
    const left = Math.max(0, goal - valueOf(values, 'saved'))
    const monthly = valueOf(values, 'monthly')
    const monthsToGoal = Option.liftPredicate(
      monthly,
      (amount) => amount > 0,
    ).pipe(Option.map((amount) => Math.ceil(left / amount)))
    return {
      rows: [
        row('Your goal', dollars(goal)),
        row('Still to save', dollars(left)),
        row(
          'Time to reach it',
          left === 0
            ? 'Done already'
            : Option.match(monthsToGoal, {
                onNone: () => 'Add a monthly amount',
                onSome: yearsAndMonths,
              }),
          true,
        ),
      ],
      note: 'Keep this money in a separate savings account you can reach in a day or two, not invested in stocks.',
    }
  },
}

const carLoan: Tool = {
  id: 'loan',
  title: 'Loan calculator',
  intro:
    'See the monthly payment and total interest on a car loan or any fixed-rate loan.',
  fields: [
    {
      id: 'price',
      label: 'Price',
      unit: 'dollars',
      initial: 15_000,
      min: 0,
      max: 200_000,
      step: 500,
    },
    {
      id: 'down',
      label: 'Down payment',
      unit: 'dollars',
      initial: 2_000,
      min: 0,
      max: 200_000,
      step: 250,
    },
    {
      id: 'apr',
      label: 'APR',
      unit: 'percent',
      initial: 8,
      min: 0,
      max: 30,
      step: 0.1,
    },
    {
      id: 'months',
      label: 'Loan length in months',
      unit: 'months',
      initial: 60,
      min: 1,
      max: 96,
      step: 1,
    },
  ],
  compute: (values) => {
    const principal = Math.max(
      0,
      valueOf(values, 'price') - valueOf(values, 'down'),
    )
    const months = Math.round(valueOf(values, 'months'))
    const payment = loanPayment(principal, valueOf(values, 'apr'), months)
    const totalPaid = roundCents(payment * months)
    return {
      rows: [
        row('Amount borrowed', dollars(principal)),
        row('Monthly payment', dollars(payment), true),
        row('Total interest', dollars(Math.max(0, totalPaid - principal))),
        row('Total paid for the loan', dollars(totalPaid)),
      ],
      note: 'Longer loans have smaller payments but cost more interest. Insurance, gas, and repairs come on top.',
    }
  },
}

const hoursOfWork: Tool = {
  id: 'hours-of-work',
  title: 'Price in hours',
  intro: 'Turn a price tag into the hours of work it costs you after taxes.',
  fields: [
    {
      id: 'price',
      label: 'Price',
      unit: 'dollars',
      initial: 180,
      min: 0,
      max: 100_000,
      step: 5,
    },
    {
      id: 'wage',
      label: 'Hourly wage',
      unit: 'dollars',
      initial: 15,
      min: 0.25,
      max: 200,
      step: 0.25,
    },
    {
      id: 'kept',
      label: 'Share of pay you keep after taxes',
      unit: 'percent',
      initial: 90,
      min: 1,
      max: 100,
      step: 1,
    },
  ],
  compute: (values) => {
    const takeHomePerHour =
      (valueOf(values, 'wage') * valueOf(values, 'kept')) / 100
    const hours =
      takeHomePerHour > 0 ? valueOf(values, 'price') / takeHomePerHour : 0
    return {
      rows: [
        row('Take-home pay per hour', dollars(takeHomePerHour)),
        row('Hours of work', `${hours.toFixed(1)} hours`, true),
      ],
      note: 'Before you buy, ask whether it is worth that many hours of your time.',
    }
  },
}

export const tools: ReadonlyArray<Tool> = [
  paycheck,
  savingsGrowth,
  budget,
  creditCard,
  emergencyFund,
  carLoan,
  hoursOfWork,
]

export const findTool = (id: string) =>
  Array.findFirst(tools, (tool) => tool.id === id)

export const isTool = (id: string) => Option.isSome(findTool(id))

export const initialValues = (tool: Tool): Record<string, number> =>
  Object.fromEntries(tool.fields.map((field) => [field.id, field.initial]))
