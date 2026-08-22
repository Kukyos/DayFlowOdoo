import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/** Thrown by every service. Pages render `.message` directly. */
export class ServiceError extends Error {
  readonly detail: unknown

  constructor(message: string, detail?: unknown) {
    super(message)
    this.name = 'ServiceError'
    this.detail = detail
  }
}

let client: SupabaseClient<Database> | undefined

/**
 * The browser client uses only the public project URL and publishable/anon key.
 * It is created on first use so a missing local `.env.local` shows a useful
 * form error rather than preventing Vite from loading the page.
 */
export function supabaseClient(): SupabaseClient<Database> {
  if (client) return client

  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new ServiceError(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env.local.',
    )
  }

  client = createClient<Database>(url, anonKey)
  return client
}

/** Converts a Supabase result into the service contract used by pages. */
export function unwrap<T>(
  result: { data: T | null; error: { message: string } | null },
  fallback = 'We could not load that data. Please try again.',
): T {
  if (result.error || result.data === null) {
    throw new ServiceError(result.error?.message || fallback, result.error)
  }
  return result.data
}
