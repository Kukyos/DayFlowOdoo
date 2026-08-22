/** STUB — fixture-backed. Signatures from docs/SERVICES.md. */
import * as fx from '@/fixtures'
import { daysInMonth, isWeekend, monthKey, today, workHours } from '@/lib/dates'
import type { AttendanceDay, AttendanceRow } from '@/types/models'
import { clone, latency, ServiceError } from './client'

const name = (id: string) => {
  const e = fx.byId(id)
  return e ? `${e.first_name} ${e.last_name}` : 'Unknown'
}

const toDay = (r: AttendanceRow): AttendanceDay => ({
  work_date: r.work_date,
  employee_id: r.employee_id,
  employee_name: name(r.employee_id),
  avatar_url: fx.byId(r.employee_id)?.avatar_url ?? null,
  check_in: r.check_in,
  check_out: r.check_out,
  status: r.status,
  work_hours: workHours(r.check_in, r.check_out),
})

export async function todayStatus(employeeId: string) {
  await latency(140)
  const row = fx.attendance.find(
    (a) => a.employee_id === employeeId && a.work_date === today(),
  )
  return {
    checkedIn: Boolean(row?.check_in && !row.check_out),
    row: row ? clone(row) : null,
  }
}

/**
 * One row per employee per day — the unique constraint in docs/SCHEMA.md.
 * A second check-in is an error, not a second row.
 */
export async function checkIn(employeeId: string): Promise<AttendanceRow> {
  await latency()
  const day = today()
  const existing = fx.attendance.find(
    (a) => a.employee_id === employeeId && a.work_date === day,
  )
  if (existing?.check_in) throw new ServiceError('You have already checked in today.')

  if (existing) {
    existing.check_in = new Date().toISOString()
    existing.status = 'present'
    fx.presenceById[employeeId] = 'present'
    return clone(existing)
  }
  const row: AttendanceRow = {
    id: `a-${employeeId}-${day}`,
    employee_id: employeeId,
    work_date: day,
    check_in: new Date().toISOString(),
    check_out: null,
    status: 'present',
    created_at: new Date().toISOString(),
  }
  fx.attendance.push(row)
  fx.presenceById[employeeId] = 'present'
  return clone(row)
}

export async function checkOut(employeeId: string): Promise<AttendanceRow> {
  await latency()
  const row = fx.attendance.find(
    (a) => a.employee_id === employeeId && a.work_date === today(),
  )
  if (!row?.check_in) throw new ServiceError('You have not checked in today.')
  if (row.check_out) throw new ServiceError('You have already checked out today.')
  row.check_out = new Date().toISOString()
  return clone(row)
}

/**
 * Every calendar day of the month up to today, not just the days that have
 * rows. A gap on a working day is an absence and has to be visible; without
 * filling the gaps the table silently hides them.
 */
export async function myAttendance(
  employeeId: string,
  month: string,
): Promise<AttendanceDay[]> {
  await latency()
  const rows = fx.attendance.filter(
    (a) => a.employee_id === employeeId && monthKey(a.work_date) === month,
  )
  const now = today()
  return daysInMonth(month)
    .filter((d) => d <= now)
    .map((d) => {
      const row = rows.find((r) => r.work_date === d)
      if (row) return toDay(row)
      // No row. Approved leave explains the gap; anything else is an absence.
      return {
        work_date: d,
        employee_id: employeeId,
        employee_name: name(employeeId),
        avatar_url: null,
        check_in: null,
        check_out: null,
        status: fx.onApprovedLeave(employeeId, d) ? ('leave' as const) : ('absent' as const),
        work_hours: null,
      }
    })
    .reverse()
}

/** Admin/HR: every employee for one day. */
export async function companyAttendance(
  date: string,
  opts: { search?: string } = {},
): Promise<AttendanceDay[]> {
  await latency()
  const q = opts.search?.trim().toLowerCase() ?? ''
  return fx.employees
    .filter((e) => e.is_active)
    .filter((e) => !q || `${e.first_name} ${e.last_name}`.toLowerCase().includes(q))
    .map((e) => {
      const row = fx.attendance.find(
        (a) => a.employee_id === e.id && a.work_date === date,
      )
      if (row) return toDay(row)
      return {
        work_date: date,
        employee_id: e.id,
        employee_name: `${e.first_name} ${e.last_name}`,
        avatar_url: e.avatar_url,
        check_in: null,
        check_out: null,
        status: fx.onApprovedLeave(e.id, date) ? ('leave' as const) : ('absent' as const),
        work_hours: null,
      }
    })
}

export async function attendanceSummary(employeeId: string, month: string) {
  const days = await myAttendance(employeeId, month)
  const working = days.filter((d) => !isWeekend(d.work_date))
  return {
    present: working.filter((d) => d.status === 'present').length,
    absent: working.filter((d) => d.status === 'absent').length,
    halfDay: working.filter((d) => d.status === 'half_day').length,
    leave: working.filter((d) => d.status === 'leave').length,
  }
}
