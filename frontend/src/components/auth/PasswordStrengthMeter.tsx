import { useMemo } from 'react'
import { PASSWORD_MIN, passwordProblem } from '@/services/auth'

/**
 * Live strength feedback for a password field, built only on top of the
 * existing rule in `services/auth.ts` (`passwordProblem`: length ≥
 * `PASSWORD_MIN`, at least one letter and one number). Nothing here changes
 * or duplicates that rule as a source of truth — a password can only ever
 * reach "Very Strong" if `passwordProblem` also accepts it.
 *
 * Extra graduation beyond the pass/fail rule (longer length, mixed case, a
 * special character) is what turns a bare "valid" into a five-step gradient,
 * so the bar reflects quality rather than only meeting the minimum.
 */

type Level = {
  label: string
  dot: string
  barClass: string
}

const LEVELS: Level[] = [
  { label: 'Very Weak', dot: '🔴', barClass: 'bg-danger-ink' },
  { label: 'Weak', dot: '🟠', barClass: 'bg-[#f59e0b]' },
  { label: 'Fair', dot: '🟡', barClass: 'bg-[#eab308]' },
  { label: 'Good', dot: '🟢', barClass: 'bg-[#84cc16]' },
  { label: 'Very Strong', dot: '🟢', barClass: 'bg-[#22c55e]' },
]

function scorePassword(password: string): number {
  if (!password) return -1

  // The real requirement is binary. Failing it caps the score low, no matter
  // how many bonus signals below are also true.
  const meetsRequirement = passwordProblem(password) === null

  let score = 0
  if (password.length >= PASSWORD_MIN) score++
  if (password.length >= PASSWORD_MIN + 4) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  if (!meetsRequirement) score = Math.min(score, 1)
  return Math.min(score, 5)
}

function levelForScore(score: number): number {
  if (score <= 0) return 0
  if (score >= 4) return 4
  return score
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  const score = useMemo(() => scorePassword(password), [password])

  if (score < 0) return null

  const levelIndex = levelForScore(score)
  const level = LEVELS[levelIndex]
  const percent = Math.max(8, (Math.max(score, 0) / 5) * 100)

  return (
    <div className="mt-2 flex flex-col gap-1.5" aria-live="polite">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-border-soft"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={Math.max(score, 0)}
        aria-label="Password strength"
      >
        <div
          className={`h-full rounded-full transition-[width,background-color] duration-300 ease-out ${level.barClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="t-label text-text-muted">
        {level.dot} {level.label}
      </span>
    </div>
  )
}
