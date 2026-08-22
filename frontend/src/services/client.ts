/**
 * Service-layer plumbing.
 *
 * Every service returns data or throws — no `{ data, error }` tuple reaches a
 * page (docs/SERVICES.md). Pages use their normal error state.
 *
 * While the backend is being built these services read from
 * `frontend/src/fixtures/`. The signatures are the real ones, so swapping in
 * Supabase is a body change, not a contract change.
 */

/** Thrown by every service. Pages render `.message` directly. */
export class ServiceError extends Error {
  // Declared as a field rather than a constructor parameter property: the
  // tsconfig sets `erasableSyntaxOnly`, so TypeScript-only syntax that emits
  // runtime code is rejected.
  readonly detail: unknown

  constructor(message: string, detail?: unknown) {
    super(message)
    this.name = 'ServiceError'
    this.detail = detail
  }
}

/**
 * Unwraps a Supabase `{ data, error }` response. Unused while fixtures are in
 * place; kept because it is the contract every real service will use, and
 * having one copy is the point.
 */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new ServiceError(res.error.message, res.error)
  if (res.data === null) throw new ServiceError('No data returned')
  return res.data
}

/**
 * Simulated round-trip. Without it every page renders instantly from memory and
 * the loading states never appear — so they never get built, and then Stage 4
 * exposes all of them at once.
 */
export const latency = (ms = 320): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** Deep clone so a page mutating a result cannot corrupt the fixture module. */
export const clone = <T,>(value: T): T => structuredClone(value)
