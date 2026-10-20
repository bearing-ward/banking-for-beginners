import { Schema } from 'effect'

export const TopicStatus = Schema.Literals(['published', 'planned'])
export type TopicStatus = typeof TopicStatus.Type

export const Topic = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  blurb: Schema.String,
  status: TopicStatus,
  slugs: Schema.Array(Schema.String),
})
export type Topic = typeof Topic.Type

/** A topic is published once it has lessons, and planned until then. */
const topic = (
  id: string,
  title: string,
  blurb: string,
  slugs: ReadonlyArray<string> = [],
): Topic => ({
  id,
  title,
  blurb,
  status: slugs.length > 0 ? 'published' : 'planned',
  slugs,
})

/** Topic order and lesson order, as readers should meet them. */
export const topics: ReadonlyArray<Topic> = [
  topic(
    'money-basics',
    'Money basics',
    'Needs and wants, trade-offs, goals, and the habits everything else builds on.',
    [
      'needs-and-wants',
      'opportunity-cost',
      'hours-of-work',
      'setting-money-goals',
      'pay-yourself-first',
      'money-and-your-feed',
      'talking-about-money',
    ],
  ),
  topic(
    'banking',
    'Banking',
    'Checking and savings accounts, debit cards, statements, fees, and keeping your money safe.',
    [
      'checking-and-savings',
      'banks-and-credit-unions',
      'opening-your-first-account',
      'debit-cards',
      'reading-a-bank-statement',
      'overdraft-fees',
      'keeping-money-safe-fdic',
      'payment-apps',
    ],
  ),
  topic(
    'work',
    'Work and paychecks',
    'Your first job: the paperwork, the pay stub, and why your check is smaller than you expected.',
    [
      'finding-your-first-job',
      'first-job-paperwork',
      'reading-a-pay-stub',
      'minimum-wage-and-teen-work-rules',
      'tips-and-cash-income',
      'gig-work-and-1099',
      'job-benefits',
    ],
  ),
  topic(
    'taxes',
    'Taxes',
    'How income tax works, what withholding is, and how to file your first return.',
    [
      'why-we-pay-taxes',
      'how-tax-brackets-work',
      'the-w4-and-withholding',
      'do-you-need-to-file',
      'filing-your-first-return',
      'self-employment-tax',
    ],
  ),
  topic(
    'budgeting',
    'Budgets and bills',
    'Plan where your money goes, keep bills on time, and price out life on your own.',
    [
      'making-a-budget',
      'tracking-spending',
      'fixed-and-variable-costs',
      'subscriptions',
      'paying-bills-on-time',
      'your-phone-plan',
      'first-apartment-costs',
      'splitting-bills-with-roommates',
    ],
  ),
  topic(
    'saving',
    'Saving',
    'Emergency funds, interest, and where to keep money you will need later.',
    [
      'why-save',
      'emergency-fund',
      'saving-for-goals',
      'how-interest-works',
      'apy-and-high-yield-savings',
      'cds-and-where-to-keep-savings',
    ],
  ),
  topic(
    'credit',
    'Credit and borrowing',
    'Credit scores, credit cards, loans, and the borrowing traps to stay out of.',
    [
      'what-is-credit',
      'credit-scores',
      'credit-reports',
      'how-credit-cards-work',
      'the-minimum-payment-trap',
      'building-credit-as-a-teen',
      'car-loans',
      'buy-now-pay-later',
      'payday-loans-and-predatory-lending',
    ],
  ),
  topic(
    'investing',
    'Investing',
    'Risk and return, index funds, retirement accounts, and why starting young matters.',
    [
      'saving-and-investing',
      'risk-and-return',
      'stocks-bonds-and-funds',
      'index-funds-and-fees',
      'starting-early',
      'retirement-accounts',
      'roth-ira-for-teens',
      'hype-crypto-and-meme-stocks',
    ],
  ),
  topic(
    'fraud',
    'Fraud and scams',
    'Spot the tricks scammers use on teens, protect your identity, and know what to do if it happens.',
    [
      'spotting-a-scam',
      'phishing-texts-and-emails',
      'payment-app-scams',
      'fake-check-scams',
      'job-and-gig-scams',
      'money-mules',
      'online-marketplace-and-resale-scams',
      'investment-and-crypto-scams',
      'sextortion-scams',
      'identity-theft-and-credit-freezes',
      'if-you-get-scammed',
    ],
  ),
  topic(
    'insurance',
    'Insurance',
    'How insurance works, and the policies you will meet first: car, health, and renters.',
    [
      'how-insurance-works',
      'car-insurance',
      'health-insurance-basics',
      'renters-insurance',
      'extended-warranties-and-add-ons',
    ],
  ),
  topic(
    'college',
    'Paying for college',
    'What school really costs, the FAFSA, free money, and student loans.',
    [
      'cost-of-attendance',
      'the-fafsa',
      'scholarships-and-grants',
      'federal-and-private-student-loans',
      'borrowing-wisely',
      'other-paths',
    ],
  ),
  topic(
    'turning-18',
    'Turning 18',
    'What changes when you become a legal adult: contracts, cars, and your rights as a customer.',
    [
      'what-changes-at-18',
      'reading-a-contract',
      'buying-your-first-car',
      'your-rights-as-a-customer',
      'getting-organized',
    ],
  ),
]

export const lessonKey = (topic: string, slug: string) => `${topic}/${slug}`
