import { Link } from 'react-router-dom'
import {
  Avatar,
  Button,
  Card,
  ErrorState,
  PageHeader,
  PresenceDot,
  Spinner,
  StatCard,
  StatusChip,
} from '@/components/ui'
import { useSession } from '@/context/session'
import { useAsync } from '@/hooks/useAsync'
import { formatDate, formatTime, monthKey, today } from '@/lib/dates'
import { attendanceSummary, todayStatus } from '@/services/attendance'
import { listEmployees } from '@/services/employees'
import { myBalances, myRequests, pendingRequests } from '@/services/timeOff'
import { LEAVE_TYPE_LABEL } from '@/types/models'

export function Dashboard() {
  const { employee, isPrivileged } = useSession()

  const { status, data, error, reload } = useAsync(async () => {
    if (!employee) throw new Error('Not signed in.')
    const [directory, attendance, balances, mine, pending] = await Promise.all([
      listEmployees(),
      attendanceSummary(employee.id, monthKey(today())),
      myBalances(employee.id),
      myRequests(employee.id),
      isPrivileged ? pendingRequests() : Promise.resolve([]),
    ])
    const status = await todayStatus(employee.id)
    return { directory, attendance, balances, mine, pending, status }
  }, [employee?.id, isPrivileged])

  if (status === 'loading') return <Spinner label="Loading your dashboard" />
  if (status === 'error') return <ErrorState message={error} onRetry={reload} />

  const inOffice = data.directory.filter((e) => e.presence === 'present')
  const onLeave = data.directory.filter((e) => e.presence === 'leave')

  return (
    <>
      <PageHeader
        title={`Good to see you, ${employee?.first_name}`}
        subtitle={
          data.status.row?.check_in
            ? `Checked in at ${formatTime(data.status.row.check_in)}${
                data.status.row.check_out
                  ? `, out at ${formatTime(data.status.row.check_out)}.`
                  : ' — still in.'
              }`
            : 'You have not checked in today. The control is in the header.'
        }
      />

      <div className="mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {isPrivileged ? (
          <>
            <StatCard label="Headcount" value={`${data.directory.length}`} hint="active employees" />
            <StatCard
              label="In the office"
              value={`${inOffice.length}`}
              hint={`${onLeave.length} on leave`}
            />
            <StatCard
              label="Awaiting approval"
              value={`${data.pending.length}`}
              hint="leave requests"
            />
            <StatCard
              label="Your attendance"
              value={`${data.attendance.present}`}
              hint="days present this month"
            />
          </>
        ) : (
          <>
            <StatCard
              label="Present"
              value={`${data.attendance.present}`}
              hint="days this month"
            />
            <StatCard label="Absent" value={`${data.attendance.absent}`} hint="days this month" />
            <StatCard label="Paid leave" value={data.balances.paid.toFixed(2)} hint="days left" />
            <StatCard label="Sick leave" value={data.balances.sick.toFixed(2)} hint="days left" />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {isPrivileged && (
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="t-h3">Waiting on you</h2>
              <Link to="/time-off">
                <Button size="sm">Review all</Button>
              </Link>
            </div>
            {data.pending.length === 0 ? (
              <p className="t-caption py-6 text-text-muted">
                Nothing to approve. Every request has been dealt with.
              </p>
            ) : (
              <ul>
                {data.pending.slice(0, 5).map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 border-b border-border-soft py-3 last:border-0"
                  >
                    <Avatar name={r.employee_name} size={32} />
                    <div className="min-w-0">
                      <p className="t-caption">{r.employee_name}</p>
                      <p className="t-label mt-0.5 font-normal normal-case text-text-muted">
                        {LEAVE_TYPE_LABEL[r.leave_type]} · {formatDate(r.start_date)} –{' '}
                        {formatDate(r.end_date)}
                      </p>
                    </div>
                    <span className="t-data ml-auto">{r.days.toFixed(2)}d</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="t-h3">In the office today</h2>
            <Link to="/employees">
              <Button size="sm">Directory</Button>
            </Link>
          </div>
          {inOffice.length === 0 ? (
            <p className="t-caption py-6 text-text-muted">Nobody has checked in yet today.</p>
          ) : (
            <ul className="flex flex-wrap gap-3">
              {inOffice.slice(0, 10).map((e) => (
                <li key={e.id}>
                  <Link
                    to={`/employees/${e.id}`}
                    className="flex items-center gap-2 rounded-control border border-border px-2.5 py-1.5 hover:bg-neutral-fill"
                  >
                    <Avatar name={`${e.first_name} ${e.last_name}`} size={24} />
                    <span className="t-caption">{e.first_name}</span>
                    <PresenceDot presence={e.presence} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="t-h3">Your recent requests</h2>
            <Link to="/time-off">
              <Button size="sm">Time off</Button>
            </Link>
          </div>
          {data.mine.length === 0 ? (
            <p className="t-caption py-6 text-text-muted">
              You have not requested any time off yet.
            </p>
          ) : (
            <ul>
              {data.mine.slice(0, 5).map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 border-b border-border-soft py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="t-caption">{LEAVE_TYPE_LABEL[r.leave_type]}</p>
                    <p className="t-label mt-0.5 font-normal normal-case text-text-muted">
                      {formatDate(r.start_date)} – {formatDate(r.end_date)}
                    </p>
                  </div>
                  <span className="ml-auto">
                    <StatusChip status={r.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
