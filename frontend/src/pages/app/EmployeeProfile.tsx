import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Avatar,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Spinner,
  Tabs,
  Textarea,
  cx,
} from '@/components/ui'
import { ResumeUpload } from '@/components/profile/ResumeUpload'
import { useSession } from '@/context/session'
import { useAsync } from '@/hooks/useAsync'
import { formatDate } from '@/lib/dates'
import { computeSalary, formatRupees, MINIMUM_WAGE } from '@/lib/salary'
import {
  deactivateEmployee,
  deleteAvatar,
  getEmployee,
  updateEmployee,
  uploadAvatar,
} from '@/services/employees'
import { fullName, isFullEmployee } from '@/types/models'
import type { DirectoryEmployee, Employee } from '@/types/models'

/**
 * One page for three cases: my own profile, a coworker's profile, and an
 * admin looking at anybody.
 *
 * What separates them is not a prop — it is what the service returns. A
 * coworker's row arrives with the private and salary columns already null,
 * because that is what RLS will do. The tabs are built from what is present, so
 * a restricted field cannot be rendered by accident.
 */
export function EmployeeProfile({ self = false }: { self?: boolean }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { employee: me, isPrivileged, refreshEmployee } = useSession()
  const targetId = self ? me?.id : id
  const [actionError, setActionError] = useState<string | null>(null)

  const { status, data, error, reload } = useAsync(
    async () => {
      if (!targetId || !me) throw new Error('Not signed in.')
      return getEmployee(targetId)
    },
    [targetId, me?.id, me?.role],
  )

  if (status === 'loading') return <Spinner label="Loading the profile" />
  if (status === 'error') return <ErrorState message={error} onRetry={reload} />

  return (
    <ProfileBody
      employee={data.employee}
      presence={data.presence}
      isSelf={data.employee.id === me?.id}
      isPrivileged={isPrivileged}
      actionError={actionError}
      onDeactivate={async () => {
        if (!window.confirm(`Deactivate ${fullName(data.employee)}? They will lose access immediately.`)) return
        setActionError(null)
        try {
          await deactivateEmployee(data.employee.id)
          navigate('/employees', { replace: true })
        } catch (cause) {
          setActionError(cause instanceof Error ? cause.message : 'Could not deactivate that employee.')
        }
      }}
      onSaved={() => {
        reload()
        void refreshEmployee()
      }}
    />
  )
}

function ProfileBody({
  employee,
  presence,
  isSelf,
  isPrivileged,
  actionError,
  onDeactivate,
  onSaved,
}: {
  employee: Employee | DirectoryEmployee
  presence: 'present' | 'leave' | 'absent'
  isSelf: boolean
  isPrivileged: boolean
  actionError: string | null
  onDeactivate: () => Promise<void>
  onSaved: () => void
}) {
  // A tab exists only when the caller may see what is on it. The Salary Info
  // tab is admin-only per docs/SCHEMA.md, so for an employee it is absent —
  // not present-and-empty, which would just look broken.
  const tabs = useMemo(() => {
    const list = [
      { id: 'work', label: 'Work Info' },
      { id: 'resume', label: 'Resume' },
    ]
    if (isFullEmployee(employee)) list.push({ id: 'private', label: 'Private Info' })
    // Own salary is readable; only Admin/HR can change it (TASKS 3.4). A
    // coworker gets no tab at all, because the service returns their wage as
    // null — the tab would be empty, which reads as broken rather than denied.
    if (isFullEmployee(employee)) list.push({ id: 'salary', label: 'Salary Info' })
    return list
  }, [employee])

  const [tab, setTab] = useState('work')
  const active = tabs.some((t) => t.id === tab) ? tab : 'work'

  return (
    <>
      <PageHeader
        title={isSelf ? 'My Profile' : fullName(employee)}
        subtitle={
          [employee.job_position, employee.department].filter(Boolean).join(' · ') ||
          undefined
        }
        actions={
          !isSelf && (
            <div className="flex gap-2">
              {isPrivileged && isFullEmployee(employee) && employee.is_active && (
                <Button size="sm" variant="danger" onClick={() => { void onDeactivate() }}>
                  Deactivate
                </Button>
              )}
              <Link to="/employees">
                <Button size="sm">Back to directory</Button>
              </Link>
            </div>
          )
        }
      />

      {actionError && <p role="alert" className="mb-4 t-caption text-danger-ink">{actionError}</p>}

      <Card className="mb-8">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex flex-col items-center gap-2">
            <Avatar name={fullName(employee)} src={employee.avatar_url} size={76} />
            {isSelf && isFullEmployee(employee) && (
              <AvatarUpload employee={employee} onSaved={onSaved} />
            )}
          </div>
          <div className="min-w-0">
            <p className="t-h2">{fullName(employee)}</p>
            <p className="t-caption mt-1 text-text-muted">
              {employee.job_position} · {employee.location}
            </p>
          </div>
          <div className="ml-auto flex flex-col items-end gap-2">
            <span className="t-label text-text-muted">{presence === 'present' ? 'In today' : presence === 'leave' ? 'On leave' : 'Not in today'}</span>
            {isFullEmployee(employee) && employee.date_of_joining && (
              <span className="t-caption text-text-muted">
                Joined {formatDate(employee.date_of_joining)}
              </span>
            )}
          </div>
        </div>
      </Card>

      <Tabs tabs={tabs} active={active} onChange={setTab} />

      <div className="py-8">
        {active === 'work' && <WorkInfo employee={employee} />}
        {active === 'resume' && (
          <Resume employee={employee} editable={isSelf} onSaved={onSaved} />
        )}
        {active === 'private' && isFullEmployee(employee) && (
          <PrivateInfo employee={employee} editable={isSelf || isPrivileged} onSaved={onSaved} />
        )}
        {active === 'salary' && isFullEmployee(employee) && (
          <SalaryInfo employee={employee} editable={isPrivileged} onSaved={onSaved} />
        )}
      </div>
    </>
  )
}

