/**
 * The salary engine. A pure function — no Supabase, no I/O, no React.
 *
 * docs/SCHEMA.md is the authority for these rules. Nothing here is stored:
 * the MVP keeps one `monthly_wage` column and derives every component from it,
 * so this file is the only place the breakdown exists.
 *
 * Rules, in order:
 *   Basic               50% of the monthly wage
 *   House Rent Allow.   50% of Basic
 *   Standard Allowance  flat ₹4,167
 *   Performance Bonus   8.33% of Basic
 *   Leave Travel Allow. 8.33% of Basic
 *   Fixed Allowance     whatever is left of the wage
 *   PF (employee)       12% of Basic       — deduction
 *   PF (employer)       12% of Basic       — company cost, never deducted
 *   Professional Tax    flat ₹200          — deduction
 */

export const STANDARD_ALLOWANCE = 4167
export const PF_PERCENT = 12
export const PROFESSIONAL_TAX = 200

const BASIC_PERCENT_OF_WAGE = 50
const HRA_PERCENT_OF_BASIC = 50
const BONUS_PERCENT_OF_BASIC = 8.33
const LTA_PERCENT_OF_BASIC = 8.33

export type SalaryLine = { name: string; amount: number; note: string }

export type SalaryBreakdown = {
  wage: number
  earnings: SalaryLine[]
  gross: number
  deductions: SalaryLine[]
  totalDeductions: number
  employerCost: SalaryLine[]
  net: number
  /**
   * False when the fixed components (Standard Allowance) leave nothing for the
   * residual — i.e. the wage is too low for this structure. The Salary Info tab
   * surfaces this rather than rendering a negative allowance as if it were fine.
   */
  isValid: boolean
  /** Lowest wage for which Fixed Allowance is not negative. */
  minimumWage: number
}

/** Round to paise. Avoids the 0.1 + 0.2 class of float error in a money column. */
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * The wage at which the residual hits exactly zero.
 *
 * Everything except Standard Allowance is a fraction of the wage:
 *   basic .5w + hra .25w + bonus .04165w + lta .04165w = 0.8333w
 * so the residual is w - 0.8333w - 4167, which is zero at 4167 / 0.1667.
 */
const percentageShareOfWage =
  BASIC_PERCENT_OF_WAGE / 100 +
  (BASIC_PERCENT_OF_WAGE / 100) * (HRA_PERCENT_OF_BASIC / 100) +
  (BASIC_PERCENT_OF_WAGE / 100) * (BONUS_PERCENT_OF_BASIC / 100) +
  (BASIC_PERCENT_OF_WAGE / 100) * (LTA_PERCENT_OF_BASIC / 100)

/**
 * Ceiling, not round. The exact break-even is ₹24,997.0006, and at ₹24,997 the
 * five components round *up* to ₹24,997.01, which puts the residual a paisa
 * under zero. One rupee of headroom clears the few paise that rounding four
 * terms can cost.
 */
export const MINIMUM_WAGE = Math.ceil(
  STANDARD_ALLOWANCE / (1 - percentageShareOfWage),
)

export function computeSalary(monthlyWage: number): SalaryBreakdown {
  const wage = Number.isFinite(monthlyWage) && monthlyWage > 0 ? monthlyWage : 0

  const basic = round2((wage * BASIC_PERCENT_OF_WAGE) / 100)
  const hra = round2((basic * HRA_PERCENT_OF_BASIC) / 100)
  const standard = wage > 0 ? STANDARD_ALLOWANCE : 0
  const bonus = round2((basic * BONUS_PERCENT_OF_BASIC) / 100)
  const lta = round2((basic * LTA_PERCENT_OF_BASIC) / 100)

  // The residual takes the rounding remainder too, so the earnings always total
  // the wage to the paisa rather than drifting a few paise off it.
  const fixed = round2(wage - (basic + hra + standard + bonus + lta))

  const earnings: SalaryLine[] = [
    { name: 'Basic Salary', amount: basic, note: '50% of wage' },
    { name: 'House Rent Allowance', amount: hra, note: '50% of Basic' },
    { name: 'Standard Allowance', amount: standard, note: 'Fixed amount' },
    { name: 'Performance Bonus', amount: bonus, note: '8.33% of Basic' },
    { name: 'Leave Travel Allowance', amount: lta, note: '8.33% of Basic' },
    { name: 'Fixed Allowance', amount: fixed, note: 'Balance of wage' },
  ]

  const pfEmployee = round2((basic * PF_PERCENT) / 100)
  const professionalTax = wage > 0 ? PROFESSIONAL_TAX : 0

  const deductions: SalaryLine[] = [
    { name: 'Provident Fund', amount: pfEmployee, note: '12% of Basic' },
    { name: 'Professional Tax', amount: professionalTax, note: 'Fixed amount' },
  ]

  const employerCost: SalaryLine[] = [
    { name: 'Provident Fund (employer)', amount: pfEmployee, note: '12% of Basic' },
  ]

  const gross = round2(earnings.reduce((sum, line) => sum + line.amount, 0))
  const totalDeductions = round2(
    deductions.reduce((sum, line) => sum + line.amount, 0),
  )

  return {
    wage: round2(wage),
    earnings,
    gross,
    deductions,
    totalDeductions,
    employerCost,
    net: round2(gross - totalDeductions),
    isValid: wage >= MINIMUM_WAGE && fixed >= 0,
    minimumWage: MINIMUM_WAGE,
  }
}

/** `₹50,000.00` — Indian digit grouping, always two decimals. */
export function formatRupees(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
