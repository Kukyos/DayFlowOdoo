import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  PresenceDot,
  Select,
  Spinner,
} from '@/components/ui'
import { useSession } from '@/context/session'
import { ATTENDANCE_CHANGED, useAppEvent } from '@/hooks/useAppEvent'
import { useAsync, useDebounced } from '@/hooks/useAsync'
import { buildReportingTree, teamSize } from '@/lib/team'
import type { TeamNode } from '@/lib/team'
import { listEmployees, listInactiveEmployees, reactivateEmployee } from '@/services/employees'
import { PRESENCE_LABEL, fullName } from '@/types/models'
import type { DirectoryEmployee, InactiveEmployee } from '@/types/models'
import directoryIllustration from '@/assets/employee-directory-illustration.png'

/**
 * The employee directory — the hero screen.
 *
 * Calls `list_employee_directory()`, which returns only safe columns. No wage, no
 * bank details, no leave balance ever reaches this page, because they are not
 * on the type it receives.
 */
export function Directory() {
  const { isPrivileged } = useSession()
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [view, setView] = useState<'cards' | 'team'>('cards')
  const [showInactive, setShowInactive] = useState(false)
  const q = useDebounced(search)

  const { status, data, error, reload } = useAsync(
    () => listEmployees(),
    [],
  )
  useAppEvent(ATTENDANCE_CHANGED, reload)
  const availableDepartments = [
    ...new Set(
      (data ?? [])
        .map((employee) => employee.department)
        .filter((department): department is string => Boolean(department)),
    ),
  ]
  const employees = useMemo(() => {
    const normalized = q.trim().toLowerCase()
    return (data ?? [])
      .filter((employee) => !department || employee.department === department)
      .filter((employee) =>
        !normalized ||
        `${employee.first_name} ${employee.last_name}`.toLowerCase().includes(normalized) ||
        (employee.job_position ?? '').toLowerCase().includes(normalized) ||
        (employee.department ?? '').toLowerCase().includes(normalized) ||
        (employee.location ?? '').toLowerCase().includes(normalized),
      )
  }, [data, department, q])

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle="Everyone in your company, and whether they are in today."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={view === 'cards' ? 'strong' : 'default'} onClick={() => setView('cards')}>
              Cards
            </Button>
            <Button size="sm" variant={view === 'team' ? 'strong' : 'default'} onClick={() => setView('team')}>
              Team
            </Button>
            {isPrivileged && (
              <>
                <Button size="sm" onClick={() => setShowInactive(true)}>
                  Deactivated
                </Button>
                <Link to="/employees/new">
                  <Button size="sm" variant="strong">Add employee</Button>
                </Link>
              </>
            )}
          </div>
        }
      />

      {isPrivileged && showInactive && (
        <InactiveEmployees onClose={() => setShowInactive(false)} onReactivated={reload} />
      )}

      {view === 'team' && status === 'ready' && <TeamView people={data} />}

      <div className={view === 'team' ? 'hidden' : 'mb-6 flex flex-wrap gap-3'}>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, position, team or location"
          aria-label="Search employees"
          className="max-w-sm"
        />
        <Select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          aria-label="Filter by department"
          className="max-w-[200px]"
        >
          <option value="">All departments</option>
          {availableDepartments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      </div>

      {status === 'loading' && <Spinner label="Loading the directory" />}
      {status === 'error' && <ErrorState message={error} onRetry={reload} />}

      {status === 'ready' && view === 'cards' &&
        (employees.length === 0 ? (
          <EmptyState
            title="Nobody matches that"
            body="Try a different name, team or location — or clear the filters to see everyone."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setSearch('')
                  setDepartment('')
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <p className="t-caption mb-4 text-text-muted">
              {employees.length} {employees.length === 1 ? 'person' : 'people'}
              {' · '}
              {employees.filter((e) => e.presence === 'present').length} in the office today
            </p>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {employees.map((e) => (
                <Card as="li" key={e.id} className="transition-colors hover:bg-neutral-fill">
                  <Link
                    to={`/employees/${e.id}`}
                    className="flex h-full flex-col gap-4 rounded-card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Avatar name={`${e.first_name} ${e.last_name}`} src={e.avatar_url} size={52} />
                      <PresenceDot presence={e.presence} />
                    </div>
                    <div>
                      <p className="t-h3">
                        {e.first_name} {e.last_name}
                      </p>
                      <p className="t-caption mt-1 text-text-muted">{e.job_position}</p>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border-soft pt-3">
                      <span className="t-label text-text-muted">
                        {[e.department, e.location].filter(Boolean).join(' · ') || 'No team set'}
                      </span>
                    </div>
                    <span className="sr-only">{PRESENCE_LABEL[e.presence]}</span>
                  </Link>
                </Card>
              ))}
            </ul>
          </>
        ))}

      {/*
        Normal document flow, not absolute or fixed — this image is taller
        (natively ~560x300, rendered up to 960px wide) than a short directory
        page's real content, so any "pin to the bottom of a box" trick
        necessarily pokes up above wherever that box's top happens to be. In a
        two-row directory that meant overlapping the card grid; in a one-row
        directory it would poke above the page header entirely. Letting it sit
        in flow after the grid means it only ever adds height below the real
        content — never overlaps it, regardless of how many employees there
        are.

        `w-full` (not a `vw` unit): a normal-flow block sizes against its own
        container, not the viewport — `main` is padded and capped at 1440px,
        so a viewport-relative width here would overflow it and cause a
        horizontal scrollbar. The old `vw` sizing was only correct back when
        this broke out to `fixed`/`absolute` positioning.

        Left edge flush against the container's own padding (no extra offset):
        the source PNG crops its leftmost figure at the canvas edge, so any
        positive offset just adds dead space in front of an already-cropped
        figure — flush reads as an intentional bleed, not a mistake.
      */}
      <img
        src={directoryIllustration}
        alt=""
        aria-hidden="true"
        className="pointer-events-none mt-10 block w-full max-w-[720px] select-none"
      />
    </>
  )
}

