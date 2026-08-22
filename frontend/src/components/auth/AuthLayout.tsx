import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui'
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

        {/* Bottom furniture, matching the reference: brand mark left, terms right.
            Hidden below lg so it never overlaps the form on a phone. */}
        <div className="pointer-events-none hidden items-end justify-between px-12 pb-8 lg:flex">
          <img
            src={dayflowLogo}
            alt=""
            className="auth-brand-logo h-[72px] w-auto select-none opacity-90"
            aria-hidden="true"
          />
          <span className="pointer-events-auto rounded-full border border-current px-4 py-2 t-caption">
            Terms &amp; Conditions
          </span>
        </div>
      </main>
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
      <div className="rounded-card border border-border bg-surface-raised p-6 text-text sm:p-8">
        <h1 className="t-label mb-6 text-center">{title}</h1>
        {children}
      </div>
      {footer && <div className="mt-5 text-center">{footer}</div>}
    </>
  )
}
