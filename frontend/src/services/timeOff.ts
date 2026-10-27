import { workingDaysBetween } from '@/lib/dates'
import type { Employee, LeaveBalances, LeaveRequest, LeaveStatus, LeaveType } from '@/types/models'
import { ServiceError, api, query } from './client'

const isLeaveType = (value: string): value is LeaveType =>
  value === 'paid' || value === 'sick' || value === 'unpaid'

const isLeaveStatus = (value: string): value is LeaveStatus =>
  value === 'pending' || value === 'approved' || value === 'rejected'

function toLeaveRequest(row: LeaveRequest): LeaveRequest {
  if (!isLeaveType(row.leave_type) || !isLeaveStatus(row.status)) {
    throw new ServiceError('A leave request returned an unsupported type or status.')
  }
  return row
}

export async function myBalances(employeeId: string): Promise<LeaveBalances> {
  const { employee } = await api<{ employee: Employee }>(
    'GET',
    `/employees/${encodeURIComponent(employeeId)}`,
    undefined,
    'Could not load your leave balances.',
  )
  return { paid: employee.paid_leave_balance, sick: employee.sick_leave_balance }
}

export async function myRequests(employeeId: string): Promise<LeaveRequest[]> {
  const rows = await api<LeaveRequest[]>(
    'GET',
    `/leave${query({ employeeId })}`,
    undefined,
    'Could not load your leave requests.',
  )
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

  const created = await api<LeaveRequest>(
    'POST',
    '/leave',
    {
      leave_type: input.leave_type,
      start_date: input.start_date,
      end_date: input.end_date,
      remarks: input.remarks.trim() || undefined,
      attachment_url: input.attachment_url || undefined,
    },
    'Could not submit that leave request.',
  )
  return toLeaveRequest(created)
}

export async function cancelRequest(id: string): Promise<void> {
  await api(
    'DELETE',
    `/leave/${encodeURIComponent(id)}`,
    undefined,
    'Only your own pending request can be cancelled.',
  )
}

export async function pendingRequests(): Promise<LeaveRequest[]> {
  return allRequests({ status: 'pending' })
}

export async function allRequests(
  opts: { search?: string; status?: LeaveStatus | 'all' } = {},
): Promise<LeaveRequest[]> {
  const requests = (await api<LeaveRequest[]>(
    'GET',
    `/leave${query({ status: opts.status })}`,
    undefined,
    'Could not load company leave requests.',
  )).map(toLeaveRequest)
  const search = opts.search?.trim().toLowerCase() ?? ''
  return search
    ? requests.filter((request) => request.employee_name.toLowerCase().includes(search))
    : requests
}

/** Reviewer identity and balance movement are derived and enforced by the server. */
export async function reviewRequest(
  id: string,
  status: Extract<LeaveStatus, 'approved' | 'rejected'>,
  comment?: string,
): Promise<LeaveRequest> {
  const reviewed = await api<LeaveRequest>(
    'POST',
    `/leave/${encodeURIComponent(id)}/review`,
    { status, comment: comment?.trim() || undefined },
    'Could not record that leave decision.',
  )
  return toLeaveRequest(reviewed)
}

const ATTACHMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

/** Stores a private leave document and returns its object path. */
export async function uploadAttachment(file: File): Promise<string> {
  if (!ATTACHMENT_TYPES.includes(file.type)) throw new ServiceError('Use a PDF, JPG, or PNG certificate.')
  if (file.size > 10 * 1024 * 1024) {
    throw new ServiceError('The certificate must be 10 MB or smaller.')
  }

  const form = new FormData()
  form.append('file', file)
  const { path } = await api<{ path: string }>(
    'POST',
    '/uploads/leave-documents',
    form,
    'Could not upload that certificate.',
  )
  return path
}

/**
 * The document URL. The server checks the viewer's session on every open, so
 * the link only works for the owner and Admin/HR in the same company.
 */
export async function signedAttachmentUrl(path: string): Promise<string> {
  return `/api/files/leave-documents/${path.split('/').map(encodeURIComponent).join('/')}`
}

export async function deleteAttachment(path: string): Promise<void> {
  await api(
    'DELETE',
    `/uploads/leave-documents?path=${encodeURIComponent(path)}`,
    undefined,
    'Could not clean up that certificate.',
  )
}
