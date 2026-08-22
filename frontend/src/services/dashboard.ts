import type {
  AttendanceRow,
  AttendanceStatus,
  DirectoryEmployee,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
} from '@/types/models'
import { ServiceError, supabaseClient, unwrap } from './client'

export type DashboardSummary = {
  attendance: { present: number; absent: number; halfDay: number; leave: number }
  balances: { paid: number; sick: number }
  today: { checkedIn: boolean; row: AttendanceRow | null }
  company: {
    headcount: number
    presentToday: number
    onLeaveToday: number
    pendingLeave: number
  } | null
  inOffice: DirectoryEmployee[]
  pendingRequests: LeaveRequest[]
  recentRequests: LeaveRequest[]
}

type JsonObject = Record<string, unknown>

const object = (value: unknown, label: string): JsonObject => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ServiceError(`The dashboard returned invalid ${label}.`)
  }
  return value as JsonObject
}

const number = (value: unknown, label: string): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) throw new ServiceError(`The dashboard returned invalid ${label}.`)
  return parsed
}

const string = (value: unknown, label: string): string => {
  if (typeof value !== 'string') throw new ServiceError(`The dashboard returned invalid ${label}.`)
  return value
}

const nullableString = (value: unknown): string | null => typeof value === 'string' ? value : null
const strings = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null

const attendanceStatus = (value: unknown): AttendanceStatus => {
  if (value === 'present' || value === 'absent' || value === 'half_day' || value === 'leave') {
    return value
  }
  throw new ServiceError('The dashboard returned an invalid attendance status.')
}

const leaveType = (value: unknown): LeaveType => {
  if (value === 'paid' || value === 'sick' || value === 'unpaid') return value
  throw new ServiceError('The dashboard returned an invalid leave type.')
}

const leaveStatus = (value: unknown): LeaveStatus => {
  if (value === 'pending' || value === 'approved' || value === 'rejected') return value
  throw new ServiceError('The dashboard returned an invalid leave status.')
}

function directoryEmployee(value: unknown): DirectoryEmployee {
  const row = object(value, 'directory employee')
  return {
    id: string(row.id, 'employee ID'),
    first_name: string(row.first_name, 'employee first name'),
    last_name: string(row.last_name, 'employee last name'),
    avatar_url: nullableString(row.avatar_url),
    job_position: nullableString(row.job_position),
    department: nullableString(row.department),
    location: nullableString(row.location),
    work_email: string(row.work_email, 'employee work email'),
    manager_id: nullableString(row.manager_id),
    about: nullableString(row.about),
    skills: strings(row.skills),
    presence: 'present',
  }
}

function leaveRequest(value: unknown): LeaveRequest {
  const row = object(value, 'leave request')
  return {
    id: string(row.id, 'request ID'),
    employee_id: string(row.employee_id, 'request employee'),
    employee_name: string(row.employee_name, 'request employee name'),
    avatar_url: nullableString(row.avatar_url),
    leave_type: leaveType(row.leave_type),
    start_date: string(row.start_date, 'request start date'),
    end_date: string(row.end_date, 'request end date'),
    days: number(row.days, 'request days'),
    remarks: nullableString(row.remarks),
    attachment_url: nullableString(row.attachment_url),
    status: leaveStatus(row.status),
    reviewed_by: nullableString(row.reviewed_by),
    review_comment: nullableString(row.review_comment),
    created_at: string(row.created_at, 'request creation time'),
  }
}

function attendanceRow(value: unknown): AttendanceRow | null {
  if (value === null) return null
  const row = object(value, 'today attendance')
  return {
    id: string(row.id, 'attendance ID'),
    employee_id: string(row.employee_id, 'attendance employee'),
    work_date: string(row.work_date, 'attendance date'),
    check_in: nullableString(row.check_in),
    check_out: nullableString(row.check_out),
    status: attendanceStatus(row.status),
    created_at: string(row.created_at, 'attendance creation time'),
  }
}

const array = <T>(value: unknown, label: string, map: (item: unknown) => T): T[] => {
  if (!Array.isArray(value)) throw new ServiceError(`The dashboard returned invalid ${label}.`)
  return value.map(map)
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data, error } = await supabaseClient().rpc('get_dashboard_summary')
  const root = object(unwrap({ data, error }, 'Could not load your dashboard.'), 'summary')
  const attendance = object(root.attendance, 'attendance summary')
  const balances = object(root.balances, 'leave balances')
  const today = object(root.today, 'today status')
  const company = root.company === null ? null : object(root.company, 'company summary')

  return {
    attendance: {
      present: number(attendance.present, 'present count'),
      absent: number(attendance.absent, 'absent count'),
      halfDay: number(attendance.half_day, 'half-day count'),
      leave: number(attendance.leave, 'leave count'),
    },
    balances: {
      paid: number(balances.paid, 'paid balance'),
      sick: number(balances.sick, 'sick balance'),
    },
    today: {
      checkedIn: today.checked_in === true,
      row: attendanceRow(today.row),
    },
    company: company ? {
      headcount: number(company.headcount, 'headcount'),
      presentToday: number(company.present_today, 'present-today count'),
      onLeaveToday: number(company.on_leave_today, 'on-leave count'),
      pendingLeave: number(company.pending_leave, 'pending-leave count'),
    } : null,
    inOffice: array(root.in_office, 'in-office list', directoryEmployee),
    pendingRequests: array(root.pending_requests, 'pending requests', leaveRequest),
    recentRequests: array(root.recent_requests, 'recent requests', leaveRequest),
  }
}
