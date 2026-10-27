/**
 * Authentication service boundary. Pages never call the API directly; they
 * receive data or a safe, user-facing error from this module.
 *
 * The session itself is an HttpOnly cookie the browser holds. This module
 * keeps the signed-in user it last saw and tells `AuthProvider` whenever that
 * changes, through `onAuthChange`.
 */
import type { Employee } from '@/types/models'
import { ServiceError, api, onUnauthorized } from './client'

export type Session = {
  user: { id: string; email: string }
}

export type AuthChangeEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'USER_UPDATED'

type AuthListener = (event: AuthChangeEvent, session: Session | null) => void

export type SignUpCompanyInput = {
  companyName: string
  firstName: string
  lastName: string
  email: string
  password: string
  mobile?: string
}

export type SignUpCompanyResult = {
  userId: string
}

/** Mirrors the server's minimum so feedback appears before submit. */
export const PASSWORD_MIN = 8

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Use at least one letter and one number.'
  }
  return null
}

export function emailProblem(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : 'Enter a valid email address.'
}

const listeners = new Set<AuthListener>()
let current: Session | null = null

function emit(event: AuthChangeEvent, session: Session | null) {
  current = session
  for (const listener of listeners) listener(event, session)
}

onUnauthorized(() => {
  if (current) emit('SIGNED_OUT', null)
})

export async function signIn(email: string, password: string): Promise<Session> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || !password) throw new ServiceError('Enter your email and password.')
  if (emailProblem(normalizedEmail)) throw new ServiceError('Enter a valid email address.')

  const session = await api<Session>(
    'POST',
    '/auth/signin',
    { email: normalizedEmail, password },
    'Those details do not match an account.',
  )
  emit('SIGNED_IN', session)
  return session
}

/** Creates the company and its first admin, then signs straight in. */
export async function signUpCompany(input: SignUpCompanyInput): Promise<SignUpCompanyResult> {
  const normalizedEmail = input.email.trim().toLowerCase()
  const problem =
    emailProblem(normalizedEmail) ??
    passwordProblem(input.password) ??
    (input.companyName.trim() ? null : 'Enter your company name.') ??
    (input.firstName.trim() && input.lastName.trim() ? null : 'Enter your full name.')
  if (problem) throw new ServiceError(problem)

  const session = await api<Session>(
    'POST',
    '/auth/signup',
    {
      companyName: input.companyName.trim(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: normalizedEmail,
      password: input.password,
      mobile: input.mobile?.trim() || undefined,
    },
    'We could not create your account. Check the details and try again.',
  )
  emit('SIGNED_IN', session)
  return { userId: session.user.id }
}

export async function signOut(): Promise<void> {
  await api('POST', '/auth/signout', undefined, 'Could not sign you out. Please try again.')
  emit('SIGNED_OUT', null)
}

export async function getSession(): Promise<Session | null> {
  const { user } = await api<{ user: Session['user'] | null }>(
    'GET',
    '/auth/session',
    undefined,
    'Could not restore your session.',
  )
  return user ? { user } : null
}

/**
 * Subscribes to sign-in state. The listener first receives `INITIAL_SESSION`
 * once the server has said whether the browser's cookie is still valid.
 */
export function onAuthChange(callback: AuthListener): () => void {
  listeners.add(callback)
  void getSession()
    .catch(() => null)
    .then((session) => {
      if (!listeners.has(callback)) return
      current = session
      callback('INITIAL_SESSION', session)
    })
  return () => listeners.delete(callback)
}

export async function currentEmployee(): Promise<Employee> {
  const employee = await api<Employee>(
    'GET',
    '/auth/me',
    undefined,
    'Your account is signed in, but its employee profile could not be loaded.',
  )
  if (employee.role !== 'admin' && employee.role !== 'hr' && employee.role !== 'employee') {
    throw new ServiceError('Your employee profile has an unsupported access role.')
  }
  return employee
}

/** Replacing the password also clears the first-sign-in requirement on the server. */
export async function changePassword(newPassword: string): Promise<void> {
  const problem = passwordProblem(newPassword)
  if (problem) throw new ServiceError(problem)

  await api('POST', '/auth/password', { password: newPassword }, 'Could not change your password. Please try again.')
  emit('USER_UPDATED', current)
}
