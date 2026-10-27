/**
 * Dayflow runs on an India workday. Every server-derived "today" uses the
 * Asia/Kolkata calendar date so it agrees with the browser's date.
 */
export const TIME_ZONE = 'Asia/Kolkata'

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** `YYYY-MM-DD` for the given instant in Asia/Kolkata. */
export const istDate = (instant: Date = new Date()): string => dateFormatter.format(instant)

export const todayIST = (): string => istDate()

export const nowISO = (): string => new Date().toISOString()

/** The UTC instant for a wall-clock time on an Asia/Kolkata calendar day. */
export const istInstant = (date: string, time: string): string =>
  new Date(`${date}T${time}:00+05:30`).toISOString()

export const isISODate = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`))

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

const isWeekday = (date: string): boolean => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day >= 1 && day <= 5
}

/** Inclusive Monday–Friday count, matching `lib/dates.ts` in the frontend. */
export function workingDaysBetween(start: string, end: string): number {
  let count = 0
  for (let day = start; day <= end; day = addDays(day, 1)) {
    if (isWeekday(day)) count += 1
  }
  return count
}

/** Weekdays from `start` to `end` inclusive. */
export function weekdaysBetween(start: string, end: string): string[] {
  const days: string[] = []
  for (let day = start; day <= end; day = addDays(day, 1)) {
    if (isWeekday(day)) days.push(day)
  }
  return days
}
