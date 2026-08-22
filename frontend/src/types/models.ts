/**
 * Hand-written model types for the fixture phase.
 *
 * These mirror docs/SCHEMA.md exactly. They are **temporary**: once Praneet
 * runs `npx supabase gen types typescript`, `types/database.ts` becomes the
 * source and these get replaced by aliases onto its Row types. Keeping the
 * shapes identical now is what makes that a rename rather than a rewrite.
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
  login_prefix: string | null
  logo_url: string | null
  created_at: string
}

/**
 * The caller's own row, or an employee row an admin may read in full.
 *
 * The nullable-in-practice fields are typed `| null` because RLS returns them
 * as null for a coworker. A page must handle null rather than assume a value —
 * see `DirectoryEmployee` for the shape a coworker actually gets.
 */
export type Employee = {
  id: string
  company_id: string
  login_id: string | null
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

  // Private Info — null unless the caller is the employee or is privileged.
  date_of_birth: string | null
  address: string | null
  bank_account_number: string | null
  ifsc_code: string | null
  pan_no: string | null
  uan_no: string | null

  // Salary — null unless privileged. The employee does NOT see their own wage;
  // docs/SCHEMA.md keeps the Salary Info tab admin-only.
  monthly_wage: number | null

  paid_leave_balance: number | null
  sick_leave_balance: number | null
  is_active: boolean
  created_at: string
}

/**
 * What `employee_directory` exposes. Deliberately missing every private,
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

/**
 * docs/SCHEMA.md: prefix + first two letters of each name + joining year +
 * a four-digit serial. Display only — sign-in is email and password.
 */
export function buildLoginId(
  prefix: string,
  firstName: string,
  lastName: string,
  joiningYear: number,
  serial: number,
): string {
  const part = (s: string) =>
    (s.replace(/[^a-zA-Z]/g, '').toUpperCase() + 'XX').slice(0, 2)
  return `${prefix.toUpperCase()}${part(firstName)}${part(lastName)}${joiningYear}${`${serial}`.padStart(4, '0')}`
}
