import { useEffect, useRef, useState } from 'react'
import { Button, Modal, cx } from '@/components/ui'

/**
 * Resume upload for the Resume tab, entirely on the frontend.
 *
 * There is no `resume` column, storage bucket, or service function yet —
 * only `avatars` storage exists (docs/SCHEMA.md, docs/SERVICES.md). Adding
 * real persistence is a backend decision (a bucket, RLS, a documented
 * service function), so this keeps the file in memory for the tab's
 * lifetime via `URL.createObjectURL` and never calls Supabase. Swapping in
 * a real upload later is a matter of replacing `processFile` below with a
 * service call — nothing here should have to change shape.
 */

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const ACCEPTED_EXTENSIONS = ['.pdf', '.doc', '.docx']
const MAX_BYTES = 5 * 1024 * 1024

type StoredResume = {
  file: File
  url: string
  uploadedAt: number
}

// Module-level so the file survives a tab switch even though the Resume tab
// unmounts when another tab is selected (EmployeeProfile renders only the
// active tab). Keyed by employee id — never sent anywhere.
const resumeStore = new Map<string, StoredResume>()

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function validate(file: File): string | null {
  const okType =
    ACCEPTED_TYPES.includes(file.type) ||
    ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
  if (!okType) return 'Only PDF, DOC, or DOCX files are accepted.'
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

export function ResumeUpload({ employeeId, editable }: { employeeId: string; editable: boolean }) {
  const [resume, setResume] = useState<StoredResume | null>(() => resumeStore.get(employeeId) ?? null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const toastTimerRef = useRef<number | undefined>(undefined)

  useEffect(
    () => () => {
      window.clearInterval(timerRef.current)
      window.clearTimeout(toastTimerRef.current)
    },
    [],
  )

  function notify(kind: 'success' | 'error', message: string) {
    window.clearTimeout(toastTimerRef.current)
    setToast({ kind, message })
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3500)
  }

  function processFile(file: File) {
    const problem = validate(file)
    if (problem) {
      notify('error', problem)
      return
    }

    setUploading(true)
    setProgress(0)
    window.clearInterval(timerRef.current)

    let pct = 0
    timerRef.current = window.setInterval(() => {
      pct = Math.min(pct + Math.random() * 25 + 12, 100)
      setProgress(pct)
      if (pct >= 100) {
        window.clearInterval(timerRef.current)
        const previous = resumeStore.get(employeeId)
        if (previous) URL.revokeObjectURL(previous.url)
        const stored: StoredResume = { file, url: URL.createObjectURL(file), uploadedAt: Date.now() }
        resumeStore.set(employeeId, stored)
        setResume(stored)
        setUploading(false)
        notify('success', 'Resume uploaded.')
      }
    }, 150)
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) processFile(file)
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (!editable || uploading) return
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  function remove() {
    const existing = resumeStore.get(employeeId)
    if (existing) URL.revokeObjectURL(existing.url)
    resumeStore.delete(employeeId)
    setResume(null)
    notify('success', 'Resume removed.')
  }

  function preview() {
    if (!resume) return
    if (isPdf(resume.file)) {
      setPreviewOpen(true)
    } else {
      window.open(resume.url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <>
      <h2 className="t-h3 mb-4">Resume file</h2>

      {resume ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 rounded-control border border-border-soft p-4">
            <DocumentIcon className="h-9 w-9 shrink-0 text-text-muted" />
            <div className="min-w-0 flex-1">
              <p className="t-caption truncate">{resume.file.name}</p>
              <p className="t-label mt-0.5 font-normal normal-case text-text-muted">
                {formatBytes(resume.file.size)} · Uploaded {new Date(resume.uploadedAt).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={preview}>
              Preview resume
            </Button>
            {editable && (
              <>
                <Button size="sm" onClick={() => inputRef.current?.click()}>
                  Replace resume
                </Button>
                <Button size="sm" variant="danger" onClick={remove}>
                  Remove resume
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
          {uploading ? (
            <div className="flex w-full max-w-xs flex-col items-center gap-2">
              <p className="t-caption text-text-muted">Uploading…</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-soft">
                <div
                  className="h-full rounded-full bg-text transition-[width] duration-150 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
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

      {resume && isPdf(resume.file) && (
        <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title={resume.file.name}>
          <iframe src={resume.url} title="Resume preview" className="h-[70vh] w-full rounded-control border border-border-soft" />
        </Modal>
      )}

      {toast && <Toast kind={toast.kind} message={toast.message} />}
    </>
  )
}
