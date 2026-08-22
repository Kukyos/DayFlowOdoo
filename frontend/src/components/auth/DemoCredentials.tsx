import { useState } from 'react'
import { Button } from '@/components/ui'

/**
 * Collapsed "click to reveal" panel above the sign-in card, holding the two
 * demo accounts a judge or tester signs in with.
 *
 * Collapsed by default on purpose: it is scaffolding for evaluating the build,
 * not part of the product, so it should not be the first thing the eye lands
 * on above the real form. Revealing it is one click, and each account fills
 * the form directly — a tester should not have to retype an address to look
 * at the app.
 *
 * Styled as a bordered card on the raised surface, the same shell as AuthCard
 * below it, so it reads as part of the page rather than a debug artifact.
 *
 * This is demo-account scaffolding for the hackathon. It is deliberately
 * visible to anyone who opens the app; see the note in README. Remove this
 * component (and its two accounts) before the app carries real employee data.
 */

type DemoAccount = {
  role: string
  email: string
  password: string
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: 'Admin / HR', email: 'odootestadmin@gmail.com', password: 'DayflowDemo7!' },
  { role: 'Employee', email: 'odootestemployee@gmail.com', password: 'DayflowDemo7!' },
]

export function DemoCredentials({
  onUse,
}: {
  onUse: (email: string, password: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-4 rounded-card border border-border bg-surface-raised text-text">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="demo-credentials"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="t-label">Demo logins for testing</span>
        <span className="t-caption text-text-muted" aria-hidden="true">
          {open ? 'Hide ▲' : 'Reveal ▼'}
        </span>
      </button>

      {open && (
        <div id="demo-credentials" className="border-t border-border-soft px-4 py-3">
          <ul className="flex flex-col gap-3">
            {DEMO_ACCOUNTS.map((account) => (
              <li
                key={account.email}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="t-label text-text-muted">{account.role}</p>
                  <p className="t-data mt-0.5 break-all">{account.email}</p>
                  <p className="t-data text-text-muted">{account.password}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => onUse(account.email, account.password)}
                >
                  Use
                </Button>
              </li>
            ))}
          </ul>
          <p className="t-caption mt-3 border-t border-border-soft pt-3 text-text-muted">
            Shared demo accounts. Both use the same password, and the data they
            show is seeded, not real.
          </p>
        </div>
      )}
    </div>
  )
}
