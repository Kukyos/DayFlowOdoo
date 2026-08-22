/**
 * Application-facing model types.
 *
 * Live table rows come from the generated `types/database.ts`. The remaining
 * view/derived types stay hand-written until their migrations exist.
 */

import type { Tables } from './database'

export type Role = 'admin' | 'hr' | 'employee'
export type Presence = 'present' | 'leave' | 'absent'
export type AttendanceStatus = 'present' | 'half_day' | 'absent' | 'leave'
export type LeaveType = 'paid' | 'sick' | 'unpaid'
export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export const isPrivileged = (role: Role | undefined | null): boolean =>
  role === 'admin' || role === 'hr'

export type Company = Tables<'companies'>

/**
 * The caller's own row, or an employee row an admin may read in full.
 *
 * The nullable-in-practice fields are typed `| null` because RLS returns them
 * as null for a coworker. A page must handle null rather than assume a value —
 * see `DirectoryEmployee` for the shape a coworker actually gets.
 */
type EmployeeRow = Tables<'employees'>

export type Employee = Omit<
  EmployeeRow,
  'role'
> & {
  role: Role
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
