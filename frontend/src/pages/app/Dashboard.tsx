import { Link } from 'react-router-dom'
import {
  Avatar,
  Button,
  Card,
  ErrorState,
  PresenceDot,
  Spinner,
  StatCard,
  StatusChip,
} from '@/components/ui'
import { useSession } from '@/context/session'
import { useAsync } from '@/hooks/useAsync'
import { formatDate, formatTime } from '@/lib/dates'
import { getDashboardSummary } from '@/services/dashboard'
import { LEAVE_TYPE_LABEL } from '@/types/models'
import boyGreeting from '@/assets/employee-boy-greeting.png'
import dashboardIllustration from '@/assets/dashboard-support-illustration.png'
import girlGreeting from '@/assets/employee-girl-greeting.png'

/**
 * Picks a greeting mascot per employee. Athira/Pooja's original picked from a
 * hardcoded set of fixture ids ('e-01', 'e-03', ...) — meaningless now that
 * employee.id is a real Supabase UUID, so every real user would have fallen
 * through to the same image. A stable hash of the real id keeps the intent
 * (some visual variety across people) without depending on fixture data.
 */
function greetingImageFor(employeeId: string | undefined): string {
  if (!employeeId) return boyGreeting
  let hash = 0
  for (let i = 0; i < employeeId.length; i += 1) {
    hash = (hash * 31 + employeeId.charCodeAt(i)) | 0
  }
  return hash % 2 === 0 ? girlGreeting : boyGreeting
}

export function Dashboard() {
  const { employee, isPrivileged } = useSession()

  const { status, data, error, reload } = useAsync(async () => {
    if (!employee) throw new Error('Not signed in.')
    return getDashboardSummary()
  }, [employee?.id, isPrivileged])

  if (status === 'loading') return <Spinner label="Loading your dashboard" />
  if (status === 'error') return <ErrorState message={error} onRetry={reload} />

  const inOffice = data.inOffice

  return (
    <div className="relative isolate">
      {/*
        Pinned to the actual browser viewport corner — position: fixed, not
        absolute — so it never depends on how tall the dashboard content is.
        The old version was glued to the bottom of a `min-h-[calc(100vh-9rem)]`
        wrapper; on any page shorter than that forced height, the gap between
        the real content and the (correctly flush) illustration read as dead
        space. Fixed positioning removes the "flush against what, exactly?"
        question entirely — X = `right-*`, Y = `bottom-*`, both below.
      */}
      <img
        src={dashboardIllustration}
        alt=""
        aria-hidden="true"
        className="pointer-events-none fixed bottom-0 right-0 -z-10 w-[275px] select-none sm:right-4 sm:w-[325px] lg:right-8 lg:w-[350px]"
      />

      <div className="mb-3">
        <h1 className="t-h1">Good to see you, {employee?.first_name}</h1>
        <p className="t-caption mt-2 text-text-muted">
          {data.today.row?.check_in
            ? `Checked in at ${formatTime(data.today.row.check_in)}${
                data.today.row.check_out
                  ? `, out at ${formatTime(data.today.row.check_out)}.`
                  : ' — still in.'
              }`
            : 'You have not checked in today. The control is in the header.'}
        </p>
      </div>

      {/*
        The greeting mascot sits behind the last stat card (top-right of this
        row), not in the header. `relative` here is the anchor both the image
        and the grid share.

        X = `right-[…]` (distance from the row's right edge — the card the
            image should center behind is the rightmost one, so this is
            roughly half the card's width, nudged so the head/wave clears the
            card's edge rather than hiding dead-center behind it)
        Y = `top-[…]` (distance down from the row's top — roughly half the
            card's ~112px height, so the image is vertically centered on it)

        Both are `lg:` only. Below `lg` the grid drops to 2 or 1 columns and
        "last card" stops meaning "top-right", so the image would land behind
        the wrong card — hidden there rather than guessing.
      */}
      <div className="relative">
        <img
          src={greetingImageFor(employee?.id)}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -z-10 hidden h-40 w-40 select-none object-contain lg:right-6 lg:-top-20 lg:block"
        />

        <div className="mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {isPrivileged ? (
          <>
            <StatCard label="Headcount" value={`${data.company?.headcount ?? 0}`} hint="active employees" />
            <StatCard
              label="In the office"
              value={`${data.company?.presentToday ?? 0}`}
              hint={`${data.company?.onLeaveToday ?? 0} on leave`}
            />
            <StatCard
              label="Awaiting approval"
              value={`${data.company?.pendingLeave ?? 0}`}
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {isPrivileged && (
          <Card className="bg-surface/85 backdrop-blur-[1px]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="t-h3">Waiting on you</h2>
              <Link to="/time-off/approvals">
                <Button size="sm">Review all</Button>
              </Link>
            </div>
            {data.pendingRequests.length === 0 ? (
              <p className="t-caption py-6 text-text-muted">
                Nothing to approve. Every request has been dealt with.
              </p>
            ) : (
              <ul>
                {data.pendingRequests.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 border-b border-border-soft py-3 last:border-0"
                  >
                    <Avatar name={r.employee_name} src={r.avatar_url} size={32} />
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

        <Card className="bg-surface/85 backdrop-blur-[1px]">
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
                    <Avatar name={`${e.first_name} ${e.last_name}`} src={e.avatar_url} size={24} />
                    <span className="t-caption">{e.first_name}</span>
                    <PresenceDot presence={e.presence} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="bg-surface/85 backdrop-blur-[1px]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="t-h3">Your recent requests</h2>
            <Link to="/time-off">
              <Button size="sm">Time off</Button>
            </Link>
          </div>
          {data.recentRequests.length === 0 ? (
            <p className="t-caption py-6 text-text-muted">
              You have not requested any time off yet.
            </p>
          ) : (
            <ul>
              {data.recentRequests.map((r) => (
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
    </div>
  )
}
