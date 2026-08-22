import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthCard, AuthLayout } from '@/components/auth/AuthLayout'
import { Button, Field, Input } from '@/components/ui'
import { identifierProblem, signIn } from '@/services/auth'

/**
 * Sign in with an Auth email or a generated Login ID. Login-ID resolution and
 * password verification stay in the narrow Edge Function so the browser never
 * gets an unauthenticated employee-directory lookup.
 *
 * The reference's "Remember my login" and "Forgot your password?" are also
 * deliberately absent. Supabase persists the session in local storage already,
 * so the checkbox would toggle nothing, and there is no password-reset function
 * in docs/SERVICES.md to put behind the link. A control that does nothing is
 * worse than no control.
 */
export function SignIn() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Only complain once there is something to complain about. Blurring an empty
  // field you have not filled in yet is not an error — it is just a field.
  const identifierError = touched && identifier.length > 0 ? identifierProblem(identifier) : null

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    setError(null)
    if (!identifier || !password) {
      setError('Enter your work email or Login ID and password.')
      return
    }
    if (identifierProblem(identifier)) {
      setError('Enter a valid work email or Login ID.')
      return
    }
    setBusy(true)
    try {
      await signIn(identifier, password)
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

          <Field label="Work email or Login ID" htmlFor="identifier" error={identifierError}>
            <Input
              id="identifier"
              name="username"
              type="text"
              autoComplete="username"
              autoFocus
              placeholder="ananya.iyer@odoo.in or ODOO-000001"
              value={identifier}
              aria-invalid={Boolean(identifierError)}
              onChange={(e) => setIdentifier(e.target.value)}
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
