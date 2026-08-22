/**
 * Shared primitives. Integrator's lane — if one is missing, ask rather than
 * styling in place.
 *
 * Everything here obeys docs/DESIGN.md:
 *  - structure is a 1px ink hairline; cards never carry a shadow
 *  - there is no accent-filled button (§2.4) — lime and cornflower are the
 *    presence colours, and a lime button makes a lime "absent" chip meaningless
 *  - colour comes from tokens as utilities, never a raw hex or inline style
 *  - focus thickens or rings visibly in both themes
 */
import { useEffect, useRef } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import type { AttendanceStatus, LeaveStatus, Presence } from '@/types/models'
import { ATTENDANCE_LABEL, PRESENCE_LABEL } from '@/types/models'

export const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ')

/* ── Button ───────────────────────────────────────────────────────────────── */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'strong' | 'inverted' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
}

/**
 * Emphasis comes from border weight or an ink fill — never from an accent fill.
 *
 * `inverted` is solid ink with canvas-coloured text, which is what the
 * reference's "Sign up" control is. That is not a §2.4 violation: ink is not an
 * accent, and it cannot be confused with a presence colour.
 */
export function Button({
  variant = 'default',
  size = 'md',
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-control t-caption font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'px-3 py-1.5' : 'px-5 py-2.5',
        variant === 'ghost' &&
          'border border-transparent underline-offset-4 hover:underline',
        variant === 'default' && 'border border-border hover:bg-neutral-fill',
        variant === 'strong' && 'border-2 border-border font-bold hover:bg-neutral-fill',
        variant === 'inverted' &&
          'border border-border bg-text text-bg hover:opacity-85',
        variant === 'danger' &&
          'border border-danger-ink text-danger-ink hover:bg-neutral-fill',
        className,
      )}
    />
  )
}

/* ── Card ─────────────────────────────────────────────────────────────────── */

export function Card({
  className,
  children,
  as: As = 'div',
}: {
  className?: string
  children: ReactNode
  as?: 'div' | 'section' | 'article' | 'li'
}) {
  return (
    <As className={cx('rounded-card border border-border bg-surface p-5', className)}>
      {children}
    </As>
  )
}

/* ── Form fields ──────────────────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string
  hint?: string
  error?: string | null
  htmlFor: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="t-label">
        {label}
      </label>
      {children}
      {error ? (
        <p className="t-caption text-danger-ink" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="t-caption text-text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

/**
 * Focus thickens the border to 2px rather than adding a coloured ring, per
 * DESIGN.md. The rest border is 2px and transparent-inset so the thickening
 * does not shift layout by a pixel.
 */
const fieldBase =
  'w-full rounded-control border border-border bg-surface px-3 py-2.5 t-body text-text ' +
  'placeholder:text-text-muted outline-none focus:border-2 focus:px-[11px] focus:py-[9px] ' +
  'disabled:opacity-50 aria-[invalid=true]:border-danger-ink'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(fieldBase, className)} />
}

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(fieldBase, 'min-h-24 resize-y', className)} />
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...rest} className={cx(fieldBase, 'cursor-pointer', className)} />
}

/* ── Avatar ───────────────────────────────────────────────────────────────── */

/**
 * Initials rather than a photo service. Keeps the app working offline, avoids
 * a third-party request on every card, and an inked monogram suits the
 * editorial register better than a stock headshot would.
 */
