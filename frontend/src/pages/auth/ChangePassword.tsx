import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'
import { Button, Card, Field, Input } from '@/components/ui'
import { useSession } from '@/context/session'
import { changePassword, passwordProblem, signOut } from '@/services/auth'

export function ChangePassword() {
  const navigate = useNavigate()
  const { employee, mustChangePassword, refreshEmployee } = useSession()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const problem = passwordProblem(password)
    if (problem) {
      setError(problem)
      return
    }
    if (password !== confirm) {
      setError('Both passwords must match.')
      return
    }

    setBusy(true)
    try {
      await changePassword(password)
      const refreshed = await refreshEmployee()
      if (!refreshed || refreshed.must_change_password) {
        throw new Error('Your password changed, but the account status could not be refreshed.')
      }
      navigate('/dashboard', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not change your password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-5 text-text">
      <Card className="w-full max-w-md">
        <p className="t-label text-text-muted">Dayflow account</p>
        <h1 className="t-h2 mt-2">{mustChangePassword ? 'Choose your password' : 'Change password'}</h1>
        <p className="t-caption mt-2 text-text-muted">
          {mustChangePassword
            ? 'Replace the temporary password before continuing to Dayflow.'
            : `Set a new password for ${employee?.work_email ?? 'your account'}.`}
        </p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          {error && (
            <p role="alert" className="rounded-control border border-danger-ink px-3 py-2 t-caption text-danger-ink">
              {error}
            </p>
          )}
          <Field
            label="New password"
            htmlFor="new-password"
            hint="At least 8 characters, with a letter and a number."
          >
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
            />
            <PasswordStrengthMeter password={password} />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm-password">
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </Field>
          <Button type="submit" variant="strong" disabled={busy}>
            {busy ? 'Saving…' : 'Save password'}
          </Button>
        </form>

        <Button
          type="button"
          variant="ghost"
          className="mt-4 w-full"
          onClick={async () => {
            setError(null)
            try {
              await signOut()
              navigate('/signin', { replace: true })
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : 'Could not log out.')
            }
          }}
        >
          Log out
        </Button>
      </Card>
    </main>
  )
}
