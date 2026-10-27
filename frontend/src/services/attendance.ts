import { daysInMonth, isWeekend, today, workHours } from '@/lib/dates'
import type { AttendanceDay, AttendanceRow, AttendanceStatus, LeaveRequest } from '@/types/models'
import { ServiceError, api, query } from './client'

const isAttendanceStatus = (value: string): value is AttendanceStatus =>
  value === 'present' || value === 'half_day' || value === 'absent' || value === 'leave'

function attendanceStatus(value: string): AttendanceStatus {
  if (!isAttendanceStatus(value)) {
    throw new ServiceError('Attendance returned an unsupported status.')
  }
  return value
}

const toRow = (row: AttendanceRow): AttendanceRow => ({ ...row, status: attendanceStatus(row.status) })

export async function todayStatus() {
  const { row } = await api<{ row: AttendanceRow | null }>(
    'GET',
    '/attendance/today',
    undefined,
    'Could not load today\'s attendance.',
  )
  const today = row ? toRow(row) : null
  return {
    checkedIn: Boolean(today?.check_in && !today.check_out),
    row: today,
  }
}

/** One row per employee per day; the server derives identity and timestamps. */
export async function checkIn(): Promise<AttendanceRow> {
  return toRow(await api<AttendanceRow>('POST', '/attendance/check-in', undefined, 'Could not check you in.'))
}

export async function checkOut(): Promise<AttendanceRow> {
  return toRow(await api<AttendanceRow>('POST', '/attendance/check-out', undefined, 'Could not check you out.'))
}

/**
 * Reads the employee's stored rows and fills missing calendar days. Approved
 * leave explains a working-day gap; any other gap is an absence.
 */
export async function myAttendance(
  employeeId: string,
  month: string,
): Promise<AttendanceDay[]> {
  const calendar = daysInMonth(month)
  if (calendar.length === 0 || !/^\d{4}-\d{2}$/.test(month)) {
    throw new ServiceError('Choose a valid attendance month.')
  }

  const visibleDays = calendar.filter((date) => date <= today())
  if (visibleDays.length === 0) return []

  const firstDate = visibleDays[0]
  const lastDate = visibleDays[visibleDays.length - 1]
  const range = { employeeId, from: firstDate, to: lastDate }
  const [rows, leave, profile] = await Promise.all([
    api<AttendanceRow[]>('GET', `/attendance${query(range)}`, undefined, 'Could not load your attendance.'),
    api<LeaveRequest[]>(
      'GET',
      `/leave${query({ ...range, status: 'approved' })}`,
      undefined,
      'Could not load leave dates for attendance.',
    ),
    api<{ employee: { first_name: string; last_name: string; avatar_url: string | null } }>(
      'GET',
      `/employees/${encodeURIComponent(employeeId)}`,
      undefined,
      'Could not load your attendance profile.',
    ),
  ])

  const rowsByDate = new Map(rows.map((row) => [row.work_date, row]))
  const employeeName = `${profile.employee.first_name} ${profile.employee.last_name}`
  const avatarUrl = profile.employee.avatar_url

  return visibleDays
    .map((date): AttendanceDay => {
      const row = rowsByDate.get(date)
      if (row) {
        return {
          work_date: row.work_date,
          employee_id: row.employee_id,
          employee_name: employeeName,
          avatar_url: avatarUrl,
          check_in: row.check_in,
          check_out: row.check_out,
          status: attendanceStatus(row.status),
          work_hours: workHours(row.check_in, row.check_out),
        }
      }

      const onLeave = leave.some(
        (request) => request.start_date <= date && request.end_date >= date,
      )
      return {
        work_date: date,
        employee_id: employeeId,
        employee_name: employeeName,
        avatar_url: avatarUrl,
        check_in: null,
        check_out: null,
        status: onLeave ? 'leave' : 'absent',
        work_hours: null,
      }
    })
    .reverse()
}

/** Admin/HR-only company register, enforced by the server. */
export async function companyAttendance(
  date: string,
  opts: { search?: string } = {},
): Promise<AttendanceDay[]> {
  const rows = await api<AttendanceDay[]>(
    'GET',
    `/attendance/company${query({ date, search: opts.search?.trim() })}`,
    undefined,
    'Could not load company attendance.',
  )
  return rows.map((row) => ({ ...row, status: attendanceStatus(row.status) }))
}

export async function attendanceSummary(employeeId: string, month: string) {
  const days = await myAttendance(employeeId, month)
  const working = days.filter((day) => !isWeekend(day.work_date))
  return {
    present: working.filter((day) => day.status === 'present').length,
    absent: working.filter((day) => day.status === 'absent').length,
    halfDay: working.filter((day) => day.status === 'half_day').length,
    leave: working.filter((day) => day.status === 'leave').length,
  }
}
