/**
 * STUB — Praneet replaces the bodies with Supabase calls (TASKS 2.16 / 2.18).
 * The signatures are from docs/SERVICES.md and must not change.
 *
 * Sign-in is email + password only. docs/AUTH.md puts pre-authentication
 * login-ID resolution out of scope, so there is no "login ID or email" field.
 *
 * Employees never self-register: `signUpCompany` is the only public
 * registration path, and it creates a company plus its first admin.
 */
import { latency, ServiceError } from './client'

const SESSION_KEY = 'dayflow-demo-session'

export type Session = {
  userId: string
  email: string
  companyName: string
}

export type SignUpCompanyInput = {
  companyName: string
  firstName: string
  lastName: string
  email: string
  password: string
}

/** Mirrors Supabase's own rule so the message matches once it is wired. */
export const PASSWORD_MIN = 8

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) {
    return `Use at least ${PASSWORD_MIN} characters.`
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Use at least one letter and one number.'
  }
  return null
}

export function emailProblem(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : 'Enter a valid email address.'
}

export async function signIn(email: string, password: string): Promise<Session> {
  await latency()
  if (!email || !password) throw new ServiceError('Enter your email and password.')
  if (emailProblem(email)) throw new ServiceError('Enter a valid email address.')

  // The real implementation returns Supabase's generic failure here. Never
  // distinguish "no such account" from "wrong password" — that turns the form
  // into a way of finding out who works here.
  if (password.length < PASSWORD_MIN) {
    throw new ServiceError('Those details do not match an account.')
  }

  const session: Session = { userId: 'e-01', email, companyName: 'Odoo India' }
  persist(session)
  return session
}

export async function signUpCompany(input: SignUpCompanyInput): Promise<Session> {
  await latency(520)
  const problem =
    emailProblem(input.email) ??
    passwordProblem(input.password) ??
    (input.companyName.trim() ? null : 'Enter your company name.') ??
    (input.firstName.trim() && input.lastName.trim() ? null : 'Enter your full name.')
  if (problem) throw new ServiceError(problem)

  const session: Session = {
    userId: 'e-01',
    email: input.email,
    companyName: input.companyName,
  }
  persist(session)
  return session
}

export async function signOut(): Promise<void> {
  await latency(120)
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* blocked storage — nothing to clear */
  }
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function persist(session: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    /* blocked storage — the session simply will not survive a reload */
  }
}
