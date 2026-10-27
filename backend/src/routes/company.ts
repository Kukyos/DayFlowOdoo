import { Hono } from 'hono'
import { requireEmployee, requirePrivileged } from '../auth.ts'
import { one, run } from '../db.ts'
import type { Params } from '../db.ts'
import { badRequest, jsonBody, optionalText, text } from '../http.ts'
import type { AppEnv } from '../http.ts'
import { company } from '../serialize.ts'

export const companyRoutes = new Hono<AppEnv>()

companyRoutes.use('*', requireEmployee)

const loadCompany = (id: string) => company(one('select * from companies where id = ?', id)!)

companyRoutes.get('/', (c) => c.json(loadCompany(c.var.me.company_id)))

const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

companyRoutes.patch('/', requirePrivileged, async (c) => {
  const body = await jsonBody(c)
  const sets: string[] = []
  const params: Params = []

  if ('name' in body) {
    if (!text(body.name)) throw badRequest('Enter your company name.')
    sets.push('name = ?')
    params.push(text(body.name))
  }
  if ('logo_url' in body) {
    sets.push('logo_url = ?')
    params.push(optionalText(body.logo_url))
  }
  if ('time_off_types' in body) {
    const types = body.time_off_types
    if (!Array.isArray(types) || types.length === 0 || !types.every((type) => text(type))) {
      throw badRequest('Keep at least one time-off type.')
    }
    sets.push('time_off_types = ?')
    params.push(JSON.stringify(types.map(text)))
  }
  if ('working_days' in body) {
    const days = body.working_days
    if (
      !Array.isArray(days) ||
      days.length === 0 ||
      !days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    ) {
      throw badRequest('Choose at least one working day.')
    }
    sets.push('working_days = ?')
    params.push(JSON.stringify([...new Set(days as number[])].sort()))
  }
  for (const field of ['workday_start', 'workday_end'] as const) {
    if (field in body) {
      const value = text(body[field])
      if (!TIME.test(value)) throw badRequest('Enter the workday as HH:MM.')
      sets.push(`${field} = ?`)
      params.push(value.length === 5 ? `${value}:00` : value)
    }
  }

  if (sets.length > 0) {
    try {
      run(`update companies set ${sets.join(', ')} where id = ?`, ...params, c.var.me.company_id)
    } catch {
      throw badRequest('The workday must start before it ends.')
    }
  }
  return c.json(loadCompany(c.var.me.company_id))
})
