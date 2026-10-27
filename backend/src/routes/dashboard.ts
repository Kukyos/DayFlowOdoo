import { Hono } from 'hono'
import { isPrivileged, requireEmployee } from '../auth.ts'
import { all, one } from '../db.ts'
import { todayIST, weekdaysBetween } from '../dates.ts'
import type { AppEnv } from '../http.ts'
import { leaveRequests, presenceSql } from '../queries.ts'
import { directoryEmployee } from '../serialize.ts'

export const dashboardRoutes = new Hono<AppEnv>()

dashboardRoutes.use('*', requireEmployee)

/**
 * One read for the whole dashboard. Everyone gets their own month, balances and
 * recent requests; company aggregates and the approval queue are Admin/HR only.
 */
dashboardRoutes.get('/', (c) => {
  const me = c.var.me
  const today = todayIST()

  const records = new Map(
    all<{ work_date: string; status: string }>(
      'select work_date, status from attendance where employee_id = ? and work_date between ? and ?',
      me.id, `${today.slice(0, 8)}01`, today,
    ).map((row) => [row.work_date, row.status]),
  )
  const approved = all<{ start_date: string; end_date: string }>(
    `select start_date, end_date from leave_requests
     where employee_id = ? and status = 'approved' and end_date >= ?`,
    me.id, `${today.slice(0, 8)}01`,
  )
  const attendance = { present: 0, absent: 0, half_day: 0, leave: 0 }
  for (const day of weekdaysBetween(`${today.slice(0, 8)}01`, today)) {
    const status =
      records.get(day) ??
      (approved.some((leave) => leave.start_date <= day && leave.end_date >= day) ? 'leave' : 'absent')
    attendance[status as keyof typeof attendance] += 1
  }

  const todayRecord =
    one('select * from attendance where employee_id = ? and work_date = ?', me.id, today) ?? null

  const inOffice = all(
    `select employee.*, 'present' as presence
     from employees as employee
     join attendance as record
       on record.employee_id = employee.id and record.work_date = ? and record.check_in is not null
     where employee.company_id = ? and employee.is_active = 1
     order by employee.first_name, employee.last_name
     limit 10`,
    today, me.company_id,
  ).map(directoryEmployee)

  let company = null
  let pendingRequests: unknown[] = []
  if (isPrivileged(me)) {
    const presence = all<{ presence: string }>(
      `select ${presenceSql('employee')} as presence
       from employees as employee
       where employee.company_id = ? and employee.is_active = 1`,
      today, today, me.company_id,
    )
    const pending = one<{ count: number }>(
      `select count(*) as count from leave_requests
       join employees on employees.id = leave_requests.employee_id
       where employees.company_id = ? and leave_requests.status = 'pending'`,
      me.company_id,
    )!
    company = {
      headcount: presence.length,
      present_today: presence.filter((row) => row.presence === 'present').length,
      on_leave_today: presence.filter((row) => row.presence === 'leave').length,
      pending_leave: pending.count,
    }
    pendingRequests = leaveRequests(
      `employees.company_id = ? and leave_requests.status = 'pending'`,
      [me.company_id],
      'limit 5',
    )
  }

  return c.json({
    attendance,
    balances: { paid: me.paid_leave_balance, sick: me.sick_leave_balance },
    today: {
      checked_in: Boolean(todayRecord?.check_in && !todayRecord.check_out),
      row: todayRecord,
    },
    company,
    in_office: inOffice,
    pending_requests: pendingRequests,
    recent_requests: leaveRequests('leave_requests.employee_id = ?', [me.id], 'limit 5'),
  })
})
