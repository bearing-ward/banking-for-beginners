/**
 * The dollar figures lessons and tools rely on, for one US tax year. Every
 * lesson is checked against these; when a new year's figures are published,
 * update this file, reread the lessons, and record a review (see AGENTS.md).
 *
 * Sources: IRS Rev. Proc. 2025-32 (brackets, standard deduction), IRS Notice
 * 2025-67 (retirement limits), SSA 2026 fact sheet (wage base), FDIC.
 */
export const rules = {
  year: 2026,
  /** Single filer. */
  standardDeduction: 16_100,
  /** A dependent's standard deduction: the greater of these, up to the full one. */
  dependentMinimumDeduction: 1_350,
  dependentEarnedIncomeAddOn: 450,
  /** Single filer brackets: the rate applies to income up to `upTo`. */
  brackets: [
    { upTo: 12_400, rate: 0.1 },
    { upTo: 50_400, rate: 0.12 },
    { upTo: 105_700, rate: 0.22 },
    { upTo: 201_775, rate: 0.24 },
    { upTo: 256_225, rate: 0.32 },
    { upTo: 640_600, rate: 0.35 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.37 },
  ],
  socialSecurityRate: 0.062,
  socialSecurityWageBase: 184_500,
  medicareRate: 0.0145,
  /** Self-employed people pay both halves of Social Security and Medicare. */
  selfEmploymentTaxRate: 0.153,
  selfEmploymentEarningsShare: 0.9235,
  selfEmploymentFilingThreshold: 400,
  federalMinimumWage: 7.25,
  iraContributionLimit: 7_500,
  employee401kLimit: 24_500,
  fdicInsuranceLimit: 250_000,
} as const

export const rulesYear = String(rules.year)
