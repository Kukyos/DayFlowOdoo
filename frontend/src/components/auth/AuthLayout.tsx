import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Button, Modal } from '@/components/ui'
import { currentTheme, toggleTheme, type Theme } from '@/lib/theme'
import dayflowLogo from '@/assets/dayflow-df-logo.png'
import { WorkweekMark } from './WorkweekMark'

/**
 * The split auth layout: an inked header over a full-bleed colour field, with
 * the form floating right and the illustration left.
 *
 * This is the one page background allowed to carry colour — DESIGN.md §2.5.
 * The field uses `--auth-panel`, its own token, so the accent colours that mean
 * a presence inside the app cannot leak onto a page background.
 */
export function AuthLayout({
  children,
  otherAction,
}: {
  children: ReactNode
  otherAction: 'signin' | 'signup'
}) {
  const [theme, setThemeState] = useState<Theme>(currentTheme)
  const [termsOpen, setTermsOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <header className="flex items-center justify-between border-b border-border px-3 py-3 sm:px-8">
        <Link to="/" className="t-h3 font-display tracking-normal" aria-label="Dayflow home">
          Dayflow
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setThemeState(toggleTheme())}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </Button>
          {otherAction === 'signup' ? (
            <>
              <Link to="/signup">
                <Button size="sm" variant="inverted">
                  Sign up
                </Button>
              </Link>
              <span className="hidden t-caption text-text-muted sm:inline">Log in</span>
            </>
          ) : (
            <>
              <span className="hidden t-caption text-text-muted sm:inline">Sign up</span>
              <Link to="/signin">
                <Button size="sm" variant="inverted">
                  Log in
                </Button>
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="relative flex flex-1 flex-col bg-auth-panel text-auth-panel-ink">
        <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col items-center gap-8 px-4 py-8 sm:px-5 sm:py-12 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:px-12">
          <div className="hidden w-full max-w-[520px] lg:block" aria-hidden="true">
            <WorkweekMark />
          </div>
          <div className="w-full max-w-[440px]">{children}</div>
        </div>

        {/* Bottom furniture stays visible and compact on phones (Pooja) and
            carries the real Terms/Privacy modals at every width (Athira).
            Two pills plus the logo measure ~391px at the base breakpoint —
            wider than a 360-390px phone — so it stacks below `sm` and only
            sits in one row once there is room (640px+) for both of them. */}
        <div className="pointer-events-none flex flex-col items-center gap-3 px-4 pb-6 sm:flex-row sm:items-end sm:justify-between sm:px-8 lg:px-12 lg:pb-8">
          <img
            src={dayflowLogo}
            alt=""
            className="auth-brand-logo h-11 w-auto shrink-0 select-none opacity-90 sm:h-14 lg:h-[72px]"
            aria-hidden="true"
          />
          <div className="pointer-events-auto flex items-center gap-2">
            <LegalLinkButton onClick={() => setPrivacyOpen(true)}>Privacy Policy</LegalLinkButton>
            <LegalLinkButton onClick={() => setTermsOpen(true)}>Terms &amp; Conditions</LegalLinkButton>
          </div>
        </div>
      </main>

      <Modal open={termsOpen} onClose={() => setTermsOpen(false)} title="Terms and Conditions">
        <TermsContent />
      </Modal>
      <Modal open={privacyOpen} onClose={() => setPrivacyOpen(false)} title="Privacy Policy">
        <PrivacyContent />
      </Modal>
    </div>
  )
}

/** One consistent pill style for both legal links, on the phone footer and the desktop furniture. */
function LegalLinkButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-current px-3 py-2 t-caption transition-colors hover:bg-auth-panel-ink/10 sm:px-4"
    >
      {children}
    </button>
  )
}

/** Plain-language MVP terms. Placeholder legal copy, not reviewed counsel. */
function TermsContent() {
  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1 t-body text-text-muted">
      <p>
        These terms govern your company's use of Dayflow. By creating a company
        account or signing in, your admin agrees to them on behalf of your
        organisation, and every invited employee agrees to them by signing in.
      </p>
      <div>
        <h3 className="t-h3 mb-1 text-text">1. What Dayflow is for</h3>
        <p>
          Dayflow is a workforce record system: employee profiles, attendance,
          time off, and a per-employee salary breakdown, scoped to your
          company. It is not a payroll processor and does not move money.
        </p>
      </div>
      <div>
        <h3 className="t-h3 mb-1 text-text">2. Accounts</h3>
        <p>
          Only an admin or HR officer can create an employee account, through
          an invite. Employees do not self-register. Each person is
          responsible for keeping their own password confidential and for
          activity under their account.
        </p>
      </div>
      <div>
        <h3 className="t-h3 mb-1 text-text">3. Company data</h3>
        <p>
          Everything entered — profiles, attendance, leave requests, wage
          figures — belongs to your company. Row-level security scopes every
          query to your company alone; no other company's data is visible from
          yours.
        </p>
      </div>
      <div>
        <h3 className="t-h3 mb-1 text-text">4. Acceptable use</h3>
        <p>
          Use Dayflow only for legitimate workforce administration for your
          own organisation. Do not attempt to access another company's
          records, share login credentials, or use the service to store data
          you are not authorised to hold.
        </p>
      </div>
      <div>
        <h3 className="t-h3 mb-1 text-text">5. Changes</h3>
        <p>
          This is an early build and these terms may change as the product
          does. Material changes will be reflected here before they take
          effect.
        </p>
      </div>
    </div>
  )
}

/** Plain-language MVP privacy policy. Placeholder legal copy, not reviewed counsel. */
function PrivacyContent() {
  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1 t-body text-text-muted">
      <p>
        This explains what Dayflow stores about you and your company, and who
        can see it.
      </p>
      <div>
        <h3 className="t-h3 mb-1 text-text">1. What we store</h3>
        <p>
          Account details (name, work email), employment data (role,
          department, attendance, leave balances), and — for admins and HR
          only — wage and bank details entered for payroll purposes. Nothing
          beyond what a page on Dayflow actually asks for.
        </p>
      </div>
      <div>
        <h3 className="t-h3 mb-1 text-text">2. Who can see it</h3>
        <p>
          Coworkers see only directory-safe fields: name, position, department,
          and whether you are in today. Private information, salary, and bank
          details are visible to you and to your company's admin/HR officers
          only, enforced at the database level, not just hidden in the
          interface.
        </p>
      </div>
      <div>
        <h3 className="t-h3 mb-1 text-text">3. Company isolation</h3>
        <p>
          Your data is scoped to your company. Nobody outside it — no other
          company on Dayflow — can query or view your records.
        </p>
      </div>
      <div>
        <h3 className="t-h3 mb-1 text-text">4. How it's used</h3>
        <p>
          Solely to run the product: showing your directory, tracking
          attendance, processing leave requests, and computing your salary
          breakdown. It is not sold, and it is not used for advertising.
        </p>
      </div>
      <div>
        <h3 className="t-h3 mb-1 text-text">5. Your controls</h3>
        <p>
          You can update your own profile, private details, and resume at any
          time from My Profile. To correct or remove data you cannot edit
          yourself, contact your company's admin or HR officer.
        </p>
      </div>
    </div>
  )
}

/** The card the form sits in. Raised surface, since it floats on the field. */
export function AuthCard({
  title,
  children,
  footer,
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <>
      <div className="rounded-card border border-border bg-surface-raised p-5 text-text sm:p-8">
        <h1 className="t-label mb-6 text-center">{title}</h1>
        {children}
      </div>
      {footer && <div className="mt-5 text-center">{footer}</div>}
    </>
  )
}
