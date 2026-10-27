import { Hono } from 'hono'
import {
  canSeeFullRecord,
  hashPassword,
  isPrivileged,
  requireEmployee,
  requirePrivileged,
  temporaryPassword,
} from '../auth.ts'
import { all, newId, one, run, tx } from '../db.ts'
import type { Params } from '../db.ts'
import { todayIST } from '../dates.ts'
import { badRequest, forbidden, isEmail, jsonBody, notFound, optionalText, text } from '../http.ts'
import type { AppEnv } from '../http.ts'
import { presenceSql } from '../queries.ts'
import { directoryEmployee, employee } from '../serialize.ts'

export const employeeRoutes = new Hono<AppEnv>()

employeeRoutes.use('*', requireEmployee)

const MINIMUM_MONTHLY_WAGE = 24998
const ROLES = ['admin', 'hr', 'employee'] as const

function companyDirectory(companyId: string, where = '', params: Params = []) {
  const today = todayIST()
  return all(
    `select employee.*, ${presenceSql('employee')} as presence
     from employees as employee
     where employee.is_active = 1 and employee.company_id = ? ${where}
     order by employee.first_name, employee.last_name`,
    today, today, companyId, ...params,
  )
}

/** Every active coworker, limited to directory-safe columns plus derived presence. */
employeeRoutes.get('/directory', (c) =>
  c.json(companyDirectory(c.var.me.company_id).map(directoryEmployee)),
)

/**
 * The caller and Admin/HR get the full record; a coworker gets the directory
 * projection, which carries no `monthly_wage` — the frontend keys off that.
 */
employeeRoutes.get('/employees/:id', (c) => {
  const id = c.req.param('id')
  const [row] = companyDirectory(c.var.me.company_id, 'and employee.id = ?', [id])
  if (!row) throw notFound('That employee no longer exists or is outside your company.')
  const presence = row.presence as string
  return c.json({
    employee: canSeeFullRecord(c.var.me, id) ? employee(row) : directoryEmployee(row),
    presence,
  })
})

const SELF_FIELDS = [
  'about', 'skills', 'mobile', 'address', 'avatar_url', 'date_of_birth',
  'bank_account_number', 'ifsc_code', 'pan_no', 'uan_no',
] as const

const PRIVILEGED_FIELDS = [
  ...SELF_FIELDS,
  'first_name', 'last_name', 'job_position', 'department', 'location', 'manager_id',
  'date_of_joining', 'monthly_wage', 'role', 'paid_leave_balance', 'sick_leave_balance',
] as const

type Field = (typeof PRIVILEGED_FIELDS)[number]

function fieldValue(field: Field, value: unknown, companyId: string, targetId: string) {
  switch (field) {
    case 'skills':
      if (value === null) return null
      if (!Array.isArray(value) || !value.every((skill) => typeof skill === 'string')) {
        throw badRequest('Skills must be a list of words.')
      }
      return JSON.stringify(value.map(text).filter(Boolean))
    case 'first_name':
    case 'last_name':
      if (!text(value)) throw badRequest('Enter the employee\'s full name.')
      return text(value)
    case 'monthly_wage':
      if (value === null) return null
      if (typeof value !== 'number' || !Number.isFinite(value) || value < MINIMUM_MONTHLY_WAGE) {
        throw badRequest(`Monthly wage must be at least ₹${MINIMUM_MONTHLY_WAGE}.`)
      }
      return Math.round(value * 100) / 100
    case 'paid_leave_balance':
    case 'sick_leave_balance':
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw badRequest('Leave balances cannot be negative.')
      }
      return value
    case 'role':
      if (!ROLES.includes(value as (typeof ROLES)[number])) throw badRequest('Choose a valid access level.')
      return value as string
    case 'manager_id': {
      const managerId = optionalText(value)
      if (managerId === targetId) throw badRequest('An employee cannot manage themself.')
      if (
        managerId &&
        !one('select 1 from employees where id = ? and company_id = ? and is_active = 1', managerId, companyId)
      ) {
        throw badRequest('Choose an active manager from your company.')
      }
      return managerId
    }
    default:
      return optionalText(value)
  }
}

