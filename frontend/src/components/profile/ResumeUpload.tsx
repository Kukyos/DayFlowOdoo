import { useEffect, useRef, useState } from 'react'
import { Button, Modal, cx } from '@/components/ui'
import { deleteResume, resumeUrl, updateEmployee, uploadResume } from '@/services/employees'
import type { Employee } from '@/types/models'

/**
 * The résumé file on the Resume tab. Stored privately by the API: only the
 * employee and Admin/HR can open it, and coworkers never see this card.
 *
 * Uploading is two steps — store the file, then attach it to the employee
 * record — so a failed attach removes the stored file again. Replacing or
 * removing a résumé deletes the old file on the server.
 */

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const ACCEPTED_EXTENSIONS = ['.pdf', '.doc', '.docx']
const MAX_BYTES = 5 * 1024 * 1024

type StoredResume = {
  path: string
  name: string
  uploadedAt: string | null
}

const fromEmployee = (employee: Employee): StoredResume | null =>
  employee.resume_path
    ? { path: employee.resume_path, name: employee.resume_name ?? 'Résumé', uploadedAt: employee.resume_uploaded_at }
    : null

const isPdf = (name: string): boolean => name.toLowerCase().endsWith('.pdf')

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

export function ResumeUpload({ employee, editable }: { employee: Employee; editable: boolean }) {
  // Kept locally after a change rather than reloading the whole profile, so the
  // confirmation toast survives.
  const [resume, setResume] = useState<StoredResume | null>(() => fromEmployee(employee))
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
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

    setUploading(true)
    let path: string | null = null
    try {
      path = await uploadResume(file)
      const updated = await updateEmployee(employee.id, { resume_path: path, resume_name: file.name })
      setResume(fromEmployee(updated))
      notify('success', 'Resume uploaded.')
    } catch (cause) {
      if (path) void deleteResume(path).catch(() => undefined)
      notify('error', cause instanceof Error ? cause.message : 'Could not upload that resume.')
    } finally {
      setUploading(false)
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
    if (!editable || uploading) return
    const file = e.dataTransfer.files?.[0]
    if (file) void processFile(file)
  }

  async function remove() {
    try {
      await updateEmployee(employee.id, { resume_path: null })
      setResume(null)
      notify('success', 'Resume removed.')
    } catch (cause) {
      notify('error', cause instanceof Error ? cause.message : 'Could not remove the resume.')
    }
  }

  function preview() {
    if (!resume) return
    if (isPdf(resume.name)) {
      setPreviewOpen(true)
    } else {
      // Word files cannot render inline; the browser downloads them.
      window.open(resumeUrl(resume.path), '_blank', 'noopener,noreferrer')
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
              <p className="t-caption truncate">{resume.name}</p>
              {resume.uploadedAt && (
                <p className="t-label mt-0.5 font-normal normal-case text-text-muted">
                  Uploaded {new Date(resume.uploadedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={preview}>
              {isPdf(resume.name) ? 'Preview resume' : 'Download resume'}
            </Button>
            {editable && (
              <>
                <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
                  {uploading ? 'Uploading…' : 'Replace resume'}
                </Button>
                <Button size="sm" variant="danger" onClick={() => { void remove() }} disabled={uploading}>
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
                <div className="h-full w-1/2 animate-pulse rounded-full bg-text" />
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

      {resume && isPdf(resume.name) && (
        <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title={resume.name}>
          <iframe
            src={resumeUrl(resume.path)}
            title="Resume preview"
            className="h-[70vh] w-full rounded-control border border-border-soft"
          />
        </Modal>
      )}

      {toast && <Toast kind={toast.kind} message={toast.message} />}
    </>
  )
}
