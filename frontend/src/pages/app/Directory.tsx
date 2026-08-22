import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  PresenceDot,
  Select,
  Spinner,
} from '@/components/ui'
import { useSession } from '@/context/session'
import { useAsync, useDebounced } from '@/hooks/useAsync'
import { listEmployees } from '@/services/employees'
import { PRESENCE_LABEL } from '@/types/models'

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
  const q = useDebounced(search)

  const { status, data, error, reload } = useAsync(
    () => listEmployees({ search: q, department: department || undefined }),
    [q, department],
  )
  const availableDepartments = [
    ...new Set(
      (data ?? [])
        .map((employee) => employee.department)
        .filter((department): department is string => Boolean(department)),
    ),
  ]

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle="Everyone at Odoo India, and whether they are in today."
        actions={
          isPrivileged && (
            <Link to="/employees/new">
              <Button variant="strong">Add employee</Button>
            </Link>
          )
        }
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, role, team or location"
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

      {status === 'ready' &&
        (data.length === 0 ? (
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
              {data.length} {data.length === 1 ? 'person' : 'people'}
              {' · '}
              {data.filter((e) => e.presence === 'present').length} in the office today
            </p>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.map((e) => (
                <Card as="li" key={e.id} className="transition-colors hover:bg-neutral-fill">
                  <Link
                    to={`/employees/${e.id}`}
                    className="flex h-full flex-col gap-4 rounded-card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Avatar name={`${e.first_name} ${e.last_name}`} size={52} />
                      <PresenceDot presence={e.presence} />
                    </div>
                    <div>
                      <p className="t-h3">
                        {e.first_name} {e.last_name}
                      </p>
                      <p className="t-caption mt-1 text-text-muted">{e.job_position}</p>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border-soft pt-3">
                      <span className="t-label text-text-muted">{e.department}</span>
                      <span className="t-label text-text-muted">· {e.location}</span>
                    </div>
                    <span className="sr-only">{PRESENCE_LABEL[e.presence]}</span>
                  </Link>
                </Card>
              ))}
            </ul>
          </>
        ))}
    </>
  )
}
