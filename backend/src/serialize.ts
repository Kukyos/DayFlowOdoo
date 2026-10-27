/**
 * SQLite stores booleans as 0/1 and arrays as JSON text. These turn stored rows
 * into the JSON shapes the frontend's `types/models.ts` describes.
 */
import type { Row } from './db.ts'

export type EmployeeRecord = {
  id: string
  company_id: string
  role: 'admin' | 'hr' | 'employee'
  first_name: string
  last_name: string
  work_email: string
  mobile: string | null
  job_position: string | null
  department: string | null
  location: string | null
  manager_id: string | null
  date_of_joining: string | null
  avatar_url: string | null
  about: string | null
  skills: string[] | null
  date_of_birth: string | null
  address: string | null
  bank_account_number: string | null
  ifsc_code: string | null
  pan_no: string | null
  uan_no: string | null
  monthly_wage: number | null
  paid_leave_balance: number
  sick_leave_balance: number
  is_active: boolean
  must_change_password: boolean
  created_at: string
}

const json = <T>(value: unknown): T | null =>
  typeof value === 'string' ? (JSON.parse(value) as T) : null

export function employee(row: Row): EmployeeRecord {
  return {
    ...(row as unknown as EmployeeRecord),
    skills: json<string[]>(row.skills),
    is_active: row.is_active === 1,
    must_change_password: row.must_change_password === 1,
  }
}

/** The coworker-safe projection: no wage, private details, or balances. */
export function directoryEmployee(row: Row) {
  return {
    id: row.id as string,
    first_name: row.first_name as string,
    last_name: row.last_name as string,
    avatar_url: row.avatar_url as string | null,
    job_position: row.job_position as string | null,
    department: row.department as string | null,
    location: row.location as string | null,
    work_email: row.work_email as string,
    manager_id: row.manager_id as string | null,
    about: row.about as string | null,
    skills: json<string[]>(row.skills),
    presence: row.presence as string,
  }
}

export function company(row: Row) {
  return {
    ...row,
    time_off_types: json<string[]>(row.time_off_types) ?? [],
    working_days: json<number[]>(row.working_days) ?? [],
  }
}
