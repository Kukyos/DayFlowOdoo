import { useEffect, useRef, useState } from 'react'
import { Button, Modal } from '@/components/ui'
import { cx } from '@/lib/cx'
import { deleteResume, resumeUrl, uploadResume } from '@/services/employees'
import type { Employee } from '@/types/models'

/**
 * Resume upload for the Resume tab.
 *
 * The file lives in the private `resumes` bucket; the employee row records its
 * path, name and upload time. Only the owner uploads or removes it, and the
 * owner and their company's Admin/HR open it through a short-lived signed URL.
 * Coworkers get a directory row without these columns, so this card is not
 * rendered for them at all.
 */

const ACCEPTED_EXTENSIONS = ['.pdf', '.doc', '.docx']
const MAX_BYTES = 5 * 1024 * 1024

const isPdfName = (name: string): boolean => name.toLowerCase().endsWith('.pdf')

function validate(file: File): string | null {
  if (!ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
    return 'Only PDF, DOC, or DOCX files are accepted.'
  }
  if (file.size > MAX_BYTES) return 'That file is larger than 5 MB.'
  return null
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M6 2.5h8l4 4V21a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 21V3a.5.5 0 0 1 .5-.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M14 2.5V6a1 1 0 0 0 1 1h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M9 12.5h6M9 15.5h6M9 9.5h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function Toast({ kind, message }: { kind: 'success' | 'error'; message: string }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div
      role="status"
      className={cx(
        'pointer-events-none fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-control border px-4 py-2.5 t-caption shadow-lg transition-all duration-200 ease-out',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        kind === 'success'
          ? 'border-border bg-surface-raised text-text'
          : 'border-danger-ink bg-surface-raised text-danger-ink',
      )}
    >
      {message}
    </div>
  )
}

export function ResumeUpload({
  employee,
  editable,
  onSaved,
}: {
  employee: Employee
  editable: boolean
  onSaved: () => void
}) {
  const [busy, setBusy] = useState<'upload' | 'remove' | 'open' | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const toastTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), [])

  function notify(kind: 'success' | 'error', message: string) {
    window.clearTimeout(toastTimerRef.current)
    setToast({ kind, message })
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3500)
  }

  async function processFile(file: File) {
    const problem = validate(file)
    if (problem) {
      notify('error', problem)
      return
    }
    setBusy('upload')
    try {
      await uploadResume(employee, file)
      onSaved()
      notify('success', 'Resume uploaded.')
    } catch (cause) {
      notify('error', cause instanceof Error ? cause.message : 'Could not upload that résumé.')
    } finally {
      setBusy(null)
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void processFile(file)
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (!editable || busy) return
    const file = e.dataTransfer.files?.[0]
    if (file) void processFile(file)
  }

  async function remove() {
    if (!window.confirm('Remove your résumé?')) return
    setBusy('remove')
    try {
      await deleteResume(employee)
      onSaved()
      notify('success', 'Resume removed.')
    } catch (cause) {
      notify('error', cause instanceof Error ? cause.message : 'Could not remove the résumé.')
    } finally {
      setBusy(null)
    }
  }

  /**
   * A PDF previews in a dialog. A Word file can only be downloaded, and the tab
   * for that opens inside the click: browsers block one opened after an await.
   */
  async function open(path: string, name: string) {
    const pdf = isPdfName(name)
    const tab = pdf ? null : window.open('', '_blank')
    if (tab) tab.opener = null
    setBusy('open')
    try {
      const url = await resumeUrl(path)
      if (pdf) setPreviewUrl(url)
      else if (tab) tab.location.href = url
      else window.location.assign(url)
    } catch (cause) {
      tab?.close()
      notify('error', cause instanceof Error ? cause.message : 'Could not open the résumé.')
    } finally {
      setBusy(null)
    }
  }

  const path = employee.resume_path
  const name = employee.resume_name ?? 'Resume'

  return (
    <>
      <h2 className="t-h3 mb-4">Resume file</h2>

      {path ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 rounded-control border border-border-soft p-4">
            <DocumentIcon className="h-9 w-9 shrink-0 text-text-muted" />
            <div className="min-w-0 flex-1">
              <p className="t-caption truncate">{name}</p>
              {employee.resume_uploaded_at && (
                <p className="t-label mt-0.5 font-normal normal-case text-text-muted">
                  Uploaded {new Date(employee.resume_uploaded_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => { void open(path, name) }} disabled={busy !== null}>
              {busy === 'open' ? 'Opening…' : isPdfName(name) ? 'Preview resume' : 'Download resume'}
            </Button>
            {editable && (
              <>
                <Button size="sm" onClick={() => inputRef.current?.click()} disabled={busy !== null}>
                  {busy === 'upload' ? 'Uploading…' : 'Replace resume'}
                </Button>
                <Button size="sm" variant="danger" onClick={() => { void remove() }} disabled={busy !== null}>
                  {busy === 'remove' ? 'Removing…' : 'Remove resume'}
                </Button>
              </>
            )}
          </div>
        </div>
      ) : editable ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cx(
            'flex flex-col items-center gap-3 rounded-control border border-dashed px-6 py-10 text-center transition-colors',
            dragOver ? 'border-text bg-neutral-fill' : 'border-border-soft',
          )}
        >
          <DocumentIcon className="h-8 w-8 text-text-muted" />
          {busy === 'upload' ? (
            <p className="t-caption text-text-muted">Uploading…</p>
          ) : (
            <>
              <p className="t-caption text-text-muted">Drag a file here, or</p>
              <Button size="sm" onClick={() => inputRef.current?.click()}>
                Upload resume
              </Button>
              <p className="t-label text-text-muted">PDF, DOC or DOCX · up to 5 MB</p>
            </>
          )}
        </div>
      ) : (
        <p className="t-caption py-3 text-text-muted">No resume uploaded yet.</p>
      )}

      {editable && (
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={onPick}
          className="sr-only"
          aria-label="Choose a resume file"
        />
      )}

      <Modal open={previewUrl !== null} onClose={() => setPreviewUrl(null)} title={name}>
        {previewUrl && (
          <iframe src={previewUrl} title="Resume preview" className="h-[70vh] w-full rounded-control border border-border-soft" />
        )}
      </Modal>

      {toast && <Toast kind={toast.kind} message={toast.message} />}
    </>
  )
}
