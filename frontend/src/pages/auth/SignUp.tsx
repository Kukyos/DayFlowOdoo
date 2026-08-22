import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthCard, AuthLayout } from '@/components/auth/AuthLayout'
import { Button, Field, Input } from '@/components/ui'
import { emailProblem, passwordProblem, signUpCompany } from '@/services/auth'

/**
 * Sign up registers a **company and its first admin** — never an employee.
 *
 * docs/AUTH.md §1: employees cannot self-register; HR creates them. The PDF
 * describes an open sign-up with a role dropdown, and the wireframes override
 * it — an open role dropdown would let anyone select HR and read every salary
 * in the company. So there is no role field on this form, and the database
 * assigns `admin` rather than trusting anything the client sends.
 */
export function SignUp() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [form, setForm] = useState({
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirm: '',
  })
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmationRequired, setConfirmationRequired] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }))

  // A field you have not typed in yet is not invalid, so each check waits for
  // both a blur and some content.
  const emailError = touched.email && form.email ? emailProblem(form.email) : null
  const passwordError =
    touched.password && form.password ? passwordProblem(form.password) : null
  const confirmError =
    touched.confirm && form.confirm && form.confirm !== form.password
      ? 'Both passwords must match.'
      : null

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched({ companyName: true, firstName: true, lastName: true, email: true, password: true, confirm: true })
    setError(null)

    const problem =
      (form.companyName.trim() ? null : 'Enter your company name.') ??
      (form.firstName.trim() && form.lastName.trim() ? null : 'Enter your full name.') ??
      emailProblem(form.email) ??
      passwordProblem(form.password) ??
      (form.confirm === form.password ? null : 'Both passwords must match.')
    if (problem) {
      setError(problem)
      return
    }

    setBusy(true)
    try {
      const result = await signUpCompany({
        companyName: form.companyName,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
      })
      if (result.confirmationRequired) {
        setConfirmationRequired(true)
      } else {
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account.')
    } finally {
      setBusy(false)
    }
  }

  if (sentTo) {
    return (
      <AuthLayout otherAction="signin">
        <AuthCard
          title="Confirm your email"
          footer={
            <p className="t-caption text-auth-panel-ink">
              Wrong address?{' '}
              <button
                type="button"
                onClick={() => setSentTo(null)}
                className="font-bold underline underline-offset-4"
              >
                Go back and change it
              </button>
            </p>
          }
        >
          <p className="t-body">
            We sent a confirmation link to <strong>{sentTo}</strong>. Follow it,
            then sign in — your company and admin account are already created.
          </p>
          <p className="t-caption mt-4 text-text-muted">
            Nothing arrived? Check the spam folder. The link returns you to the
            sign-in page.
          </p>
          <Link to="/signin">
            <Button variant="strong" className="mt-6 w-full">
              Go to sign in
            </Button>
          </Link>
        </AuthCard>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout otherAction="signin">
      <AuthCard
        title="Register your company"
        footer={
          <p className="t-caption text-auth-panel-ink">
            Already have an account?{' '}
            <Link to="/signin" className="font-bold underline underline-offset-4">
              Log in
            </Link>
          </p>
        }
      >
        {confirmationRequired ? (
          <div className="flex flex-col gap-4">
            <p className="t-body text-text-muted">
              Check your inbox to confirm your email address. Once confirmed,
              return here and log in to continue.
            </p>
            <Button type="button" variant="strong" className="w-full" onClick={() => navigate('/signin')}>
              Go to log in
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {error && (
            <p
              role="alert"
              className="rounded-control border border-danger-ink px-3 py-2 t-caption text-danger-ink"
            >
              {error}
            </p>
          )}

          <Field label="Company name" htmlFor="companyName">
            <Input
              id="companyName"
              autoFocus
              placeholder="Odoo India"
              value={form.companyName}
              onChange={set('companyName')}
              onBlur={blur('companyName')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" htmlFor="firstName">
              <Input
                id="firstName"
                autoComplete="given-name"
                placeholder="Ananya"
                value={form.firstName}
                onChange={set('firstName')}
                onBlur={blur('firstName')}
              />
            </Field>
            <Field label="Last name" htmlFor="lastName">
              <Input
                id="lastName"
                autoComplete="family-name"
                placeholder="Iyer"
                value={form.lastName}
                onChange={set('lastName')}
                onBlur={blur('lastName')}
              />
            </Field>
          </div>

          <Field label="Work email" htmlFor="signup-email" error={emailError}>
            <Input
              id="signup-email"
              type="email"
              autoComplete="username"
              placeholder="ananya.iyer@odoo.in"
              value={form.email}
              aria-invalid={Boolean(emailError)}
              onChange={set('email')}
              onBlur={blur('email')}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="signup-password"
            error={passwordError}
            hint="At least 8 characters, with a letter and a number."
          >
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              aria-invalid={Boolean(passwordError)}
              onChange={set('password')}
              onBlur={blur('password')}
            />
          </Field>

          <Field label="Confirm password" htmlFor="confirm" error={confirmError}>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              aria-invalid={Boolean(confirmError)}
              onChange={set('confirm')}
              onBlur={blur('confirm')}
            />
          </Field>

          <Button type="submit" variant="strong" disabled={busy} className="mt-2 w-full">
            {busy ? 'Creating your company…' : 'Create company account'}
          </Button>
          </form>
        )}

        <p className="t-caption mt-5 border-t border-border-soft pt-4 text-text-muted">
          This creates the company and makes you its first admin. You add your
          people afterwards — they never sign up themselves.
        </p>
      </AuthCard>
    </AuthLayout>
  )
}
