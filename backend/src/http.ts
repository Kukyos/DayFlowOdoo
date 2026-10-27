import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { EmployeeRecord } from './serialize.ts'

/** Handlers throw this; the app's error handler turns it into `{ message }`. */
export class HttpError extends Error {
  readonly status: ContentfulStatusCode

  constructor(status: ContentfulStatusCode, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export const badRequest = (message: string) => new HttpError(400, message)
export const forbidden = (message: string) => new HttpError(403, message)
export const notFound = (message: string) => new HttpError(404, message)

export type AppEnv = {
  Variables: {
    userId: string
    sessionToken: string
    me: EmployeeRecord
  }
}

export type AppContext = Context<AppEnv>

/** A JSON object body, or `{}` when the body is missing or malformed. */
export async function jsonBody(c: AppContext): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await c.req.json()
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
export const optionalText = (value: unknown): string | null => text(value) || null

export const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
