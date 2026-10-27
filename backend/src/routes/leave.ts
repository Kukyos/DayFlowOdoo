import { Hono } from 'hono'
import { canSeeFullRecord, isPrivileged, requireEmployee, requirePrivileged } from '../auth.ts'
import { newId, one, run, tx } from '../db.ts'
import type { Params } from '../db.ts'
import { isISODate, workingDaysBetween } from '../dates.ts'
import { badRequest, forbidden, jsonBody, notFound, optionalText } from '../http.ts'
import type { AppEnv } from '../http.ts'
import { leaveRequest, leaveRequests } from '../queries.ts'

export const leaveRoutes = new Hono<AppEnv>()

leaveRoutes.use('*', requireEmployee)

const LEAVE_TYPES = ['paid', 'sick', 'unpaid']
const STATUSES = ['pending', 'approved', 'rejected']

/**
 * With `employeeId`: that person's requests (self, or Admin/HR in the same
 * company). Without it: the whole company for Admin/HR, own requests otherwise.
 * `from`/`to` keep requests that overlap the range.
 */
leaveRoutes.get('/', (c) => {
  const me = c.var.me
  const { employeeId, status, from, to } = c.req.query()
  const where: string[] = []
  const params: Params = []

  if (employeeId) {
    if (!canSeeFullRecord(me, employeeId)) throw forbidden('You can only view your own leave requests.')
    where.push('leave_requests.employee_id = ?')
    params.push(employeeId)
  } else if (isPrivileged(me)) {
    where.push('employees.company_id = ?')
    params.push(me.company_id)
  } else {
    where.push('leave_requests.employee_id = ?')
    params.push(me.id)
  }
  if (status && status !== 'all') {
    if (!STATUSES.includes(status)) throw badRequest('Choose a valid leave status.')
    where.push('leave_requests.status = ?')
    params.push(status)
  }
  if (isISODate(to)) {
    where.push('leave_requests.start_date <= ?')
    params.push(to)
  }
  if (isISODate(from)) {
    where.push('leave_requests.end_date >= ?')
    params.push(from)
  }

  return c.json(leaveRequests(where.join(' and '), params))
})

function visibleRequest(me: AppEnv['Variables']['me'], id: string) {
  const request = leaveRequest(id)
  if (!request || !canSeeFullRecord(me, request.employee_id as string)) {
    throw notFound('That leave request no longer exists or is outside your company.')
  }
  return request
}

leaveRoutes.get('/:id', (c) => c.json(visibleRequest(c.var.me, c.req.param('id'))))

/** The server derives the requester and the weekday count, then checks the balance. */
leaveRoutes.post('/', async (c) => {
  const me = c.var.me
  const body = await jsonBody(c)
  const leaveType = body.leave_type
  const start = body.start_date
  const end = body.end_date

  if (typeof leaveType !== 'string' || !LEAVE_TYPES.includes(leaveType)) {
    throw badRequest('Choose paid, sick, or unpaid leave.')
  }
  if (!isISODate(start) || !isISODate(end)) throw badRequest('Choose valid leave dates.')
  if (end < start) throw badRequest('The end date cannot be before the start date.')
  const days = workingDaysBetween(start, end)
  if (days === 0) throw badRequest('That range contains no working days.')
  if (leaveType === 'paid' && days > me.paid_leave_balance) {
    throw badRequest(`Only ${me.paid_leave_balance} paid days remaining.`)
  }
  if (leaveType === 'sick' && days > me.sick_leave_balance) {
    throw badRequest(`Only ${me.sick_leave_balance} sick days remaining.`)
  }

  const id = newId()
  run(
    `insert into leave_requests (id, employee_id, leave_type, start_date, end_date, days, remarks, attachment_url)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
    id, me.id, leaveType, start, end, days, optionalText(body.remarks), optionalText(body.attachment_url),
  )
  return c.json(leaveRequest(id), 201)
})

leaveRoutes.delete('/:id', (c) => {
  const result = run(
    `delete from leave_requests where id = ? and employee_id = ? and status = 'pending'`,
    c.req.param('id'), c.var.me.id,
  )
  if (result.changes === 0) throw notFound('Only your own pending request can be cancelled.')
  return c.json({ ok: true })
})

const formatDay = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  })

/**
 * One-time decision. Approval moves the matching balance, and the decision
 * notification is written, in the same transaction as the status change.
 */
leaveRoutes.post('/:id/review', requirePrivileged, async (c) => {
  const me = c.var.me
  const body = await jsonBody(c)
  const status = body.status
  if (status !== 'approved' && status !== 'rejected') {
    throw badRequest('A leave request can only be approved or rejected.')
  }

  const id = c.req.param('id')
  tx(() => {
    const request = one<{ employee_id: string; leave_type: string; start_date: string; end_date: string; days: number; status: string }>(
      `select leave_requests.* from leave_requests
       join employees on employees.id = leave_requests.employee_id
       where leave_requests.id = ? and employees.company_id = ?`,
      id, me.company_id,
    )
    if (!request) throw notFound('That leave request no longer exists or is outside your company.')
    if (request.status !== 'pending') throw badRequest('That leave request has already been decided.')

    if (status === 'approved' && request.leave_type !== 'unpaid') {
      const column = request.leave_type === 'paid' ? 'paid_leave_balance' : 'sick_leave_balance'
      const moved = run(
        `update employees set ${column} = ${column} - ? where id = ? and ${column} >= ?`,
        request.days, request.employee_id, request.days,
      )
      if (moved.changes === 0) {
        throw badRequest(`The employee no longer has enough ${request.leave_type} leave for this request.`)
      }
    }

    run(
      'update leave_requests set status = ?, reviewed_by = ?, review_comment = ? where id = ?',
      status, me.id, optionalText(body.comment), id,
    )
    run(
      `insert into notifications (id, employee_id, type, title, message, leave_request_id)
       values (?, ?, ?, ?, ?, ?)`,
      newId(),
      request.employee_id,
      `leave_${status}`,
      status === 'approved' ? 'Time off approved' : 'Time off declined',
      `Your ${request.leave_type} leave request from ${formatDay(request.start_date)} to ${formatDay(request.end_date)} was ${status}.`,
      id,
    )
  })

  return c.json(leaveRequest(id))
})
