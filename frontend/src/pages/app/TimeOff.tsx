import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  StatusChip,
  Table,
  Td,
  Textarea,
  Th,
} from '@/components/ui'
import { YearCalendar } from '@/components/timeoff/YearCalendar'
import { useSession } from '@/context/session'
import { useAsync, useDebounced } from '@/hooks/useAsync'
import { addDays, formatDate, today, workingDaysBetween } from '@/lib/dates'
import {
  allRequests,
  cancelRequest,
  createRequest,
  deleteAttachment,
  myBalances,
  myRequests,
  reviewRequest,
  signedAttachmentUrl,
  uploadAttachment,
} from '@/services/timeOff'
import { LEAVE_TYPE_LABEL } from '@/types/models'
import type { LeaveRequest, LeaveStatus, LeaveType } from '@/types/models'

export function TimeOff() {
  const { isPrivileged } = useSession()
  const location = useLocation()
  const [mode, setMode] = useState<'mine' | 'approvals'>(
    isPrivileged && location.pathname.endsWith('/approvals') ? 'approvals' : 'mine',
  )

  return (
    <>
      <PageHeader
        title="Time Off"
        subtitle={
          mode === 'mine'
            ? 'Your balances and every request you have made.'
            : 'Every request in the company, and the ones waiting on you.'
        }
        actions={
          isPrivileged && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={mode === 'approvals' ? 'strong' : 'default'}
                onClick={() => setMode('approvals')}
              >
                Approvals
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
      {mode === 'mine' ? <MyTimeOff /> : <Approvals />}
    </>
  )
}

function MyTimeOff() {
  const { employee, refreshEmployee } = useSession()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'calendar' | 'list'>('calendar')

  const { status, data, error, reload } = useAsync(async () => {
    if (!employee) throw new Error('Not signed in.')
    const [balances, requests] = await Promise.all([
      myBalances(employee.id),
      myRequests(employee.id),
    ])
    return { balances, requests }
  }, [employee?.id])

  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)

  async function cancel(id: string) {
    setCancelling(id)
    setCancelError(null)
    try {
      await cancelRequest(id)
      reload()
    } catch (cause) {
      setCancelError(cause instanceof Error ? cause.message : 'Could not cancel that request.')
    } finally {
      setCancelling(null)
    }
  }

  return (
    <>
      {status === 'loading' && <Spinner label="Loading your time off" />}
      {status === 'error' && <ErrorState message={error} onRetry={reload} />}

      {status === 'ready' && (
        <>
          <div className="mb-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <BalanceCard label="Paid Time Off" days={data.balances.paid} />
            <BalanceCard label="Sick Leave" days={data.balances.sick} />
            <Card className="flex flex-col justify-between gap-4">
              <div>
                <p className="t-label text-text-muted">Unpaid Leave</p>
                <p className="t-caption mt-2 text-text-muted">
                  No allowance to draw on — request it whenever you need it.
                </p>
              </div>
              <Button variant="strong" onClick={() => setOpen(true)}>
                New request
              </Button>
            </Card>
          </div>

          {cancelError && (
            <p role="alert" className="mb-4 t-caption text-danger-ink">
              {cancelError}
            </p>
          )}

          <div className="mb-5 flex justify-end gap-2">
            <Button
              size="sm"
              variant={view === 'calendar' ? 'strong' : 'default'}
              onClick={() => setView('calendar')}
            >
              Calendar
            </Button>
            <Button
              size="sm"
              variant={view === 'list' ? 'strong' : 'default'}
              onClick={() => setView('list')}
            >
              List
            </Button>
          </div>

          {data.requests.length === 0 && view === 'list' ? (
            <EmptyState
              title="No requests yet"
              body="When you book time off it shows here, along with where it has got to."
              action={<Button size="sm" onClick={() => setOpen(true)}>New request</Button>}
            />
          ) : view === 'calendar' ? (
            <YearCalendar requests={data.requests} />
          ) : (
            <Table
              head={
                <tr>
                  <Th>Type</Th>
                  <Th>From</Th>
                  <Th>To</Th>
                  <Th right>Days</Th>
                  <Th>Status</Th>
                  <Th>Note</Th>
                  <Th>{''}</Th>
                </tr>
              }
            >
              {data.requests.map((r) => (
                <tr key={r.id}>
                  <Td>{LEAVE_TYPE_LABEL[r.leave_type]}</Td>
                  <Td data>{formatDate(r.start_date)}</Td>
                  <Td data>{formatDate(r.end_date)}</Td>
                  <Td data right>
                    {r.days.toFixed(2)}
                  </Td>
                  <Td>
                    <StatusChip status={r.status} />
                  </Td>
                  <Td>
                    <span className="text-text-muted">
                      {r.review_comment ?? r.remarks ?? '—'}
                    </span>
                    {r.attachment_url && <AttachmentLink path={r.attachment_url} />}
                  </Td>
                  <Td right>
                    {r.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={cancelling === r.id}
                        onClick={() => { void cancel(r.id) }}
                      >
                        {cancelling === r.id ? 'Cancelling…' : 'Cancel'}
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </>
      )}

      <RequestModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => {
          reload()
          void refreshEmployee()
        }}
      />
    </>
  )
}

const BalanceCard = ({ label, days }: { label: string; days: number }) => (
  <Card>
    <p className="t-label text-text-muted">{label}</p>
    <p className="t-data mt-2 text-4xl">{days.toFixed(2)}</p>
    <p className="t-caption mt-1 text-text-muted">days available</p>
  </Card>
)

function RequestModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const { employee } = useSession()
  const [type, setType] = useState<LeaveType>('paid')
  const [start, setStart] = useState(addDays(today(), 1))
  const [end, setEnd] = useState(addDays(today(), 1))
  const [remarks, setRemarks] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Weekends do not consume leave, so the count shown here is working days and
  // must match what the service computes — both call the same helper.
  const days = workingDaysBetween(start, end)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!employee) return
    setBusy(true)
    setError(null)
    let attachmentUrl: string | null = null
    try {
      attachmentUrl = type === 'sick' && attachment
        ? await uploadAttachment(attachment)
        : null
      await createRequest({
        employeeId: employee.id,
        leave_type: type,
        start_date: start,
        end_date: end,
        remarks,
        attachment_url: attachmentUrl,
      })
      onCreated()
      onClose()
      setRemarks('')
      setAttachment(null)
    } catch (err) {
      if (attachmentUrl) void deleteAttachment(attachmentUrl).catch(() => undefined)
      setError(err instanceof Error ? err.message : 'Could not submit that request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Request time off">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && (
          <p
            role="alert"
            className="rounded-control border border-danger-ink px-3 py-2 t-caption text-danger-ink"
          >
            {error}
          </p>
        )}

        <Field label="Type" htmlFor="type">
          <Select id="type" value={type} onChange={(e) => setType(e.target.value as LeaveType)}>
            {(Object.keys(LEAVE_TYPE_LABEL) as LeaveType[]).map((t) => (
              <option key={t} value={t}>
                {LEAVE_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="From" htmlFor="start">
            <Input
              id="start"
              type="date"
              value={start}
              onChange={(e) => {
                setStart(e.target.value)
                if (e.target.value > end) setEnd(e.target.value)
              }}
            />
          </Field>
          <Field label="To" htmlFor="end">
            <Input id="end" type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>

        <p className="t-caption text-text-muted">
          {days === 0
            ? 'That range contains no working days.'
            : `${days} working ${days === 1 ? 'day' : 'days'}. Weekends are not counted.`}
        </p>

        {type === 'sick' && (
          <Field
            label="Medical certificate"
            htmlFor="certificate"
            hint="Optional. PDF, JPG, or PNG up to 10 MB."
          >
            <Input
              id="certificate"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
            />
          </Field>
        )}

        <Field label="Remarks" htmlFor="remarks">
          <Textarea
            id="remarks"
            value={remarks}
            placeholder="Anything your manager should know."
            onChange={(e) => setRemarks(e.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Discard
          </Button>
          <Button type="submit" variant="strong" disabled={busy || days === 0}>
            {busy ? 'Submitting…' : 'Submit'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function Approvals() {
  const { refreshEmployee } = useSession()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<LeaveStatus | 'all'>('pending')
  const q = useDebounced(search)
  const [reviewing, setReviewing] = useState<LeaveRequest | null>(null)

  const { status, data, error: loadError, reload } = useAsync(
    () => allRequests({ search: q, status: filter }),
    [q, filter],
  )

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-3">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by employee"
          aria-label="Search requests"
          className="max-w-xs"
        />
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value as LeaveStatus | 'all')}
          aria-label="Filter by status"
          className="max-w-[180px]"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </Select>
      </div>

      {reviewing && (
        <ReviewModal
          request={reviewing}
          onClose={() => setReviewing(null)}
          onDecided={() => {
            setReviewing(null)
            reload()
            void refreshEmployee()
          }}
        />
      )}

      {status === 'loading' && <Spinner label="Loading requests" />}
      {status === 'error' && <ErrorState message={loadError} onRetry={reload} />}

      {status === 'ready' &&
        (data.length === 0 ? (
          <EmptyState
            title={filter === 'pending' ? 'Nothing waiting on you' : 'No requests here'}
            body={
              filter === 'pending'
                ? 'Every request has been dealt with. New ones appear here as they come in.'
                : 'Try a different status or clear the search.'
            }
          />
        ) : (
          <Table
            head={
              <tr>
                <Th>Employee</Th>
                <Th>Type</Th>
                <Th>From</Th>
                <Th>To</Th>
                <Th right>Days</Th>
                <Th>Status</Th>
                <Th>{''}</Th>
              </tr>
            }
          >
            {data.map((r) => (
              <tr key={r.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={r.employee_name} src={r.avatar_url} size={30} />
                    <div>
                      <p className="t-caption">{r.employee_name}</p>
                      {r.remarks && (
                        <p className="t-label mt-0.5 font-normal normal-case text-text-muted">
                          {r.remarks}
                        </p>
                      )}
                    </div>
                  </div>
                </Td>
                <Td>
                  {LEAVE_TYPE_LABEL[r.leave_type]}
                  {r.attachment_url && (
                    <AttachmentLink path={r.attachment_url} compact />
                  )}
                </Td>
                <Td data>{formatDate(r.start_date)}</Td>
                <Td data>{formatDate(r.end_date)}</Td>
                <Td data right>
                  {r.days.toFixed(2)}
                </Td>
                <Td>
                  <StatusChip status={r.status} />
                </Td>
                <Td right>
                  {r.status === 'pending' ? (
                    <Button size="sm" variant="strong" onClick={() => setReviewing(r)}>
                      Review
                    </Button>
                  ) : (
                    <span className="t-label text-text-muted" title={r.review_comment ?? undefined}>
                      Decided
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        ))}
    </>
  )
}

/**
 * One decision on one request. Shows what the reviewer needs — dates, working
 * days, the employee's remaining balance, remarks and certificate — and an
 * optional comment the employee sees with the outcome.
 */
function ReviewModal({
  request,
  onClose,
  onDecided,
}: {
  request: LeaveRequest
  onClose: () => void
  onDecided: () => void
}) {
  const [comment, setComment] = useState('')
  const [acting, setActing] = useState<'approved' | 'rejected' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const balances = useAsync(() => myBalances(request.employee_id), [request.employee_id])
  const balance =
    request.leave_type === 'paid' ? balances.data?.paid : request.leave_type === 'sick' ? balances.data?.sick : null

  async function decide(decision: 'approved' | 'rejected') {
    setActing(decision)
    setError(null)
    try {
      await reviewRequest(request.id, decision, comment)
      onDecided()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record that decision.')
      setActing(null)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Review ${request.employee_name}'s request`}>
      <div className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="rounded-control border border-danger-ink px-3 py-2 t-caption text-danger-ink">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Avatar name={request.employee_name} src={request.avatar_url} size={40} />
          <div>
            <p className="t-caption font-bold">{LEAVE_TYPE_LABEL[request.leave_type]}</p>
            <p className="t-label mt-0.5 font-normal normal-case text-text-muted">
              {formatDate(request.start_date)} – {formatDate(request.end_date)} ·{' '}
              {request.days} working {request.days === 1 ? 'day' : 'days'}
            </p>
          </div>
        </div>

        {balance !== null && (
          <p className="t-caption text-text-muted">
            {balances.status === 'ready' && balance !== undefined
              ? `${balance.toFixed(2)} ${request.leave_type} days left before this request` +
                (balance < request.days ? ' — not enough to approve it.' : '.')
              : 'Checking the remaining balance…'}
          </p>
        )}

        <div>
          <p className="t-label text-text-muted">Remarks</p>
          <p className="t-body mt-1">{request.remarks || 'No remarks.'}</p>
          {request.attachment_url && <AttachmentLink path={request.attachment_url} />}
        </div>

        <Field label="Comment for the employee" htmlFor="review-comment" hint="Optional. Shown with the decision.">
          <Textarea
            id="review-comment"
            value={comment}
            placeholder="Approved — enjoy the break."
            onChange={(event) => setComment(event.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose} disabled={acting !== null}>
            Not now
          </Button>
          <Button variant="danger" onClick={() => { void decide('rejected') }} disabled={acting !== null}>
            {acting === 'rejected' ? 'Rejecting…' : 'Reject'}
          </Button>
          <Button variant="strong" onClick={() => { void decide('approved') }} disabled={acting !== null}>
            {acting === 'approved' ? 'Approving…' : 'Approve'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function AttachmentLink({ path, compact = false }: { path: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function open() {
    setBusy(true)
    setError(null)
    try {
      const url = await signedAttachmentUrl(path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open the certificate.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className={compact ? 'ml-2 inline-block' : 'mt-1 block'}>
      <button type="button" className="t-label text-text-muted underline" onClick={open} disabled={busy}>
        {busy ? 'Opening…' : compact ? 'Certificate' : 'View certificate'}
      </button>
      {error && <span role="alert" className="ml-2 t-label text-danger-ink">{error}</span>}
    </span>
  )
}
