/** Milestone 4 wires today's action; the history views remain fixture-backed until Milestone 5. */
import * as fx from '@/fixtures'
import { daysInMonth, isWeekend, monthKey, today, workHours } from '@/lib/dates'
import type { AttendanceDay, AttendanceRow } from '@/types/models'
import { clone, latency, ServiceError, supabaseClient, unwrap } from './client'

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

export async function todayStatus() {
  const { data, error } = await supabaseClient()
    .from('attendance')
    .select('*')
    .eq('work_date', today())
    .maybeSingle()
  if (error) throw new ServiceError(error.message, error)
  const row = data as AttendanceRow | null
  return {
    checkedIn: Boolean(row?.check_in && !row.check_out),
    row: row ? clone(row) : null,
  }
}

/**
 * One row per employee per day — the unique constraint in docs/SCHEMA.md.
 * A second check-in is an error, not a second row.
 */
export async function checkIn(): Promise<AttendanceRow> {
  const { data, error } = await supabaseClient().rpc('check_in')
  return unwrap({ data, error }, 'Could not check you in.') as AttendanceRow
}

export async function checkOut(): Promise<AttendanceRow> {
  const { data, error } = await supabaseClient().rpc('check_out')
  return unwrap({ data, error }, 'Could not check you out.') as AttendanceRow
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
