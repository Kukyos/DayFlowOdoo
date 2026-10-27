/**
 * Uploaded files live on disk under `uploads/<bucket>/<company-id>/...`.
 * Avatars and company logos are public presentation assets; leave documents
 * and résumés are served only to their owner and to Admin/HR in the same
 * company.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { isPrivileged, requireEmployee } from '../auth.ts'
import { UPLOADS_DIR } from '../db.ts'
import { badRequest, forbidden, notFound } from '../http.ts'
import type { AppEnv } from '../http.ts'
import type { EmployeeRecord } from '../serialize.ts'

type Bucket = {
  public: boolean
  maxBytes: number
  types: Record<string, string>
  /** Folder segments after the company ID for a new upload. */
  folder: (me: EmployeeRecord) => string[]
  canWrite: (me: EmployeeRecord, segments: string[]) => boolean
  canRead: (me: EmployeeRecord, segments: string[]) => boolean
}

const MB = 1024 * 1024
const ownFolder = (me: EmployeeRecord, segments: string[]) => segments[1] === me.id

const BUCKETS: Record<string, Bucket> = {
  avatars: {
    public: true,
    maxBytes: 5 * MB,
    types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
    folder: (me) => [me.id],
    canWrite: (me, segments) => ownFolder(me, segments) || isPrivileged(me),
    canRead: () => true,
  },
  'company-logos': {
    public: true,
    maxBytes: 5 * MB,
    types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg' },
    folder: () => [],
    canWrite: (me) => isPrivileged(me),
    canRead: () => true,
  },
  'leave-documents': {
    public: false,
    maxBytes: 10 * MB,
    types: { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' },
    folder: (me) => [me.id],
    canWrite: ownFolder,
    canRead: (me, segments) => ownFolder(me, segments) || isPrivileged(me),
  },
  resumes: {
    public: false,
    maxBytes: 5 * MB,
    types: {
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    },
    folder: (me) => [me.id],
    canWrite: ownFolder,
    canRead: (me, segments) => ownFolder(me, segments) || isPrivileged(me),
  },
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

/**
 * The stored extension for an upload. Browsers often send Word files with an
 * empty MIME type, so an allowed extension on the file name also counts.
 */
function extensionFor(bucket: Bucket, file: File): string | undefined {
  const byType = bucket.types[file.type]
  if (byType) return byType
  const byName = file.name.toLowerCase().split('.').pop() ?? ''
  return Object.values(bucket.types).includes(byName) ? byName : undefined
}

function bucketFor(name: string): Bucket {
  const bucket = BUCKETS[name]
  if (!bucket) throw notFound('That file store does not exist.')
  return bucket
}

/** Splits an object path, refusing anything that could escape the bucket folder. */
function segmentsOf(objectPath: string): string[] {
  const segments = objectPath.split('/')
  if (segments.length < 2 || !segments.every((segment) => /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(segment))) {
    throw badRequest('That file path is not valid.')
  }
  return segments
}

const diskPath = (bucket: string, segments: string[]) => path.join(UPLOADS_DIR, bucket, ...segments)

/** Deletes a stored object. Used when the record pointing at it goes away. */
export async function removeObject(bucket: string, objectPath: string): Promise<void> {
  await rm(diskPath(bucket, segmentsOf(objectPath)), { force: true })
}

/** True when `objectPath` is a well-formed path inside `employeeId`'s own folder. */
export function isOwnObject(objectPath: string, companyId: string, employeeId: string): boolean {
  try {
    const segments = segmentsOf(objectPath)
    return segments.length === 3 && segments[0] === companyId && segments[1] === employeeId
  } catch {
    return false
  }
}

// A little over the largest bucket limit, so the per-bucket message still wins.
const uploadBodyLimit = bodyLimit({
  maxSize: 11 * MB,
  onError: (c) => c.json({ message: 'The file must be 10 MB or smaller.' }, 413),
})

export const fileRoutes = new Hono<AppEnv>()

fileRoutes.post('/uploads/:bucket', requireEmployee, uploadBodyLimit, async (c) => {
  const name = c.req.param('bucket')
  const bucket = bucketFor(name)
  const me = c.var.me
  const segments = [me.company_id, ...bucket.folder(me)]
  if (!bucket.canWrite(me, [...segments, 'new'])) throw forbidden('You cannot upload to that file store.')

  const form = await c.req.parseBody()
  const file = form.file
  if (!(file instanceof File)) throw badRequest('Choose a file to upload.')
  const extension = extensionFor(bucket, file)
  if (!extension) throw badRequest('That file type is not allowed here.')
  if (file.size > bucket.maxBytes) {
    throw badRequest(`The file must be ${bucket.maxBytes / MB} MB or smaller.`)
  }

  const objectSegments = [...segments, `${crypto.randomUUID()}.${extension}`]
  const target = diskPath(name, objectSegments)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, Buffer.from(await file.arrayBuffer()))

  const objectPath = objectSegments.join('/')
  return c.json({ path: objectPath, url: `/api/files/${name}/${objectPath}` }, 201)
})

fileRoutes.delete('/uploads/:bucket', requireEmployee, async (c) => {
  const name = c.req.param('bucket')
  const bucket = bucketFor(name)
  const segments = segmentsOf(c.req.query('path') ?? '')
  const me = c.var.me
  if (segments[0] !== me.company_id || !bucket.canWrite(me, segments)) {
    throw forbidden('You cannot remove that file.')
  }
  await rm(diskPath(name, segments), { force: true })
  return c.json({ ok: true })
})

/** Public buckets need no session; private ones check the caller first. */
fileRoutes.get('/files/:bucket/:path{.+}', async (c, next) => {
  const bucket = bucketFor(c.req.param('bucket'))
  if (bucket.public) return next()
  return requireEmployee(c, next)
}, async (c) => {
  const name = c.req.param('bucket')
  const bucket = bucketFor(name)
  const segments = segmentsOf(c.req.param('path'))
  if (!bucket.public) {
    const me = c.var.me
    if (segments[0] !== me.company_id || !bucket.canRead(me, segments)) {
      throw forbidden('You cannot open that file.')
    }
  }

  let content: Buffer
  try {
    content = await readFile(diskPath(name, segments))
  } catch {
    throw notFound('That file no longer exists.')
  }
  const extension = segments[segments.length - 1].split('.').pop() ?? ''
  const headers: Record<string, string> = {
    'Content-Type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
    'Cache-Control': bucket.public ? 'public, max-age=3600' : 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  }
  // Uploaded SVGs are served from the app's origin; never let them run script.
  // (Only SVGs: the same policy on a PDF stops the browser's PDF viewer.)
  if (extension === 'svg') {
    headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; img-src data:"
  }
  return c.body(new Uint8Array(content), 200, headers)
})
