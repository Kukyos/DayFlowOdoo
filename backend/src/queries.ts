/**
 * SQL fragments shared by more than one route, so presence and leave rows are
 * derived the same way everywhere they appear.
 */
import { all, one } from './db.ts'
import type { Params } from './db.ts'

/**
 * Presence is derived, never stored: checked in on `day` → present; otherwise
 * approved leave covering `day` → leave; otherwise absent. Binds `day` twice.
 */
export const presenceSql = (employeeAlias: string) => `
  case
    when exists (
      select 1 from attendance
      where attendance.employee_id = ${employeeAlias}.id
        and attendance.work_date = ?
        and attendance.check_in is not null
    ) then 'present'
    when exists (
      select 1 from leave_requests
      where leave_requests.employee_id = ${employeeAlias}.id
        and leave_requests.status = 'approved'
        and ? between leave_requests.start_date and leave_requests.end_date
    ) then 'leave'
    else 'absent'
  end`

/** A leave request with the requester's display name, as the frontend's `LeaveRequest`. */
const leaveSelect = `
  select
    leave_requests.*,
    employees.first_name || ' ' || employees.last_name as employee_name,
    employees.avatar_url
  from leave_requests
  join employees on employees.id = leave_requests.employee_id`

export const leaveRequests = (where: string, params: Params, suffix = '') =>
  all(`${leaveSelect} where ${where} order by leave_requests.created_at desc ${suffix}`, ...params)

export const leaveRequest = (id: string) => one(`${leaveSelect} where leave_requests.id = ?`, id)