employeeRoutes.patch('/employees/:id', async (c) => {
  const id = c.req.param('id')
  const me = c.var.me
  const target = one(
    'select id from employees where id = ? and company_id = ? and is_active = 1',
    id, me.company_id,
  )
  if (!target || (id !== me.id && !isPrivileged(me))) {
    throw notFound('That employee no longer exists or is outside your company.')
  }

  const allowed: readonly string[] = isPrivileged(me) ? PRIVILEGED_FIELDS : SELF_FIELDS
  const body = await jsonBody(c)
  const sets: string[] = []
  const params: Params = []
  for (const [field, value] of Object.entries(body)) {
    if (!allowed.includes(field)) {
      throw forbidden('You can only update your permitted profile and private information.')
    }
    sets.push(`${field} = ?`)
    params.push(fieldValue(field as Field, value, me.company_id, id))
  }

  if (sets.length > 0) run(`update employees set ${sets.join(', ')} where id = ?`, ...params, id)
  return c.json(employee(one('select * from employees where id = ?', id)!))
})

/** Admin/HR create a login plus employee record and receive a one-time temporary password. */
employeeRoutes.post('/employees', requirePrivileged, async (c) => {
  const body = await jsonBody(c)
  const firstName = text(body.first_name)
  const lastName = text(body.last_name)
  const email = text(body.work_email).toLowerCase()
  const joiningDate = text(body.date_of_joining)
  const wage = typeof body.monthly_wage === 'number' ? body.monthly_wage : Number.NaN
  if (!firstName || !lastName) throw badRequest('Enter the employee\'s full name.')
  if (!isEmail(email)) throw badRequest('Enter a valid work email.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(joiningDate)) throw badRequest('Enter a valid joining date.')
  if (!Number.isFinite(wage) || wage < MINIMUM_MONTHLY_WAGE) {
    throw badRequest(`Monthly wage must be at least ₹${MINIMUM_MONTHLY_WAGE}.`)
  }
  if (!ROLES.includes(body.role as (typeof ROLES)[number])) throw badRequest('Choose a valid access level.')

  const managerId = optionalText(body.manager_id)
  if (
    managerId &&
    !one('select 1 from employees where id = ? and company_id = ? and is_active = 1', managerId, c.var.me.company_id)
  ) {
    throw badRequest('Choose an active manager from your company.')
  }
  if (one('select 1 from users where email = ?', email)) {
    throw badRequest('Could not create that account. The work email may already be in use.')
  }

  const id = newId()
  const password = temporaryPassword()
  tx(() => {
    run('insert into users (id, email, password_hash) values (?, ?, ?)', id, email, hashPassword(password))
    run(
      `insert into employees (
         id, company_id, role, first_name, last_name, work_email, job_position, department,
         location, manager_id, date_of_joining, monthly_wage, must_change_password
       ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      id, c.var.me.company_id, body.role as string, firstName, lastName, email,
      optionalText(body.job_position), optionalText(body.department), optionalText(body.location),
      managerId, joiningDate, wage,
    )
  })

  return c.json(
    { employee: employee(one('select * from employees where id = ?', id)!), temporaryPassword: password },
    201,
  )
})

employeeRoutes.post('/employees/:id/deactivate', requirePrivileged, (c) => {
  const id = c.req.param('id')
  if (id === c.var.me.id) throw badRequest('You cannot deactivate your own account.')
  const result = run(
    'update employees set is_active = 0 where id = ? and company_id = ? and is_active = 1',
    id, c.var.me.company_id,
  )
  if (result.changes === 0) throw notFound('That active employee does not exist in your company.')
  run('delete from sessions where user_id = ?', id)
  return c.json({ ok: true })
})
