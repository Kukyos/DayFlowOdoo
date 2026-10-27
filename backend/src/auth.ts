/**
 * Passwords, sessions, and the request guards every route builds on.
 *
 * A session is a random token in an HttpOnly cookie, looked up in `sessions`.
 * The guards resolve the caller's active employee row once per request and put
 * it on `c.var.me`; routes make their access decisions from that row.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { one, run } from './db.ts'
import { HttpError, forbidden } from './http.ts'
import type { AppContext, AppEnv } from './http.ts'
import { employee } from './serialize.ts'
import type { EmployeeRecord } from './serialize.ts'

export const SESSION_COOKIE = 'dayflow_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30

export const PASSWORD_MIN = 8

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Use at least one letter and one number.'
  }
  return null
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length)
  return timingSafeEqual(actual, expected)
}

/** A one-time password for an HR-created account; the employee replaces it at first sign-in. */
export function temporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = randomBytes(15)
  return `Df!7${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')}`
}

export function startSession(c: AppContext, userId: string): void {
  const token = randomBytes(32).toString('base64url')
  run('insert into sessions (token, user_id) values (?, ?)', token, userId)
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export function endSession(c: AppContext): void {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) run('delete from sessions where token = ?', token)
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}

export function sessionUser(c: AppContext): { id: string; email: string; token: string } | null {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) return null
  const row = one<{ id: string; email: string; created_at: string }>(
    `select users.id, users.email, sessions.created_at
     from sessions join users on users.id = sessions.user_id
     where sessions.token = ?`,
    token,
  )
  if (!row) return null
  // The cookie expires on its own; the row has to be retired here.
  if (Date.now() - Date.parse(row.created_at) > SESSION_MAX_AGE * 1000) {
    run('delete from sessions where token = ?', token)
    return null
  }
  return { id: row.id, email: row.email, token }
}

export function activeEmployee(id: string): EmployeeRecord | null {
  const row = one('select * from employees where id = ? and is_active = 1', id)
  return row ? employee(row) : null
}

export const isPrivileged = (me: { role: string }): boolean => me.role === 'admin' || me.role === 'hr'

/** Any signed-in user, even one whose employee row is missing or inactive. */
export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const user = sessionUser(c)
  if (!user) throw new HttpError(401, 'Sign in to continue.')
  c.set('userId', user.id)
  c.set('sessionToken', user.token)
  await next()
})

/** A signed-in user with an active employee row, available as `c.var.me`. */
export const requireEmployee = createMiddleware<AppEnv>(async (c, next) => {
  const user = sessionUser(c)
  if (!user) throw new HttpError(401, 'Sign in to continue.')
  const me = activeEmployee(user.id)
  if (!me) throw forbidden('An active employee account is required.')
  c.set('userId', user.id)
  c.set('sessionToken', user.token)
  c.set('me', me)
  await next()
})

export const requirePrivileged = createMiddleware<AppEnv>(async (c, next) => {
  if (!isPrivileged(c.var.me)) throw forbidden('Only Admin and HR employees can do that.')
  await next()
})

/** The caller themself, or a privileged caller looking at their own company. */
export function canSeeFullRecord(me: EmployeeRecord, employeeId: string): boolean {
  if (me.id === employeeId) return true
  if (!isPrivileged(me)) return false
  return Boolean(
    one('select 1 from employees where id = ? and company_id = ?', employeeId, me.company_id),
  )
}
