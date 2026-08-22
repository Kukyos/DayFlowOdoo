import { useMemo, useState } from 'react'
import { Button, Card, cx } from '@/components/ui'
import { daysInMonth, formatDate, isWeekend, today } from '@/lib/dates'
import { holidaysForYear } from '@/lib/holidays'
import { LEAVE_TYPE_LABEL } from '@/types/models'
import type { LeaveRequest, LeaveStatus } from '@/types/models'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// A map entry only ever exists once a request actually covers that day, so
// its fields are never independently null — the type says so directly rather
// than allowing a combination (e.g. status set, leaveType null) that never
// happens in practice.
type DayInfo = {
  status: LeaveStatus
  leaveType: LeaveRequest['leave_type']
  requestId: string
}

/**
 * Full-year time-off calendar — twelve month grids, a legend, and the public
 * holiday list, matching the reference wireframe. This is the primary view
 * for an employee's own time off; the request table (List view, in
 * TimeOff.tsx) stays alongside it for remarks, attachments, and cancelling —
 * things a coloured square can't show.
 *
 * Colour precedence per day, when requests overlap (a resubmission after a
 * rejection, say): approved beats pending beats rejected — the calendar shows
 * where things actually stand, not every historical attempt.
 */
export function YearCalendar({
  requests,
  initialYear,
}: {
  requests: LeaveRequest[]
  initialYear?: number
}) {
  const [year, setYear] = useState(initialYear ?? Number(today().slice(0, 4)))
  const todayIso = today()

  // One pass over the requests, expanded into a day -> status map for this
  // year only. Cheap even for a year of daily rows, and it means each month
  // grid below just does a lookup instead of scanning every request per cell.
  const dayInfo = useMemo(() => {
    const map = new Map<string, DayInfo>()
    const rank: Record<LeaveStatus, number> = { approved: 3, pending: 2, rejected: 1 }
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    for (const r of requests) {
      if (r.end_date < yearStart || r.start_date > yearEnd) continue
      for (let d = r.start_date; d <= r.end_date && d <= yearEnd; d = stepDay(d)) {
        if (d < yearStart) continue
        const existing = map.get(d)
        if (!existing || rank[r.status] > rank[existing.status as LeaveStatus]) {
          map.set(d, { status: r.status, leaveType: r.leave_type, requestId: r.id })
        }
      }
    }
    return map
  }, [requests, year])

  const holidays = holidaysForYear(year)
  const holidayByDate = useMemo(
    () => new Map(holidays.map((h) => [h.date, h.name])),
    [holidays],
  )

  return (
    <Card>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => setYear((y) => y - 1)} aria-label="Previous year">
            ←
          </Button>
          <span className="t-h3 min-w-[80px] text-center">{year}</span>
          <Button size="sm" onClick={() => setYear((y) => y + 1)} aria-label="Next year">
            →
          </Button>
        </div>
        <Legend />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {MONTH_NAMES.map((name, i) => (
            <MonthGrid
              key={name}
              year={year}
              monthIndex={i}
              monthName={name}
              dayInfo={dayInfo}
              holidayByDate={holidayByDate}
              todayIso={todayIso}
            />
          ))}
        </div>

        <div className="border-t border-border-soft pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <h3 className="t-label mb-3 text-text-muted">Public Holidays</h3>
          {holidays.length === 0 ? (
            <p className="t-caption text-text-muted">No holidays listed for {year}.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {holidays.map((h) => (
                <li key={h.date} className="flex items-baseline justify-between gap-3">
                  <span className="t-caption text-text-muted">{h.name}</span>
                  <span className="t-data shrink-0 text-text-muted">{formatDate(h.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  )
}

const stepDay = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const next = new Date(y, m - 1, d + 1)
  return `${next.getFullYear()}-${`${next.getMonth() + 1}`.padStart(2, '0')}-${`${next.getDate()}`.padStart(2, '0')}`
}

const STATUS_FILL: Record<LeaveStatus, string> = {
  approved: 'bg-success text-accent-ink',
  pending: 'bg-info text-accent-ink',
  rejected: 'bg-danger text-accent-ink',
}

function Legend() {
  const items: Array<{ status: LeaveStatus; label: string }> = [
    { status: 'approved', label: 'Approved' },
    { status: 'pending', label: 'To Approve' },
    { status: 'rejected', label: 'Refused' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-3">
      {items.map((it) => (
        <span key={it.status} className="flex items-center gap-1.5 t-label text-text-muted">
          <span className={cx('h-3 w-3 rounded-[3px] border border-border', STATUS_FILL[it.status])} />
          {it.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5 t-label text-text-muted">
        <span className="h-3 w-3 rounded-[3px] border border-border-soft bg-neutral-fill" />
        Holiday
      </span>
    </div>
  )
}

function MonthGrid({
  year,
  monthIndex,
  monthName,
  dayInfo,
  holidayByDate,
  todayIso,
}: {
  year: number
  monthIndex: number
  monthName: string
  dayInfo: Map<string, DayInfo>
  holidayByDate: Map<string, string>
  todayIso: string
}) {
  const monthKeyStr = `${year}-${`${monthIndex + 1}`.padStart(2, '0')}`
  const days = daysInMonth(monthKeyStr)
  // getDay() of the 1st tells us how many leading blanks the grid needs so
  // the 1st lands under its real weekday column.
  const firstWeekday = new Date(year, monthIndex, 1).getDay()

  return (
    <div>
      <p className="t-label mb-2 text-text-muted">{monthName}</p>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAY_LETTERS.map((w, i) => (
          <span key={`${w}-${i}`} className="t-label text-text-muted">
            {w}
          </span>
        ))}

        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}

        {days.map((iso) => {
          const info = dayInfo.get(iso)
          const holidayName = holidayByDate.get(iso)
          const isToday = iso === todayIso
          const dayNum = Number(iso.slice(-2))

          const title = [
            holidayName,
            info?.leaveType ? `${LEAVE_TYPE_LABEL[info.leaveType]} — ${info.status}` : null,
          ]
            .filter(Boolean)
            .join(' · ')

          return (
            <span
              key={iso}
              title={title || undefined}
              className={cx(
                't-data flex h-6 w-6 items-center justify-center justify-self-center rounded-[4px]',
                info ? STATUS_FILL[info.status] : holidayName ? 'bg-neutral-fill' : undefined,
                !info && !holidayName && isWeekend(iso) && 'text-text-muted',
                isToday && 'ring-2 ring-text ring-offset-1 ring-offset-surface',
              )}
            >
              {dayNum}
            </span>
          )
        })}
      </div>
    </div>
  )
}
