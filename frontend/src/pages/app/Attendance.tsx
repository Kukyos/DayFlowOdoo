import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AttendanceChip,
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Spinner,
  StatCard,
  Table,
  Td,
  Th,
} from '@/components/ui'
import { useSession } from '@/context/session'
import { useAsync, useDebounced } from '@/hooks/useAsync'
import {
  addDays,
  addMonths,
  formatDate,
  formatHours,
  formatMonth,
  formatTime,
  isWeekend,
  monthKey,
  today,
  weekdayName,
} from '@/lib/dates'
import {
  attendanceSummary,
  companyAttendance,
  myAttendance,
} from '@/services/attendance'

/**
 * One route, two views — docs/AUTH.md: the page switches on the role rather
 * than living at two URLs.
 *
 * An employee sees their own month, day by day. Admin and HR see every employee
 * for one day, which is the shape the wireframe's admin list view has.
 */
export function Attendance() {
  const { isPrivileged } = useSession()
  const [mode, setMode] = useState<'mine' | 'company'>(isPrivileged ? 'company' : 'mine')

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={
          mode === 'mine'
            ? 'Your check-ins for the month, with any gaps shown as absences.'
            : 'Everyone in the company for a single day.'
        }
        actions={
          isPrivileged && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={mode === 'company' ? 'strong' : 'default'}
                onClick={() => setMode('company')}
              >
                Company
              </Button>
              <Button
                size="sm"
                variant={mode === 'mine' ? 'strong' : 'default'}
                onClick={() => setMode('mine')}
              >
                Mine
              </Button>
            </div>
          )
        }
      />
      {mode === 'mine' ? <MyAttendance /> : <CompanyAttendance />}
    </>
  )
}

function MyAttendance() {
  const { employee } = useSession()
  const [month, setMonth] = useState(monthKey(today()))

  const { status, data, error, reload } = useAsync(async () => {
    if (!employee) throw new Error('Not signed in.')
    const [days, summary] = await Promise.all([
      myAttendance(employee.id, month),
      attendanceSummary(employee.id, month),
    ])
    return { days, summary }
  }, [employee?.id, month])

  const isCurrentMonth = month === monthKey(today())

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
          ←
        </Button>
        <span className="t-h3 min-w-[190px] text-center">{formatMonth(month)}</span>
        <Button
          size="sm"
          onClick={() => setMonth(addMonths(month, 1))}
          disabled={isCurrentMonth}
          aria-label="Next month"
        >
          →
        </Button>
      </div>

      {status === 'loading' && <Spinner label="Loading your attendance" />}
      {status === 'error' && <ErrorState message={error} onRetry={reload} />}

      {status === 'ready' && (
        <>
          <div className="mb-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Present" value={`${data.summary.present}`} hint="working days" />
            <StatCard label="Half days" value={`${data.summary.halfDay}`} />
            <StatCard label="On leave" value={`${data.summary.leave}`} />
            <StatCard
              label="Absent"
              value={`${data.summary.absent}`}
              hint="no record, no leave"
            />
          </div>

          {data.days.length === 0 ? (
            <EmptyState
              title="Nothing recorded this month"
              body="Check in from the header and the day will appear here."
            />
          ) : (
            <Table
              head={
                <tr>
                  <Th>Date</Th>
                  <Th>Day</Th>
                  <Th>Check in</Th>
                  <Th>Check out</Th>
                  <Th right>Work hours</Th>
                  <Th>Status</Th>
                </tr>
              }
            >
              {data.days.map((d) => (
                <tr
                  key={d.work_date}
                  className={isWeekend(d.work_date) ? 'text-text-muted' : undefined}
                >
                  <Td data>{formatDate(d.work_date)}</Td>
                  <Td>{weekdayName(d.work_date)}</Td>
                  <Td data>{formatTime(d.check_in)}</Td>
                  <Td data>{formatTime(d.check_out)}</Td>
                  <Td data right>
                    {formatHours(d.work_hours)}
                  </Td>
                  <Td>
                    {isWeekend(d.work_date) ? (
                      <span className="t-label text-text-muted">Weekend</span>
                    ) : (
                      <AttendanceChip status={d.status} />
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </>
      )}
    </>
  )
}

function CompanyAttendance() {
  const [date, setDate] = useState(today())
  const [search, setSearch] = useState('')
  const q = useDebounced(search)

  const { status, data, error, reload } = useAsync(
    () => companyAttendance(date, { search: q }),
    [date, q],
  )

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          ←
        </Button>
        <span className="t-h3 min-w-[190px] text-center">{formatDate(date)}</span>
        <Button
          size="sm"
          onClick={() => setDate(addDays(date, 1))}
          disabled={date >= today()}
          aria-label="Next day"
        >
          →
        </Button>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employees"
          aria-label="Search employees"
          className="max-w-xs"
        />
      </div>

      {status === 'loading' && <Spinner label="Loading attendance" />}
      {status === 'error' && <ErrorState message={error} onRetry={reload} />}

      {status === 'ready' &&
        (data.length === 0 ? (
          <EmptyState title="Nobody matches that" body="Try a different name." />
        ) : (
          <>
            <p className="t-caption mb-4 text-text-muted">
              {data.filter((d) => d.check_in).length} of {data.length} checked in
              {isWeekend(date) && ' · this is a weekend'}
            </p>
            <Table
              head={
                <tr>
                  <Th>Employee</Th>
                  <Th>Check in</Th>
                  <Th>Check out</Th>
                  <Th right>Work hours</Th>
                  <Th>Status</Th>
                </tr>
              }
            >
              {data.map((d) => (
                <tr key={d.employee_id}>
                  <Td>
                    <Link
                      to={`/employees/${d.employee_id}`}
                      className="flex items-center gap-3 hover:underline"
                    >
                      <Avatar name={d.employee_name} size={30} />
                      {d.employee_name}
                    </Link>
                  </Td>
                  <Td data>{formatTime(d.check_in)}</Td>
                  <Td data>{formatTime(d.check_out)}</Td>
                  <Td data right>
                    {formatHours(d.work_hours)}
                  </Td>
                  <Td>
                    <AttendanceChip status={d.status} />
                  </Td>
                </tr>
              ))}
            </Table>
          </>
        ))}
    </>
  )
}
