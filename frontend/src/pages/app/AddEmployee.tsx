import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Field, Input, PageHeader, Select } from '@/components/ui'
import { useSession } from '@/context/session'
import { useAsync } from '@/hooks/useAsync'
import { today } from '@/lib/dates'
import { formatRupees, MINIMUM_WAGE, computeSalary } from '@/lib/salary'
import { createEmployee, listEmployees } from '@/services/employees'
import { fullName } from '@/types/models'
import type { Role } from '@/types/models'

/**
 * Admin/HR create an employee. This is the only way a person enters the
 * system — nobody self-registers (docs/AUTH.md §1).
 *
 * The employee signs in with their work email. The generated password is shown
 * **once**, at creation, and never again: it is not stored in plaintext, not
 * emailed from here, and not rendered on the profile afterwards.
 */
export function AddEmployee() {
  const { isPrivileged } = useSession()
  const navigate = useNavigate()
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const directory = useAsync(() => listEmployees(), [])

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    work_email: '',
    job_position: '',
    department: 'Engineering',
    location: 'Bengaluru',
    date_of_joining: today(),
    monthly_wage: 50000,
    manager_id: '',
    role: 'employee' as Role,
  })

  // A guard is a courtesy; RLS is the boundary. This one exists so a
  // non-privileged user who types the URL gets an explanation rather than a
  // form that will fail on submit.
  if (!isPrivileged) {
    return (
      <Card>
        <h1 className="t-h3">Not your page</h1>
        <p className="t-caption mt-2 text-text-muted">
          Only an admin or HR officer can add employees.
        </p>
        <Link to="/dashboard">
          <Button className="mt-4" size="sm">
            Back to dashboard
          </Button>
        </Link>
      </Card>
    )
  }

  const wageValid = computeSalary(form.monthly_wage).isValid
  const departmentOptions = Array.from(new Set([
    'Engineering',
    'Design',
    'HR',
    'Sales',
    'Support',
    ...((directory.data ?? []).map((employee) => employee.department).filter(Boolean) as string[]),
  ])).sort()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('Enter the full name.')
      return
    }
    if (!wageValid) {
      setError(`The wage must be at least ${formatRupees(MINIMUM_WAGE)}.`)
      return
    }
    setBusy(true)
    try {
      const { employee, temporaryPassword } = await createEmployee({
        ...form,
        manager_id: form.manager_id || null,
      })
      setCreated({
        name: fullName(employee),
        email: employee.work_email,
        // Generated server-side in the real flow and returned once. Never
        // stored in plaintext, never shown again after this screen.
        password: temporaryPassword,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create that employee.')
    } finally {
      setBusy(false)
    }
  }

  if (created) {
    return (
      <>
        <PageHeader title="Employee created" subtitle={`${created.name} can now sign in.`} />
        <Card className="max-w-xl">
          <p className="t-label text-text-muted">Sign-in email</p>
          <p className="mt-1 text-lg font-semibold">{created.email}</p>

          <p className="t-label mt-6 text-text-muted">Temporary password</p>
          <p className="t-data mt-1 text-2xl">{created.password}</p>

          <p className="t-caption mt-6 rounded-control border border-danger-ink px-3 py-2 text-danger-ink">
            Copy the temporary password now — it is shown once and cannot be retrieved. Share
            the email and password with {created.name}, who must change the password at first
            sign-in.
          </p>

          <div className="mt-6 flex gap-2">
            <Button variant="strong" onClick={() => navigate('/employees')}>
              Back to directory
            </Button>
            <Button onClick={() => setCreated(null)}>Add another</Button>
          </div>
        </Card>
      </>
    )
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({
      ...f,
      [k]: k === 'monthly_wage' ? Number(e.target.value) : e.target.value,
    }))

  return (
    <>
      <PageHeader
        title="Add employee"
        subtitle="The employee will sign in with their work email and a generated temporary password."
        actions={
          <Link to="/employees">
            <Button size="sm">Cancel</Button>
          </Link>
        }
      />

      <form onSubmit={submit} className="grid max-w-4xl gap-6 lg:grid-cols-2">
        {error && (
          <p
            role="alert"
            className="rounded-control border border-danger-ink px-3 py-2 t-caption text-danger-ink lg:col-span-2"
          >
            {error}
          </p>
        )}

        <Card>
          <h2 className="t-h3 mb-4">Person</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" htmlFor="first_name">
              <Input id="first_name" value={form.first_name} onChange={set('first_name')} />
            </Field>
            <Field label="Last name" htmlFor="last_name">
              <Input id="last_name" value={form.last_name} onChange={set('last_name')} />
            </Field>
          </div>
          <Field label="Work email" htmlFor="work_email" className="mt-4">
            <Input
              id="work_email"
              type="email"
              value={form.work_email}
              onChange={set('work_email')}
            />
          </Field>
          <Field label="Date of joining" htmlFor="date_of_joining" className="mt-4">
            <Input
              id="date_of_joining"
              type="date"
              value={form.date_of_joining}
              onChange={set('date_of_joining')}
            />
          </Field>
        </Card>

        <Card>
          <h2 className="t-h3 mb-4">Role</h2>
          <Field label="Job position" htmlFor="job_position">
            <Input id="job_position" value={form.job_position} onChange={set('job_position')} />
          </Field>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="Department" htmlFor="department">
              <Select id="department" value={form.department} onChange={set('department')}>
                {departmentOptions.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </Field>
            <Field label="Location" htmlFor="location">
              <Input id="location" value={form.location} onChange={set('location')} />
            </Field>
          </div>
          <Field label="Manager" htmlFor="manager_id" className="mt-4">
            <Select id="manager_id" value={form.manager_id} onChange={set('manager_id')}>
              <option value="">No manager</option>
              {(directory.data ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {fullName(e)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Access level"
            htmlFor="role"
            hint="HR and admin can see every salary. Choose carefully."
            className="mt-4"
          >
            <Select id="role" value={form.role} onChange={set('role')}>
              <option value="employee">Employee</option>
              <option value="hr">HR officer</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="t-h3 mb-4">Wage</h2>
          <div className="flex flex-wrap items-end gap-6">
            <Field
              label="Monthly wage"
              htmlFor="monthly_wage"
              error={
                wageValid ? null : `Minimum is ${formatRupees(MINIMUM_WAGE)} for this structure.`
              }
              className="w-56"
            >
              <Input
                id="monthly_wage"
                type="number"
                step={1000}
                value={form.monthly_wage || ''}
                aria-invalid={!wageValid}
                onChange={set('monthly_wage')}
                className="t-data"
              />
            </Field>
            {wageValid && (
              <p className="t-caption text-text-muted">
                Basic {formatRupees(computeSalary(form.monthly_wage).earnings[0].amount)} · Net{' '}
                {formatRupees(computeSalary(form.monthly_wage).net)} per month
              </p>
            )}
          </div>
        </Card>

        <div className="lg:col-span-2">
          <Button type="submit" variant="strong" disabled={busy}>
            {busy ? 'Creating…' : 'Create employee'}
          </Button>
        </div>
      </form>
    </>
  )
}
