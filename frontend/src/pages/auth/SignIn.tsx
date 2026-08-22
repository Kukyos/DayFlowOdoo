import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthCard, AuthLayout } from '@/components/auth/AuthLayout'
import { Button, Field, Input } from '@/components/ui'
import { emailProblem, signIn } from '@/services/auth'

/**
 * Sign in — email and password only.
 *
 * docs/AUTH.md puts pre-authentication login-ID resolution out of scope, so
 * there is deliberately no "login ID or email" field: resolving an ID before
 * the user is authenticated needs an unauthenticated lookup over employee
 * emails, which is an enumeration surface nobody needs for the MVP.
 *
 * The reference's "Remember my login" and "Forgot your password?" are also
 * deliberately absent. Supabase persists the session in local storage already,
 * so the checkbox would toggle nothing, and there is no password-reset function
 * in docs/SERVICES.md to put behind the link. A control that does nothing is
 * worse than no control.
 */
export function SignIn() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Only complain once there is something to complain about. Blurring an empty
  // field you have not filled in yet is not an error — it is just a field.
  const emailError = touched && email.length > 0 ? emailProblem(email) : null

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    setError(null)
    if (!email || !password) {
      setError('Enter your email and password.')
      return
    }
    if (emailProblem(email)) {
      setError('Enter a valid email address.')
      return
    }
    setBusy(true)
    try {
      await signIn(email, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign you in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout otherAction="signup">
      <AuthCard
        title="Log in to your account"
        footer={
          <p className="t-caption text-auth-panel-ink">
            No account yet?{' '}
            <Link to="/signup" className="font-bold underline underline-offset-4">
              Register your company
            </Link>
          </p>
        }
      >
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {error && (
            <p
              role="alert"
              className="rounded-control border border-danger-ink px-3 py-2 t-caption text-danger-ink"
            >
              {error}
            </p>
          )}

          <Field label="Work email" htmlFor="email" error={emailError}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              autoFocus
              placeholder="ananya.iyer@odoo.in"
              value={email}
              aria-invalid={Boolean(emailError)}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
            />
          </Field>

          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <Button type="submit" variant="strong" disabled={busy} className="mt-2 w-full">
            {busy ? 'Signing in…' : 'Log in'}
          </Button>
        </form>

        <p className="t-caption mt-5 border-t border-border-soft pt-4 text-text-muted">
          Employees do not register here. Your HR team creates your account and
          sends you the details.
        </p>
      </AuthCard>
    </AuthLayout>
  )
}
