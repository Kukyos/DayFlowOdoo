/**
 * Authentication service boundary. Pages never import the Supabase client
 * directly; they receive data or a safe, user-facing error from this module.
 */
import type { AuthChangeEvent, Session as SupabaseSession } from '@supabase/supabase-js'
import type { Employee } from '@/types/models'
import { ServiceError, supabaseClient } from './client'

export type Session = SupabaseSession

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
  confirmationRequired: boolean
}

/** Mirrors the configured Supabase minimum so feedback appears before submit. */
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

export async function signIn(email: string, password: string): Promise<Session> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || !password) throw new ServiceError('Enter your email and password.')
  if (emailProblem(normalizedEmail)) throw new ServiceError('Enter a valid email address.')

  const { data, error } = await supabaseClient().auth.signInWithPassword({
    email: normalizedEmail,
    password,
  })
  if (error || !data.session) {
    // Do not reveal whether an account exists, is unconfirmed, or has a wrong password.
    throw new ServiceError('Those details do not match an account.')
  }

  return data.session
}

export async function signUpCompany(input: SignUpCompanyInput): Promise<SignUpCompanyResult> {
  const normalizedEmail = input.email.trim().toLowerCase()
  const problem =
    emailProblem(normalizedEmail) ??
    passwordProblem(input.password) ??
    (input.companyName.trim() ? null : 'Enter your company name.') ??
    (input.firstName.trim() && input.lastName.trim() ? null : 'Enter your full name.')
  if (problem) throw new ServiceError(problem)

  const { data, error } = await supabaseClient().auth.signUp({
    email: normalizedEmail,
    password: input.password,
    options: {
      // This URL must also be present in Supabase Auth's Redirect URL allow-list.
      emailRedirectTo: `${window.location.origin}/signin`,
      data: {
        registration_type: 'company',
        company_name: input.companyName.trim(),
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
      },
    },
  })
  if (error || !data.user) {
    // The database trigger deliberately returns generic Auth errors. Keep the
    // UI generic too so signup cannot be used to enumerate existing accounts.
    throw new ServiceError('We could not create your account. Check the details and try again.')
  }

  return { userId: data.user.id, confirmationRequired: data.session === null }
}

export async function signOut(): Promise<void> {
  const { error } = await supabaseClient().auth.signOut()
  if (error) throw new ServiceError('Could not sign you out. Please try again.', error)
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabaseClient().auth.getSession()
  if (error) throw new ServiceError('Could not restore your session.', error)
  return data.session
}

export function onAuthChange(callback: (event: AuthChangeEvent, session: Session | null) => void): () => void {
  const { data } = supabaseClient().auth.onAuthStateChange(callback)
  return () => data.subscription.unsubscribe()
}

export async function currentEmployee(): Promise<Employee> {
  const { data, error } = await supabaseClient()
    .from('employees')
    .select('*')
    .single()

  if (error || !data) {
    throw new ServiceError(
      'Your account is signed in, but its employee profile could not be loaded.',
      error,
    )
  }

  if (data.role !== 'admin' && data.role !== 'hr' && data.role !== 'employee') {
    throw new ServiceError('Your employee profile has an unsupported access role.')
  }

  return { ...data, role: data.role }
}

export async function changePassword(newPassword: string): Promise<void> {
  const problem = passwordProblem(newPassword)
  if (problem) throw new ServiceError(problem)

  const { error } = await supabaseClient().auth.updateUser({ password: newPassword })
  if (error) {
    throw new ServiceError('Could not change your password. Please try again.', error)
  }
}
