/**
 * Date helpers. Pure, no I/O.
 *
 * Dates cross the service boundary as `YYYY-MM-DD` strings (docs/SERVICES.md),
 * so everything here speaks that and never hands a `Date` across a layer.
 *
 * `new Date('2026-08-22')` parses as UTC midnight, which in a positive timezone
 * is still the 21st locally — the classic off-by-one that makes a leave request
 * span the wrong days. Everything below builds dates from parts instead.
 */

export const WEEKEND = [0, 6] // Sunday, Saturday

export function toISO(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const today = (): string => toISO(new Date())

/** `2026-08` for the month picker. */
export const monthKey = (iso: string): string => iso.slice(0, 7)

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}`
}

/** Every calendar day in `YYYY-MM`, oldest first. */
export function daysInMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number)
  const count = new Date(y, m, 0).getDate()
  return Array.from({ length: count }, (_, i) => `${month}-${`${i + 1}`.padStart(2, '0')}`)
}

export const isWeekend = (iso: string): boolean => WEEKEND.includes(fromISO(iso).getDay())

/**
 * Inclusive of both ends, weekends excluded.
 *
 * Used by the leave request form and the attendance summary. Both must agree,
 * or a request says three days while the register counts two.
 */
export function workingDaysBetween(startISO: string, endISO: string): number {
  if (fromISO(endISO) < fromISO(startISO)) return 0
  let count = 0
  for (let d = startISO; fromISO(d) <= fromISO(endISO); d = addDays(d, 1)) {
    if (!isWeekend(d)) count += 1
  }
  return count
}

export const workingDaysInMonth = (month: string): number =>
  daysInMonth(month).filter((d) => !isWeekend(d)).length

/** `22 Oct 2026` */
export function formatDate(iso: string): string {
  return fromISO(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** `October 2026` */
export function formatMonth(month: string): string {
  return fromISO(`${month}-01`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })
}

/** `Thu` */
export const weekdayName = (iso: string): string =>
  fromISO(iso).toLocaleDateString('en-IN', { weekday: 'short' })

/** `09:00` from a timestamp, or an em dash when there isn't one. */
export function formatTime(ts: string | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * Worked hours between two timestamps, as a decimal. Null while someone is
 * still checked in — an open row has no duration yet, and rendering 0.00 for it
 * reads as "worked nothing" rather than "still here".
 */
export function workHours(checkIn: string | null, checkOut: string | null): number | null {
  if (!checkIn || !checkOut) return null
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return null
  return Math.round((ms / 3_600_000) * 100) / 100
}

export const formatHours = (h: number | null): string => (h === null ? '—' : h.toFixed(2))
