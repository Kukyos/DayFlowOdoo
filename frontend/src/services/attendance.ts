import { daysInMonth, isWeekend, today, workHours } from '@/lib/dates'
import type { AttendanceDay, AttendanceRow, AttendanceStatus } from '@/types/models'
import { ServiceError, clone, supabaseClient, unwrap } from './client'

const isAttendanceStatus = (value: string): value is AttendanceStatus =>
  value === 'present' || value === 'half_day' || value === 'absent' || value === 'leave'

function attendanceStatus(value: string): AttendanceStatus {
  if (!isAttendanceStatus(value)) {
    throw new ServiceError('Attendance returned an unsupported status.')
  }
  return value
}

export async function todayStatus() {
  const { data, error } = await supabaseClient()
    .from('attendance')
    .select('*')
    .eq('work_date', today())
    .maybeSingle()
  if (error) throw new ServiceError(error.message, error)
  const row = data
    ? ({ ...data, status: attendanceStatus(data.status) } satisfies AttendanceRow)
    : null
  return {
    checkedIn: Boolean(row?.check_in && !row.check_out),
    row: row ? clone(row) : null,
  }
}

/** One row per employee per day; the server derives identity and timestamps. */
export async function checkIn(): Promise<AttendanceRow> {
  const { data, error } = await supabaseClient().rpc('check_in')
  const row = unwrap({ data, error }, 'Could not check you in.')
  return { ...row, status: attendanceStatus(row.status) }
}

export async function checkOut(): Promise<AttendanceRow> {
  const { data, error } = await supabaseClient().rpc('check_out')
  const row = unwrap({ data, error }, 'Could not check you out.')
  return { ...row, status: attendanceStatus(row.status) }
}

/**
 * Reads the caller's RLS-visible rows and fills missing calendar days. Approved
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
  const client = supabaseClient()
  const [attendanceResult, leaveResult, employeeResult] = await Promise.all([
    client
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('work_date', firstDate)
      .lte('work_date', lastDate),
    client
      .from('leave_requests')
      .select('start_date, end_date')
      .eq('employee_id', employeeId)
      .eq('status', 'approved')
      .lte('start_date', lastDate)
      .gte('end_date', firstDate),
    client
      .from('employees')
      .select('first_name, last_name, avatar_url')
      .eq('id', employeeId)
      .maybeSingle(),
  ])

  if (attendanceResult.error) {
    throw new ServiceError('Could not load your attendance.', attendanceResult.error)
  }
  if (leaveResult.error) {
    throw new ServiceError('Could not load leave dates for attendance.', leaveResult.error)
  }
  if (employeeResult.error) {
    throw new ServiceError('Could not load your attendance profile.', employeeResult.error)
  }

  const rowsByDate = new Map(attendanceResult.data.map((row) => [row.work_date, row]))
  const employeeName = employeeResult.data
    ? `${employeeResult.data.first_name} ${employeeResult.data.last_name}`
    : 'You'
  const avatarUrl = employeeResult.data?.avatar_url ?? null

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

      const onLeave = leaveResult.data.some(
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

/** Admin/HR-only company register, enforced by the guarded database RPC. */
export async function companyAttendance(
  date: string,
  opts: { search?: string } = {},
): Promise<AttendanceDay[]> {
  const { data, error } = await supabaseClient().rpc('list_company_attendance', {
    p_work_date: date,
    p_search: opts.search?.trim() || undefined,
  })
  const rows = unwrap({ data, error }, 'Could not load company attendance.')
  return rows.map((row) => ({
    work_date: row.work_date,
    employee_id: row.employee_id,
    employee_name: row.employee_name,
    avatar_url: row.avatar_url,
    check_in: row.check_in,
    check_out: row.check_out,
    status: attendanceStatus(row.status),
    work_hours: row.work_hours,
  }))
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
