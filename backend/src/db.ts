import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { SQLInputValue } from 'node:sqlite'

const backendRoot = path.resolve(import.meta.dirname, '..')

/** Overridable so tests run against a throwaway database and upload folder. */
export const DB_PATH = process.env.DAYFLOW_DB ?? path.join(backendRoot, 'data', 'dayflow.db')
export const UPLOADS_DIR = process.env.DAYFLOW_UPLOADS ?? path.join(backendRoot, 'uploads')

export type Row = Record<string, SQLInputValue>
export type Params = SQLInputValue[]

let database: DatabaseSync | undefined

export function db(): DatabaseSync {
  if (database) return database
  if (DB_PATH !== ':memory:') mkdirSync(path.dirname(DB_PATH), { recursive: true })
  database = new DatabaseSync(DB_PATH)
  database.exec('pragma foreign_keys = on; pragma journal_mode = wal; pragma busy_timeout = 5000;')
  database.exec(readFileSync(path.join(import.meta.dirname, 'schema.sql'), 'utf8'))
  return database
}

export function closeDb(): void {
  database?.close()
  database = undefined
}

export const one = <T = Row>(sql: string, ...params: Params): T | undefined =>
  db().prepare(sql).get(...params) as T | undefined

export const all = <T = Row>(sql: string, ...params: Params): T[] =>
  db().prepare(sql).all(...params) as T[]

export const run = (sql: string, ...params: Params) => db().prepare(sql).run(...params)

/**
 * Runs `fn` in one write transaction. SQLite serialises writers, so a balance
 * check and its decrement inside here cannot interleave with another request.
 */
export function tx<T>(fn: () => T): T {
  const connection = db()
  connection.exec('begin immediate')
  try {
    const result = fn()
    connection.exec('commit')
    return result
  } catch (error) {
    connection.exec('rollback')
    throw error
  }
}

export const newId = (): string => crypto.randomUUID()
