import { useState } from 'react'
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
import { useSession } from '@/context/session'
import { useAsync, useDebounced } from '@/hooks/useAsync'
import { addDays, formatDate, today, workingDaysBetween } from '@/lib/dates'
import {
  allRequests,
  cancelRequest,
  createRequest,
  myBalances,
  myRequests,
  reviewRequest,
  signedAttachmentUrl,
  uploadAttachment,
} from '@/services/timeOff'
import { LEAVE_TYPE_LABEL } from '@/types/models'
import type { LeaveStatus, LeaveType } from '@/types/models'

export function TimeOff() {
  const { isPrivileged } = useSession()
  const [mode, setMode] = useState<'mine' | 'approvals'>(isPrivileged ? 'approvals' : 'mine')

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

  const { status, data, error, reload } = useAsync(async () => {
    if (!employee) throw new Error('Not signed in.')
    const [balances, requests] = await Promise.all([
      myBalances(employee.id),
      myRequests(employee.id),
    ])
    return { balances, requests }
  }, [employee?.id])

  async function cancel(id: string) {
    await cancelRequest(id)
    reload()
  }

  return (
    <>
      {status === 'loading' && <Spinner label="Loading your time off" />}
      {status === 'error' && <ErrorState message={error} onRetry={reload} />}

      {status === 'ready' && (
        <>
          <div className="mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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

          {data.requests.length === 0 ? (
            <EmptyState
              title="No requests yet"
              body="When you book time off it shows here, along with where it has got to."
              action={<Button size="sm" onClick={() => setOpen(true)}>New request</Button>}
            />
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
                      <Button size="sm" variant="danger" onClick={() => cancel(r.id)}>
                        Cancel
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
    try {
      const attachmentUrl = type === 'sick' && attachment
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
  const { employee, refreshEmployee } = useSession()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<LeaveStatus | 'all'>('pending')
  const q = useDebounced(search)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { status, data, error: loadError, reload } = useAsync(
    () => allRequests({ search: q, status: filter }),
    [q, filter],
  )

  async function review(id: string, decision: 'approved' | 'rejected') {
    if (!employee) return
    setActing(id)
    setError(null)
    try {
      await reviewRequest(id, decision, employee.id)
      reload()
      void refreshEmployee()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record that decision.')
    } finally {
      setActing(null)
    }
  }

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

      {error && (
        <p role="alert" className="mb-4 t-caption text-danger-ink">
          {error}
        </p>
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
                    <Avatar name={r.employee_name} size={30} />
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
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={acting === r.id}
                        onClick={() => review(r.id, 'rejected')}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="strong"
                        disabled={acting === r.id}
                        onClick={() => review(r.id, 'approved')}
                      >
                        Approve
                      </Button>
                    </div>
                  ) : (
                    <span className="t-label text-text-muted">Decided</span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        ))}
    </>
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
