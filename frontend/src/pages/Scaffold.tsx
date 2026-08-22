import { useState } from 'react'
import { Link } from 'react-router-dom'
import { currentTheme, toggleTheme, type Theme } from '../lib/theme'

/**
 * Stage 1 placeholder for every route, and the proof sheet for the token
 * layer. It exists so the tokens and fonts in docs/DESIGN.md can be verified
 * in a real browser rather than only read in a document — a previous run
 * shipped an entire build in fallback Arial while four people read a doc
 * saying otherwise.
 *
 * Delete this file once every route in router.tsx has a real page.
 */

const COLORS = [
  ['--bg', 'canvas'],
  ['--surface-raised', 'raised'],
  ['--border', 'ink'],
  ['--border-soft', 'ink soft'],
  ['--text-muted', 'muted'],
  ['--accent', 'accent'],
  ['--accent-alt', 'accent alt'],
  ['--neutral-fill', 'neutral'],
  ['--success', 'present'],
  ['--warning', 'absent'],
  ['--info', 'on leave'],
  ['--danger', 'danger'],
] as const

const ROUTES = [
  '/',
  '/signin',
  '/signup',
  '/dashboard',
  '/employees',
  '/profile',
  '/attendance',
  '/time-off',
  '/payslips',
]

export function Scaffold({ name }: { name: string }) {
  const [theme, setThemeState] = useState<Theme>(currentTheme)

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="t-label">Dayflow — scaffold</span>
        <button
          type="button"
          onClick={() => setThemeState(toggleTheme())}
          className="rounded-control border border-border px-5 py-2 t-caption font-medium hover:bg-neutral-fill"
        >
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </button>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-12">
        <p className="t-label text-text-muted">Route placeholder</p>
        <h1 className="t-display mt-4">{name}</h1>
        <p className="t-body-lg mt-6 max-w-[65ch] text-text-muted">
          Every workday, perfectly aligned. This page stands in for each route
          until its owner builds it. Claim yours in <code>docs/TASKS.md</code>,
          then swap the element in <code>src/router.tsx</code>.
        </p>

        <h2 className="t-h2 mt-16">Type scale</h2>
        <div className="mt-6 space-y-3 border-t border-border-soft pt-6">
          <p className="t-h1">Heading one — Instrument Serif</p>
          <p className="t-h2">Heading two — section and card titles</p>
          <p className="t-h3">Heading three — card titles and form labels</p>
          <p className="t-body">
            Body copy — Inter at 15px with the reference&rsquo;s wide tracking,
            so running text reads as typeset rather than typed.
          </p>
          <p className="t-caption text-text-muted">
            Caption — helper text, timestamps, and low-emphasis metadata.
          </p>
          <p className="t-label">Label — uppercase, tracked, weight 700</p>
          <p className="t-data">
            Data — OIJODO20220001 · ₹50,000.00 · 09:00–19:00 · 1.00 hrs
          </p>
          <p className="t-data">
            Data — OIRASH20240007 · ₹1,20,000.00 · 10:00–18:30 · 0.50 hrs
          </p>
        </div>

        <h2 className="t-h2 mt-16 font-heading">Tokens</h2>
        <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {COLORS.map(([token, label]) => (
            <div
              key={token}
              className="rounded-card border border-border p-5"
            >
              <div
                className="h-14 rounded-control border border-border"
                style={{ background: `var(${token})` }}
              />
              <p className="t-label mt-4">{label}</p>
              <p className="t-data mt-1 text-text-muted">{token}</p>
            </div>
          ))}
        </div>

        <h2 className="t-h2 mt-16">Presence</h2>
        <p className="t-caption mt-2 max-w-[65ch] text-text-muted">
          Present and on leave sit at almost the same relative luminance, so the
          glyph is what separates them in greyscale — not the colour. Check this
          in greyscale before ticking task 5.4a.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {/* Utility classes, not inline style — DESIGN.md forbids raw colour in
              a page, and these also prove the status utilities generate. */}
          {[
            ['bg-success', '●', 'In office'],
            ['bg-warning', '●', 'Absent'],
            ['bg-info', '✈', 'On leave'],
          ].map(([fill, glyph, label]) => (
            <span
              key={label}
              className={`${fill} inline-flex items-center gap-2 rounded-control border border-border px-3 py-1.5 t-label text-accent-ink`}
            >
              <span aria-hidden="true">{glyph}</span>
              {label}
            </span>
          ))}
        </div>

        <p className="t-caption mt-6 max-w-[65ch] text-text-muted">
          The swatch grid above reads each variable directly, because that is
          what it is testing. Everywhere else, use the utility —{' '}
          <code>bg-success</code>, <code>border-border</code>,{' '}
          <code>rounded-card</code> — never a raw <code>var()</code> or a hex.
        </p>

        <h2 className="t-h2 mt-16">Routes</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          {ROUTES.map((path) => (
            <Link
              key={path}
              to={path}
              className="rounded-control border border-border px-5 py-2 t-caption hover:bg-neutral-fill"
            >
              {path}
            </Link>
          ))}
        </div>
        <p className="t-caption mt-6 max-w-[65ch] text-text-muted">
          These prove the router locally, and nothing more: the Vite dev server
          serves <code>index.html</code> for any unmatched path, so a deep link
          works here whether or not the rewrite in <code>vercel.json</code> is
          applied. The rewrite is only ever tested by hard-refreshing a deep
          link on a deployed preview URL.
        </p>
      </main>
    </div>
  )
}
