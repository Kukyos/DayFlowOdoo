/**
 * Application-facing model types.
 *
 * The row types mirror `backend/src/schema.sql` as the API serialises it:
 * booleans are booleans and array columns are arrays. Keep them in step with
 * the schema when a column changes.
 */

export type Role = 'admin' | 'hr' | 'employee'
export type Presence = 'present' | 'leave' | 'absent'
export type AttendanceStatus = 'present' | 'half_day' | 'absent' | 'leave'
export type LeaveType = 'paid' | 'sick' | 'unpaid'
export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export const isPrivileged = (role: Role | undefined | null): boolean =>
  role === 'admin' || role === 'hr'

export type Company = {
  id: string
  name: string
  logo_url: string | null
  time_off_types: string[]
  working_days: number[]
  workday_start: string
  workday_end: string
  created_at: string
}

export type Notification = {
  id: string
  employee_id: string
  type: string
  title: string
  message: string
  leave_request_id: string | null
  read_at: string | null
  created_at: string
}

/**
 * The caller's own row, or an employee row an admin may read in full. A
 * coworker never receives this shape — see `DirectoryEmployee` for what the
 * API returns instead.
 */
export type Employee = {
  id: string
  company_id: string
  role: Role
  first_name: string
  last_name: string
  work_email: string
  mobile: string | null
  job_position: string | null
  department: string | null
  location: string | null
  manager_id: string | null
  date_of_joining: string | null
  avatar_url: string | null
  about: string | null
  skills: string[] | null
  date_of_birth: string | null
  address: string | null
  bank_account_number: string | null
  ifsc_code: string | null
  pan_no: string | null
  uan_no: string | null
  monthly_wage: number | null
  paid_leave_balance: number
  sick_leave_balance: number
  is_active: boolean
  must_change_password: boolean
  created_at: string
}

/**
 * What `list_employee_directory()` exposes. Deliberately missing every private,
 * salary and balance column — if a field is not on this type, a coworker
 * cannot see it, and the page cannot accidentally render it.
 */
export type DirectoryEmployee = {
  id: string
  first_name: string
  last_name: string
  avatar_url: string | null
  job_position: string | null
  department: string | null
  location: string | null
  work_email: string
  manager_id: string | null
  about: string | null
  skills: string[] | null
  presence: Presence
}

export type EmployeeProfile = {
  employee: Employee | DirectoryEmployee
  presence: Presence
}

export const isFullEmployee = (employee: Employee | DirectoryEmployee): employee is Employee =>
  'monthly_wage' in employee

export type AttendanceRow = {
  id: string
  employee_id: string
  work_date: string
  check_in: string | null
  check_out: string | null
  status: AttendanceStatus
  created_at: string
}

/** One calendar day for the attendance table, gaps included. */
export type AttendanceDay = {
  work_date: string
  employee_id: string
  employee_name: string
  avatar_url: string | null
  check_in: string | null
  check_out: string | null
  status: AttendanceStatus
  work_hours: number | null
}

export type LeaveRequest = {
  id: string
  employee_id: string
  employee_name: string
  avatar_url: string | null
  leave_type: LeaveType
  start_date: string
  end_date: string
  days: number
  remarks: string | null
  attachment_url: string | null
  status: LeaveStatus
  reviewed_by: string | null
  review_comment: string | null
  created_at: string
}

export type LeaveBalances = { paid: number; sick: number }

export const fullName = (e: { first_name: string; last_name: string }): string =>
  `${e.first_name} ${e.last_name}`

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  paid: 'Paid Time Off',
  sick: 'Sick Leave',
  unpaid: 'Unpaid Leave',
}

export const PRESENCE_LABEL: Record<Presence, string> = {
  present: 'In office',
  leave: 'On leave',
  absent: 'Absent',
}

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  half_day: 'Half day',
  absent: 'Absent',
  leave: 'Leave',
}