function AvatarUpload({ employee, onSaved }: { employee: Employee; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function select(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    let avatarUrl: string | null = null
    try {
      avatarUrl = await uploadAvatar(file)
      await updateEmployee(employee.id, { avatar_url: avatarUrl })
      if (employee.avatar_url) void deleteAvatar(employee.avatar_url).catch(() => undefined)
      onSaved()
    } catch (cause) {
      if (avatarUrl) void deleteAvatar(avatarUrl).catch(() => undefined)
      setError(cause instanceof Error ? cause.message : 'Could not update your avatar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="text-center">
      <label className="cursor-pointer t-label text-text-muted hover:text-text">
        {busy ? 'Uploading…' : 'Change photo'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(event) => { void select(event.target.files?.[0]) }}
        />
      </label>
      {error && <p role="alert" className="mt-1 max-w-40 t-label text-danger-ink">{error}</p>}
    </div>
  )
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */

const Row = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="flex flex-col gap-1 border-b border-border-soft py-3 sm:flex-row sm:items-baseline sm:gap-6">
    <span className="t-label w-52 shrink-0 text-text-muted">{label}</span>
    <span className={cx('t-body', !value && 'text-text-muted')}>{value || '—'}</span>
  </div>
)

function WorkInfo({ employee }: { employee: Employee | DirectoryEmployee }) {

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Card>
        <h2 className="t-h3 mb-3">Work</h2>
        <Row label="Job position" value={employee.job_position} />
        <Row label="Department" value={employee.department} />
        <Row label="Location" value={employee.location} />
        <Row label="Work email" value={employee.work_email} />
        {isFullEmployee(employee) && <Row label="Mobile" value={employee.mobile} />}
        <Row label="Manager" value={employee.manager_id ? 'Assigned' : 'No manager on record'} />
      </Card>
    </div>
  )
}

function Resume({
  employee,
  editable,
  onSaved,
}: {
  employee: Employee | DirectoryEmployee
  editable: boolean
  onSaved: () => void
}) {
  const [about, setAbout] = useState(employee.about ?? '')
  const [skills, setSkills] = useState((employee.skills ?? []).join(', '))
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setSaved(false)
    setError(null)
    try {
      await updateEmployee(employee.id, {
        about,
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
      })
      setSaved(true)
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your resume.')
    } finally {
      setBusy(false)
    }
  }

  if (!editable) {
    return (
      <div className="flex flex-col gap-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <Card>
            <h2 className="t-h3 mb-3">About</h2>
            <p className="t-body text-text-muted">{employee.about || 'Nothing here yet.'}</p>
          </Card>
          <Card>
            <h2 className="t-h3 mb-4">Skills</h2>
            <SkillList skills={employee.skills} />
          </Card>
        </div>
        <Card>
          <ResumeUpload employeeId={employee.id} editable={false} />
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 lg:grid-cols-2">
      <Card>
        <h2 className="t-h3 mb-4">About</h2>
        <Field label="A short introduction" htmlFor="about">
          <Textarea id="about" value={about} onChange={(e) => setAbout(e.target.value)} />
        </Field>
        <Field
          label="Skills"
          htmlFor="skills"
          hint="Separate them with commas."
          className="mt-4"
        >
          <Input id="skills" value={skills} onChange={(e) => setSkills(e.target.value)} />
        </Field>
        <div className="mt-4 flex items-center gap-3">
          <Button variant="strong" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          {saved && <span className="t-caption text-text-muted">Saved.</span>}
        </div>
        {error && <p role="alert" className="mt-3 t-caption text-danger-ink">{error}</p>}
      </Card>
      <Card>
        <h2 className="t-h3 mb-4">Preview</h2>
        <p className="t-body">{about || 'Nothing here yet.'}</p>
        <div className="mt-5">
          <SkillList skills={skills.split(',').map((s) => s.trim()).filter(Boolean)} />
        </div>
      </Card>
      </div>
      <Card>
        <ResumeUpload employeeId={employee.id} editable={editable} />
      </Card>
    </div>
  )
}

const SkillList = ({ skills }: { skills: string[] | null }) =>
  !skills || skills.length === 0 ? (
    <p className="t-caption text-text-muted">No skills listed yet.</p>
  ) : (
    <ul className="flex flex-wrap gap-2">
      {skills.map((s) => (
        <li
          key={s}
          className="rounded-control border border-border px-2.5 py-1 t-label"
        >
          {s}
        </li>
      ))}
    </ul>
  )

function PrivateInfo({
  employee,
  editable,
  onSaved,
}: {
  employee: Employee
  editable: boolean
  onSaved: () => void
}) {
  const [address, setAddress] = useState(employee.address ?? '')
  const [mobile, setMobile] = useState(employee.mobile ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(employee.date_of_birth ?? '')
  const [panNo, setPanNo] = useState(employee.pan_no ?? '')
  const [uanNo, setUanNo] = useState(employee.uan_no ?? '')
  const [bankAccountNumber, setBankAccountNumber] = useState(employee.bank_account_number ?? '')
  const [ifscCode, setIfscCode] = useState(employee.ifsc_code ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await updateEmployee(employee.id, {
        address: address.trim() || null,
        mobile: mobile.trim() || null,
        date_of_birth: dateOfBirth || null,
        pan_no: panNo.trim() || null,
        uan_no: uanNo.trim() || null,
        bank_account_number: bankAccountNumber.trim() || null,
        ifsc_code: ifscCode.trim() || null,
      })
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save private information.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Card>
        <h2 className="t-h3 mb-3">Personal</h2>
        {editable ? (
          <>
            <Field label="Mobile" htmlFor="mobile" className="mt-4">
              <Input
                id="mobile"
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />
            </Field>
            <Field label="Date of birth" htmlFor="date-of-birth" className="mt-4">
              <Input
                id="date-of-birth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </Field>
            <Field label="PAN" htmlFor="pan" className="mt-4">
              <Input id="pan" value={panNo} onChange={(e) => setPanNo(e.target.value)} />
            </Field>
            <Field label="UAN" htmlFor="uan" className="mt-4">
              <Input id="uan" value={uanNo} onChange={(e) => setUanNo(e.target.value)} />
            </Field>
            <Field label="Address" htmlFor="address" className="mt-4">
              <Textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>
            <Button variant="strong" className="mt-4" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
            {error && <p role="alert" className="mt-3 t-caption text-danger-ink">{error}</p>}
          </>
        ) : (
          <>
            <Row label="Mobile" value={employee.mobile} />
            <Row label="Address" value={employee.address} />
          </>
        )}
      </Card>

      <Card>
        <h2 className="t-h3 mb-3">Bank</h2>
        {editable ? (
          <>
            <Field label="Account number" htmlFor="bank-account-number">
              <Input
                id="bank-account-number"
                inputMode="numeric"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
              />
            </Field>
            <Field label="IFSC" htmlFor="ifsc" className="mt-4">
              <Input id="ifsc" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} />
            </Field>
          </>
        ) : (
          <>
            <Row label="Account number" value={employee.bank_account_number} />
            <Row label="IFSC" value={employee.ifsc_code} />
          </>
        )}
        <p className="t-caption mt-4 text-text-muted">
          Bank details are visible only to you and to HR. They are never part of
          the company directory.
        </p>
      </Card>
    </div>
  )
}

/**
 * The salary structure — admin and HR only, and the one screen in this build
 * that is more than a form over a table.
 *
 * There is one input, the monthly wage. Everything below it is derived by
 * `lib/salary.ts` and recomputes as you type, with no save round-trip. The
 * components always total the wage exactly, because Fixed Allowance is the
 * remainder and absorbs the rounding.
 */
function SalaryInfo({
  employee,
  editable,
  onSaved,
}: {
  employee: Employee
  editable: boolean
  onSaved: () => void
}) {
  const [wage, setWage] = useState(employee.monthly_wage ?? 0)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const breakdown = useMemo(() => computeSalary(wage), [wage])

  async function save() {
    setBusy(true)
    setSaved(false)
    setError(null)
    try {
      await updateEmployee(employee.id, { monthly_wage: wage })
      setSaved(true)
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the wage.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
      <div className="flex flex-col gap-5">
        <Card>
          <h2 className="t-h3 mb-4">Monthly wage</h2>
          {editable ? (
            <>
              <Field
                label="Wage"
                htmlFor="wage"
                hint="Every component below is derived from this one figure."
                error={
                  breakdown.isValid
                    ? null
                    : `Too low for this structure — the fixed components alone exceed it. Minimum is ${formatRupees(MINIMUM_WAGE)}.`
                }
              >
                <Input
                  id="wage"
                  type="number"
                  min={0}
                  step={1000}
                  value={wage || ''}
                  aria-invalid={!breakdown.isValid}
                  onChange={(e) => setWage(Number(e.target.value))}
                  className="t-data"
                />
              </Field>
              <div className="mt-4 flex items-center gap-3">
                <Button
                  variant="strong"
                  onClick={save}
                  disabled={busy || !breakdown.isValid}
                >
                  {busy ? 'Saving…' : 'Save wage'}
                </Button>
                {saved && <span className="t-caption text-text-muted">Saved.</span>}
              </div>
              {error && <p role="alert" className="mt-3 t-caption text-danger-ink">{error}</p>}
            </>
          ) : (
            <>
              <p className="t-data text-3xl">{formatRupees(wage)}</p>
              <p className="t-caption mt-2 text-text-muted">
                Your wage is set by HR. Everything below is derived from it.
              </p>
            </>
          )}
        </Card>

        <Card>
          <h2 className="t-h3 mb-3">Net pay</h2>
          <p className="t-data text-4xl">{formatRupees(breakdown.net)}</p>
          <p className="t-caption mt-2 text-text-muted">
            Gross {formatRupees(breakdown.gross)} less {formatRupees(breakdown.totalDeductions)}{' '}
            in deductions.
          </p>
        </Card>
      </div>

      <div className="flex flex-col gap-5">
        <Card>
          <h2 className="t-h3 mb-4">Earnings</h2>
          <LineTable lines={breakdown.earnings} total={['Gross', breakdown.gross]} />
        </Card>
        <Card>
          <h2 className="t-h3 mb-4">Deductions</h2>
          <LineTable
            lines={breakdown.deductions}
            total={['Total deductions', breakdown.totalDeductions]}
          />
        </Card>
        <Card>
          <h2 className="t-h3 mb-1">Employer cost</h2>
          <p className="t-caption mb-3 text-text-muted">
            Paid by the company on top of the wage — never deducted from it.
          </p>
          <LineTable lines={breakdown.employerCost} />
        </Card>
      </div>
    </div>
  )
}

function LineTable({
  lines,
  total,
}: {
  lines: Array<{ name: string; amount: number; note: string }>
  total?: [string, number]
}) {
  return (
    <table className="w-full border-collapse">
      <tbody>
        {lines.map((l) => (
          <tr key={l.name}>
            <td className="border-b border-border-soft py-2.5 t-caption">
              {l.name}
              <span className="t-label ml-2 text-text-muted">{l.note}</span>
            </td>
            <td className="border-b border-border-soft py-2.5 text-right t-data">
              {formatRupees(l.amount)}
            </td>
          </tr>
        ))}
        {total && (
          <tr>
            <td className="pt-3 t-label">{total[0]}</td>
            <td className="pt-3 text-right t-data font-bold">{formatRupees(total[1])}</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
