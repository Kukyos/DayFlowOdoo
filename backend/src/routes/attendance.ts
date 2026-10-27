import { Hono } from 'hono'
import { canSeeFullRecord, requireEmployee, requirePrivileged } from '../auth.ts'
import { all, newId, one, run } from '../db.ts'
import { isISODate, nowISO, todayIST } from '../dates.ts'
import { badRequest, forbidden, text } from '../http.ts'
import type { AppEnv } from '../http.ts'

export const attendanceRoutes = new Hono<AppEnv>()

attendanceRoutes.use('*', requireEmployee)

const todayRow = (employeeId: string) =>
  one('select * from attendance where employee_id = ? and work_date = ?', employeeId, todayIST()) ?? null

attendanceRoutes.get('/today', (c) => c.json({ row: todayRow(c.var.me.id) }))

/** One row per employee per day; identity and timestamps come from the server. */
attendanceRoutes.post('/check-in', (c) => {
  if (todayRow(c.var.me.id)) throw badRequest('You have already checked in today.')
  run(
    `insert into attendance (id, employee_id, work_date, check_in, status)
     values (?, ?, ?, ?, 'present')`,
    newId(), c.var.me.id, todayIST(), nowISO(),
  )
  return c.json(todayRow(c.var.me.id))
})

attendanceRoutes.post('/check-out', (c) => {
  const result = run(
    `update attendance set check_out = ?
     where employee_id = ? and work_date = ? and check_in is not null and check_out is null`,
    nowISO(), c.var.me.id, todayIST(),
  )
  if (result.changes === 0) throw badRequest('You do not have an open check-in today.')
  return c.json(todayRow(c.var.me.id))
})

/** Stored rows for one employee and date range: the caller's own, or any for Admin/HR. */
attendanceRoutes.get('/', (c) => {
  const employeeId = c.req.query('employeeId') ?? c.var.me.id
  const from = c.req.query('from')
  const to = c.req.query('to')
  if (!isISODate(from) || !isISODate(to)) throw badRequest('Choose a valid attendance range.')
  if (!canSeeFullRecord(c.var.me, employeeId)) throw forbidden('You can only view your own attendance.')
  return c.json(all(
    `select * from attendance
     where employee_id = ? and work_date between ? and ?
     order by work_date desc`,
    employeeId, from, to,
  ))
})

/** Admin/HR register for one day. A missing row reads as approved leave or absence. */
attendanceRoutes.get('/company', requirePrivileged, (c) => {
  const date = c.req.query('date') ?? todayIST()
  if (!isISODate(date)) throw badRequest('Choose a valid attendance date.')
  const search = text(c.req.query('search'))

  return c.json(all(
    `select
       ? as work_date,
       employee.id as employee_id,
       employee.first_name || ' ' || employee.last_name as employee_name,
       employee.avatar_url,
       record.check_in,
       record.check_out,
       case
         when record.id is not null then record.status
         when exists (
           select 1 from leave_requests as request
           where request.employee_id = employee.id
             and request.status = 'approved'
             and ? between request.start_date and request.end_date
         ) then 'leave'
         else 'absent'
       end as status,
       case
         when record.check_in is not null and record.check_out is not null
           then round((julianday(record.check_out) - julianday(record.check_in)) * 24, 2)
       end as work_hours
     from employees as employee
     left join attendance as record
       on record.employee_id = employee.id and record.work_date = ?
     where employee.is_active = 1
       and employee.company_id = ?
       and (? = '' or (employee.first_name || ' ' || employee.last_name) like '%' || ? || '%')
     order by employee.first_name, employee.last_name`,
    date, date, date, c.var.me.company_id, search, search,
  ))
})
