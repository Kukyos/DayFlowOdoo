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
import { nowISO, todayIST } from '../dates.ts'
import { badRequest, forbidden, isEmail, jsonBody, notFound, optionalText, text } from '../http.ts'
import type { AppEnv } from '../http.ts'
import { presenceSql } from '../queries.ts'
import { directoryEmployee, employee } from '../serialize.ts'
import { isOwnObject, removeObject } from './files.ts'

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

/** Deactivated people, so Admin/HR can bring them back. Registered before `/employees/:id`. */
employeeRoutes.get('/employees/inactive', requirePrivileged, (c) =>
  c.json(all(
    `select id, first_name, last_name, avatar_url, job_position, department, work_email
     from employees
     where company_id = ? and is_active = 0
     order by first_name, last_name`,
    c.var.me.company_id,
  )),
)

/**
 * The caller and Admin/HR get the full record; a coworker gets the directory
 * projection, which carries no `monthly_wage` — the frontend keys off that.
 * Everyone also gets the manager's name and the active direct reports.
 */
employeeRoutes.get('/employees/:id', (c) => {
  const id = c.req.param('id')
  const [row] = companyDirectory(c.var.me.company_id, 'and employee.id = ?', [id])
  if (!row) throw notFound('That employee no longer exists or is outside your company.')
  const presence = row.presence as string
  const manager = row.manager_id
    ? one(
        'select id, first_name, last_name from employees where id = ? and company_id = ?',
        row.manager_id, c.var.me.company_id,
      ) ?? null
    : null
  return c.json({
    employee: canSeeFullRecord(c.var.me, id) ? employee(row) : directoryEmployee(row),
    presence,
    manager,
    reports: companyDirectory(c.var.me.company_id, 'and employee.manager_id = ?', [id]).map(directoryEmployee),
  })
})

const SELF_FIELDS = [
  'about', 'skills', 'mobile', 'address', 'avatar_url', 'date_of_birth',
  'bank_account_number', 'ifsc_code', 'pan_no', 'uan_no', 'resume_path', 'resume_name',
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
      // Walk up from the new manager: reaching the employee means a loop.
      for (let above = managerId, steps = 0; above && steps < 1000; steps += 1) {
        if (above === targetId) throw badRequest('That would make the reporting line loop back on itself.')
        above = one<{ manager_id: string | null }>('select manager_id from employees where id = ?', above)?.manager_id ?? null
      }
      return managerId
    }
    case 'resume_path': {
      const resumePath = optionalText(value)
      if (resumePath && !isOwnObject(resumePath, companyId, targetId)) {
        throw badRequest('Upload the résumé before attaching it.')
      }
      return resumePath
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
  if (id === me.id && 'role' in body && body.role !== me.role) {
    throw forbidden('You cannot change your own access level.')
  }
  const sets: string[] = []
  const params: Params = []
  for (const [field, value] of Object.entries(body)) {
    if (!allowed.includes(field)) {
      throw forbidden('You can only update your permitted profile and private information.')
    }
    sets.push(`${field} = ?`)
    params.push(fieldValue(field as Field, value, me.company_id, id))
  }

  const previousResume = one<{ resume_path: string | null }>('select resume_path from employees where id = ?', id)!.resume_path
  const resumeChanged = 'resume_path' in body && (optionalText(body.resume_path) ?? null) !== previousResume
  if (resumeChanged) {
    sets.push('resume_uploaded_at = ?')
    params.push(optionalText(body.resume_path) ? nowISO() : null)
    if (!optionalText(body.resume_path)) {
      sets.push('resume_name = ?')
      params.push(null)
    }
  }

  if (sets.length > 0) run(`update employees set ${sets.join(', ')} where id = ?`, ...params, id)
  // The old file is unreachable once nothing points at it.
  if (resumeChanged && previousResume) await removeObject('resumes', previousResume).catch(() => undefined)
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

employeeRoutes.post('/employees/:id/reactivate', requirePrivileged, (c) => {
  const result = run(
    'update employees set is_active = 1 where id = ? and company_id = ? and is_active = 0',
    c.req.param('id'), c.var.me.company_id,
  )
  if (result.changes === 0) throw notFound('That deactivated employee does not exist in your company.')
  return c.json(employee(one('select * from employees where id = ?', c.req.param('id'))!))
})

/**
 * There is no email, so a forgotten password is reset by Admin/HR: a new
 * one-time temporary password, which must be replaced at the next sign-in.
 */
employeeRoutes.post('/employees/:id/reset-password', requirePrivileged, (c) => {
  const id = c.req.param('id')
  if (id === c.var.me.id) throw badRequest('Change your own password from the account menu instead.')
  if (!one('select 1 from employees where id = ? and company_id = ? and is_active = 1', id, c.var.me.company_id)) {
    throw notFound('That active employee does not exist in your company.')
  }

  const password = temporaryPassword()
  tx(() => {
    run('update users set password_hash = ? where id = ?', hashPassword(password), id)
    run('update employees set must_change_password = 1 where id = ?', id)
    run('delete from sessions where user_id = ?', id)
  })
  return c.json({ temporaryPassword: password })
})