/** The reporting tree, built from each person's manager. */
function TeamView({ people }: { people: DirectoryEmployee[] }) {
  const tree = useMemo(() => buildReportingTree(people), [people])

  if (people.length === 0) {
    return <EmptyState title="Nobody here yet" body="Add employees and set their managers to see the team." />
  }
  return (
    <Card className="mb-6">
      <p className="t-caption mb-4 text-text-muted">
        Who reports to whom, from each profile's manager. Admin/HR set managers on the Work Info tab.
      </p>
      <ul className="flex flex-col gap-1">
        {tree.map((node) => (
          <TeamBranch key={node.person.id} node={node} />
        ))}
      </ul>
    </Card>
  )
}

function TeamBranch({ node }: { node: TeamNode<DirectoryEmployee> }) {
  const { person, reports } = node
  const size = teamSize(node)
  return (
    <li>
      <Link
        to={`/employees/${person.id}`}
        className="flex items-center gap-3 rounded-control px-2 py-2 hover:bg-neutral-fill"
      >
        <Avatar name={fullName(person)} src={person.avatar_url} size={36} />
        <span className="min-w-0">
          <span className="block t-caption font-medium">{fullName(person)}</span>
          <span className="block t-label font-normal normal-case text-text-muted">
            {person.job_position ?? 'No position set'}
            {size > 0 && ` · ${size} ${size === 1 ? 'person' : 'people'} in team`}
          </span>
        </span>
        <span className="ml-auto">
          <PresenceDot presence={person.presence} />
        </span>
        <span className="sr-only">{PRESENCE_LABEL[person.presence]}</span>
      </Link>
      {reports.length > 0 && (
        <ul className="ml-5 flex flex-col gap-1 border-l border-border-soft pl-3">
          {reports.map((report) => (
            <TeamBranch key={report.person.id} node={report} />
          ))}
        </ul>
      )}
    </li>
  )
}

/** Admin/HR: deactivated people, with a way back in. Mounted only while open. */
function InactiveEmployees({
  onClose,
  onReactivated,
}: {
  onClose: () => void
  onReactivated: () => void
}) {
  const list = useAsync(() => listInactiveEmployees(), [])
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)
  const people: InactiveEmployee[] | null = list.data

  async function reactivate(id: string) {
    setActing(id)
    setError(null)
    try {
      await reactivateEmployee(id)
      list.reload()
      onReactivated()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reactivate that employee.')
    } finally {
      setActing(null)
    }
  }

  return (
    <Modal open onClose={onClose} title="Deactivated employees">
      {error && <p role="alert" className="mb-3 t-caption text-danger-ink">{error}</p>}
      {list.status === 'loading' && <Spinner label="Loading deactivated employees" />}
      {list.status === 'error' && <ErrorState message={list.error} onRetry={list.reload} />}
      {people?.length === 0 && (
        <p className="t-caption py-4 text-text-muted">Nobody is deactivated. Everyone on the payroll can sign in.</p>
      )}
      {people && people.length > 0 && (
        <ul>
          {people.map((person) => (
            <li key={person.id} className="flex items-center gap-3 border-b border-border-soft py-3 last:border-0">
              <Avatar name={fullName(person)} src={person.avatar_url} size={32} />
              <div className="min-w-0">
                <p className="t-caption">{fullName(person)}</p>
                <p className="t-label mt-0.5 font-normal normal-case text-text-muted">
                  {[person.job_position, person.department].filter(Boolean).join(' · ') || person.work_email}
                </p>
              </div>
              <Button
                size="sm"
                className="ml-auto"
                disabled={acting === person.id}
                onClick={() => { void reactivate(person.id) }}
              >
                {acting === person.id ? 'Reactivating…' : 'Reactivate'}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="t-caption mt-4 text-text-muted">
        A reactivated employee signs in with their existing password. Reset it from their profile if they have
        forgotten it.
      </p>
    </Modal>
  )
}