export function Avatar({
  name,
  src,
  size = 40,
  className,
}: {
  name: string
  src?: string | null
  size?: number
  className?: string
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
      className={cx(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        'border border-border bg-neutral-fill font-bold tracking-wider text-text',
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  )
}

/* ── Status chips ─────────────────────────────────────────────────────────── */

/**
 * Presence carries a glyph as well as a colour. Spring green (present) and
 * cornflower (on leave) sit at almost the same relative luminance, so in
 * greyscale — or for a colourblind viewer — the glyph is the only thing that
 * separates them. It is not decoration.
 */
const PRESENCE_STYLE: Record<Presence, { fill: string; glyph: string }> = {
  present: { fill: 'bg-success', glyph: '●' },
  leave: { fill: 'bg-info', glyph: '✈' },
  absent: { fill: 'bg-warning', glyph: '○' },
}

export function PresenceChip({
  presence,
  className,
}: {
  presence: Presence
  className?: string
}) {
  const { fill, glyph } = PRESENCE_STYLE[presence]
  return (
    <span
      className={cx(
        fill,
        'inline-flex items-center gap-1.5 rounded-control border border-border px-2 py-1 t-label text-accent-ink',
        className,
      )}
    >
      <span aria-hidden="true">{glyph}</span>
      {PRESENCE_LABEL[presence]}
    </span>
  )
}

/** Compact dot for a card corner, with the label kept for screen readers. */
export function PresenceDot({ presence }: { presence: Presence }) {
  const { fill, glyph } = PRESENCE_STYLE[presence]
  return (
    <span
      title={PRESENCE_LABEL[presence]}
      className={cx(
        fill,
        'inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-[11px] text-accent-ink',
      )}
    >
      <span aria-hidden="true">{glyph}</span>
      <span className="sr-only">{PRESENCE_LABEL[presence]}</span>
    </span>
  )
}

const LEAVE_STATUS_STYLE: Record<LeaveStatus, string> = {
  pending: 'bg-surface',
  approved: 'bg-success text-accent-ink',
  rejected: 'bg-danger text-accent-ink',
}

export function StatusChip({ status }: { status: LeaveStatus }) {
  return (
    <span
      className={cx(
        LEAVE_STATUS_STYLE[status],
        'inline-flex items-center rounded-control border border-border px-2 py-1 t-label',
      )}
    >
      {status}
    </span>
  )
}

const ATTENDANCE_STYLE: Record<AttendanceStatus, string> = {
  present: 'bg-success text-accent-ink',
  half_day: 'bg-warning text-accent-ink',
  leave: 'bg-info text-accent-ink',
  absent: 'bg-surface text-text-muted',
}

export function AttendanceChip({ status }: { status: AttendanceStatus }) {
  return (
    <span
      className={cx(
        ATTENDANCE_STYLE[status],
        'inline-flex items-center rounded-control border border-border px-2 py-0.5 t-label',
      )}
    >
      {ATTENDANCE_LABEL[status]}
    </span>
  )
}

/* ── States ───────────────────────────────────────────────────────────────── */

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-text-muted">
      {/* Respects prefers-reduced-motion via the global rule in index.css. */}
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-border-soft border-t-text"
      />
      <span className="t-caption">{label}…</span>
    </div>
  )
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border-soft px-6 py-16 text-center">
      <p className="t-h3">{title}</p>
      <p className="t-caption max-w-[46ch] text-text-muted">{body}</p>
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-card border border-danger-ink px-6 py-12 text-center"
    >
      <p className="t-h3 text-danger-ink">Something went wrong</p>
      <p className="t-caption max-w-[46ch] text-text-muted">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} size="sm">
          Try again
        </Button>
      )}
    </div>
  )
}

/* ── Modal ────────────────────────────────────────────────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Move focus in, so the dialog is reachable by keyboard at all.
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        className="w-full max-w-xl rounded-card border border-border bg-surface-raised outline-none"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="t-h3">{title}</h2>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: string; label: string }>
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={t.id === active}
          onClick={() => onChange(t.id)}
          className={cx(
            'shrink-0 border-b-2 px-4 py-3 t-caption font-medium transition-colors',
            t.id === active
              ? 'border-text text-text'
              : 'border-transparent text-text-muted hover:text-text',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/* ── Table ────────────────────────────────────────────────────────────────── */

export function Table({
  head,
  children,
}: {
  head: ReactNode
  children: ReactNode
}) {
  // Wide tables scroll inside their own container; the page body never does.
  return (
    <div className="overflow-x-auto rounded-card border border-border">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead className="border-b border-border">{head}</thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export const Th = ({ children, right }: { children: ReactNode; right?: boolean }) => (
  <th className={cx('px-4 py-3 t-label text-text-muted', right && 'text-right')}>
    {children}
  </th>
)

export const Td = ({
  children,
  right,
  data,
}: {
  children: ReactNode
  right?: boolean
  data?: boolean
}) => (
  <td
    className={cx(
      'border-t border-border-soft px-4 py-3',
      data ? 't-data' : 't-caption',
      right && 'text-right',
    )}
  >
    {children}
  </td>
)

/* ── Page furniture ───────────────────────────────────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="t-h1">{title}</h1>
        {subtitle && <p className="t-caption mt-2 text-text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <p className="t-label text-text-muted">{label}</p>
      <p className="t-data mt-2 text-3xl">{value}</p>
      {hint && <p className="t-caption mt-1 text-text-muted">{hint}</p>}
    </Card>
  )
}
