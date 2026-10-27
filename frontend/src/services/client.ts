/** Thrown by every service. Pages render `.message` directly. */
export class ServiceError extends Error {
  readonly detail: unknown

  constructor(message: string, detail?: unknown) {
    super(message)
    this.name = 'ServiceError'
    this.detail = detail
  }
}

/**
 * The one way services reach the backend. Requests go to `/api` on the same
 * origin (Vite proxies it to the local API), so the session cookie rides along
 * without any token handling here. A failed request throws the server's
 * `{ message }`, or `fallback` when the server is unreachable.
 */
export async function api<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  fallback = 'We could not load that data. Please try again.',
): Promise<T> {
  const init: RequestInit = { method, credentials: 'same-origin' }
  if (body instanceof FormData) {
    init.body = body
  } else if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(`/api${path}`, init)
  } catch (error) {
    throw new ServiceError('Could not reach the Dayflow server. Is the backend running?', error)
  }

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : fallback
    throw new ServiceError(message, { status: response.status })
  }
  return payload as T
}

/** Builds a query string, leaving out empty values. */
export function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}
