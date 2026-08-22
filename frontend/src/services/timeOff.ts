/** STUB — fixture-backed. Signatures from docs/SERVICES.md. */
import * as fx from '@/fixtures'
import { workingDaysBetween } from '@/lib/dates'
import type { LeaveBalances, LeaveRequest, LeaveStatus, LeaveType } from '@/types/models'
import { clone, latency, ServiceError } from './client'

export async function myBalances(employeeId: string): Promise<LeaveBalances> {
  await latency(160)
  const e = fx.byId(employeeId)
  return { paid: e?.paid_leave_balance ?? 0, sick: e?.sick_leave_balance ?? 0 }
}

export async function myRequests(employeeId: string): Promise<LeaveRequest[]> {
  await latency()
  return clone(
    fx.leaveRequests
      .filter((r) => r.employee_id === employeeId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  )
}

export async function createRequest(input: {
  employeeId: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  remarks: string
  attachment_url: string | null
}): Promise<LeaveRequest> {
  await latency(420)
  if (input.end_date < input.start_date) {
    throw new ServiceError('The end date cannot be before the start date.')
  }
  const days = workingDaysBetween(input.start_date, input.end_date)
  if (days === 0) {
    throw new ServiceError('That range contains no working days.')
  }

  // Unpaid leave draws on no balance, so it is never blocked here.
  const e = fx.byId(input.employeeId)
  if (input.leave_type === 'paid' && days > (e?.paid_leave_balance ?? 0)) {
    throw new ServiceError(`Only ${e?.paid_leave_balance ?? 0} paid days remaining.`)
  }
  if (input.leave_type === 'sick' && days > (e?.sick_leave_balance ?? 0)) {
    throw new ServiceError(`Only ${e?.sick_leave_balance ?? 0} sick days remaining.`)
  }

  const request: LeaveRequest = {
    id: `l-${Date.now()}`,
    employee_id: input.employeeId,
    employee_name: e ? `${e.first_name} ${e.last_name}` : 'Unknown',
    avatar_url: e?.avatar_url ?? null,
    leave_type: input.leave_type,
    start_date: input.start_date,
    end_date: input.end_date,
    days,
    remarks: input.remarks || null,
    attachment_url: input.attachment_url,
    status: 'pending',
    reviewed_by: null,
    review_comment: null,
    created_at: new Date().toISOString(),
  }
  fx.leaveRequests.unshift(request)
  return clone(request)
}

export async function cancelRequest(id: string): Promise<void> {
  await latency()
  const i = fx.leaveRequests.findIndex((r) => r.id === id)
  if (i < 0) throw new ServiceError('That request no longer exists.')
  if (fx.leaveRequests[i].status !== 'pending') {
    throw new ServiceError('Only a pending request can be cancelled.')
  }
  fx.leaveRequests.splice(i, 1)
}

export async function pendingRequests(): Promise<LeaveRequest[]> {
  await latency()
  return clone(fx.leaveRequests.filter((r) => r.status === 'pending'))
}

export async function allRequests(
  opts: { search?: string; status?: LeaveStatus | 'all' } = {},
): Promise<LeaveRequest[]> {
  await latency()
  const q = opts.search?.trim().toLowerCase() ?? ''
  return clone(
    fx.leaveRequests
      .filter((r) => !opts.status || opts.status === 'all' || r.status === opts.status)
      .filter((r) => !q || r.employee_name.toLowerCase().includes(q))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  )
}

/**
 * Admin/HR review. In the database this is one transactional function that
 * stamps the reviewer, sets the status, and moves the balance **exactly once**
 * (docs/SCHEMA.md). The guard below is the stub's version of that: re-reviewing
 * something already decided must not deduct a second time.
 */
export async function reviewRequest(
  id: string,
  status: Extract<LeaveStatus, 'approved' | 'rejected'>,
  reviewerId: string,
  comment?: string,
): Promise<LeaveRequest> {
  await latency(360)
  const request = fx.leaveRequests.find((r) => r.id === id)
  if (!request) throw new ServiceError('That request no longer exists.')
  if (request.status !== 'pending') {
    throw new ServiceError('That request has already been decided.')
  }

  request.status = status
  request.reviewed_by = reviewerId
  request.review_comment = comment?.trim() || null

  if (status === 'approved') {
    const e = fx.byId(request.employee_id)
    if (e) {
      if (request.leave_type === 'paid') {
        e.paid_leave_balance = Math.max(0, (e.paid_leave_balance ?? 0) - request.days)
      } else if (request.leave_type === 'sick') {
        e.sick_leave_balance = Math.max(0, (e.sick_leave_balance ?? 0) - request.days)
      }
      // Unpaid leave moves no balance.
    }
  }
  return clone(request)
}
