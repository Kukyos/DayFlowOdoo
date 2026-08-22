import { workingDaysBetween } from '@/lib/dates'
import type { Tables } from '@/types/database'
import type { LeaveBalances, LeaveRequest, LeaveStatus, LeaveType } from '@/types/models'
import { ServiceError, supabaseClient, unwrap } from './client'

type RequestEmployee = {
  first_name: string
  last_name: string
  avatar_url: string | null
}

type RequestRow = Tables<'leave_requests'> & {
  employees: RequestEmployee | null
}

const isLeaveType = (value: string): value is LeaveType =>
  value === 'paid' || value === 'sick' || value === 'unpaid'

const isLeaveStatus = (value: string): value is LeaveStatus =>
  value === 'pending' || value === 'approved' || value === 'rejected'

function toLeaveRequest(row: RequestRow): LeaveRequest {
  if (!isLeaveType(row.leave_type) || !isLeaveStatus(row.status)) {
    throw new ServiceError('A leave request returned an unsupported type or status.')
  }
  return {
    id: row.id,
    employee_id: row.employee_id,
    employee_name: row.employees
      ? `${row.employees.first_name} ${row.employees.last_name}`
      : 'Unknown employee',
    avatar_url: row.employees?.avatar_url ?? null,
    leave_type: row.leave_type,
    start_date: row.start_date,
    end_date: row.end_date,
    days: row.days,
    remarks: row.remarks,
    attachment_url: row.attachment_url,
    status: row.status,
    reviewed_by: row.reviewed_by,
    review_comment: row.review_comment,
    created_at: row.created_at,
  }
}

const requestSelection = `
  *,
  employees!leave_requests_employee_id_fkey(first_name, last_name, avatar_url)
`

async function requestById(id: string): Promise<LeaveRequest> {
  const { data, error } = await supabaseClient()
    .from('leave_requests')
    .select(requestSelection)
    .eq('id', id)
    .single()
  const row = unwrap({ data, error }, 'Could not load that leave request.')
  return toLeaveRequest(row)
}

export async function myBalances(employeeId: string): Promise<LeaveBalances> {
  const { data, error } = await supabaseClient()
    .from('employees')
    .select('paid_leave_balance, sick_leave_balance')
    .eq('id', employeeId)
    .single()
  const employee = unwrap({ data, error }, 'Could not load your leave balances.')
  return { paid: employee.paid_leave_balance, sick: employee.sick_leave_balance }
}

export async function myRequests(employeeId: string): Promise<LeaveRequest[]> {
  const { data, error } = await supabaseClient()
    .from('leave_requests')
    .select(requestSelection)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
  const rows = unwrap({ data, error }, 'Could not load your leave requests.')
  return rows.map(toLeaveRequest)
}

export async function createRequest(input: {
  employeeId: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  remarks: string
  attachment_url: string | null
}): Promise<LeaveRequest> {
  if (input.end_date < input.start_date) {
    throw new ServiceError('The end date cannot be before the start date.')
  }
  if (workingDaysBetween(input.start_date, input.end_date) === 0) {
    throw new ServiceError('That range contains no working days.')
  }

  const { data, error } = await supabaseClient().rpc('create_leave_request', {
    p_leave_type: input.leave_type,
    p_start_date: input.start_date,
    p_end_date: input.end_date,
    p_remarks: input.remarks.trim() || undefined,
    p_attachment_url: input.attachment_url || undefined,
  })
  const created = unwrap({ data, error }, 'Could not submit that leave request.')
  return requestById(created.id)
}

export async function cancelRequest(id: string): Promise<void> {
  const { data, error } = await supabaseClient()
    .from('leave_requests')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) throw new ServiceError(error.message, error)
  if (!data) throw new ServiceError('Only your own pending request can be cancelled.')
}

export async function pendingRequests(): Promise<LeaveRequest[]> {
  return allRequests({ status: 'pending' })
}

export async function allRequests(
  opts: { search?: string; status?: LeaveStatus | 'all' } = {},
): Promise<LeaveRequest[]> {
  let query = supabaseClient()
    .from('leave_requests')
    .select(requestSelection)
    .order('created_at', { ascending: false })

  if (opts.status && opts.status !== 'all') query = query.eq('status', opts.status)

  const { data, error } = await query
  const requests = unwrap({ data, error }, 'Could not load company leave requests.')
    .map(toLeaveRequest)
  const search = opts.search?.trim().toLowerCase() ?? ''
  return search
    ? requests.filter((request) => request.employee_name.toLowerCase().includes(search))
    : requests
}

/** Reviewer identity and balance movement are derived and enforced by the RPC. */
export async function reviewRequest(
  id: string,
  status: Extract<LeaveStatus, 'approved' | 'rejected'>,
  _reviewerId: string,
  comment?: string,
): Promise<LeaveRequest> {
  const { data, error } = await supabaseClient().rpc('review_leave_request', {
    p_request_id: id,
    p_status: status,
    p_comment: comment?.trim() || undefined,
  })
  const reviewed = unwrap({ data, error }, 'Could not record that leave decision.')
  return requestById(reviewed.id)
}
