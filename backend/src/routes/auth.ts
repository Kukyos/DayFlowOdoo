import { Hono } from 'hono'
import {
  activeEmployee,
  endSession,
  hashPassword,
  passwordProblem,
  requireEmployee,
  requireSession,
  sessionUser,
  startSession,
  verifyPassword,
} from '../auth.ts'
import { newId, one, run, tx } from '../db.ts'
import { HttpError, badRequest, isEmail, jsonBody, optionalText, text } from '../http.ts'
import type { AppEnv } from '../http.ts'

export const authRoutes = new Hono<AppEnv>()

/**
 * Public company registration: the user, the company, and its first admin are
 * created together. The role is fixed here, never taken from the request.
 */
authRoutes.post('/signup', async (c) => {
  const body = await jsonBody(c)
  const email = text(body.email).toLowerCase()
  const password = typeof body.password === 'string' ? body.password : ''
  const companyName = text(body.companyName)
  const firstName = text(body.firstName)
  const lastName = text(body.lastName)

  if (!isEmail(email)) throw badRequest('Enter a valid email address.')
  const problem = passwordProblem(password)
  if (problem) throw badRequest(problem)
  if (!companyName) throw badRequest('Enter your company name.')
  if (!firstName || !lastName) throw badRequest('Enter your full name.')
  if (one('select 1 from users where email = ?', email)) {
    throw badRequest('We could not create your account. Check the details and try again.')
  }

  const userId = newId()
  tx(() => {
    const companyId = newId()
    run('insert into users (id, email, password_hash) values (?, ?, ?)', userId, email, hashPassword(password))
    run('insert into companies (id, name) values (?, ?)', companyId, companyName)
    run(
      `insert into employees (id, company_id, role, first_name, last_name, work_email, mobile)
       values (?, ?, 'admin', ?, ?, ?, ?)`,
      userId, companyId, firstName, lastName, email, optionalText(body.mobile),
    )
  })

  startSession(c, userId)
  return c.json({ user: { id: userId, email } }, 201)
})

authRoutes.post('/signin', async (c) => {
  const body = await jsonBody(c)
  const email = text(body.email).toLowerCase()
  const password = typeof body.password === 'string' ? body.password : ''

  const user = one<{ id: string; email: string; password_hash: string }>(
    'select id, email, password_hash from users where email = ?',
    email,
  )
  // One message for every failure, so sign-in cannot reveal which accounts exist.
  if (!user || !verifyPassword(password, user.password_hash) || !activeEmployee(user.id)) {
    throw new HttpError(401, 'Those details do not match an account.')
  }

  startSession(c, user.id)
  return c.json({ user: { id: user.id, email: user.email } })
})

authRoutes.post('/signout', (c) => {
  endSession(c)
  return c.json({ ok: true })
})

authRoutes.get('/session', (c) => {
  const user = sessionUser(c)
  return c.json({ user: user ? { id: user.id, email: user.email } : null })
})

/** Replacing the password is also what clears the first-sign-in requirement. */
authRoutes.post('/password', requireSession, async (c) => {
  const body = await jsonBody(c)
  const password = typeof body.password === 'string' ? body.password : ''
  const problem = passwordProblem(password)
  if (problem) throw badRequest(problem)

  tx(() => {
    run('update users set password_hash = ? where id = ?', hashPassword(password), c.var.userId)
    run('update employees set must_change_password = 0 where id = ?', c.var.userId)
    run('delete from sessions where user_id = ? and token <> ?', c.var.userId, c.var.sessionToken)
  })
  return c.json({ ok: true })
})

authRoutes.get('/me', requireEmployee, (c) => c.json(c.var.me))
