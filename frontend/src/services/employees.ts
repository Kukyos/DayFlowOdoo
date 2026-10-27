import type {
  DirectoryEmployee,
  Employee,
  EmployeeProfile,
  InactiveEmployee,
  Role,
} from '@/types/models'
import { ServiceError, api } from './client'

function toDirectoryEmployee(row: DirectoryEmployee): DirectoryEmployee {
  if (row.presence !== 'present' && row.presence !== 'leave' && row.presence !== 'absent') {
    throw new ServiceError('The employee directory returned an unsupported presence status.')
  }
  return row
}

function toEmployee(row: Employee): Employee {
  if (row.role !== 'admin' && row.role !== 'hr' && row.role !== 'employee') {
    throw new ServiceError('The employee record has an unsupported access role.')
  }
  return row
}

/**
 * The company directory. Only directory-safe columns arrive — no wage, no bank
 * details, no leave balances. If a field is missing here it is because the
 * server will not send it, not because it was forgotten.
 */
export async function listEmployees(opts: { search?: string; department?: string } = {}) {
  const employees = await api<DirectoryEmployee[]>('GET', '/directory', undefined, 'Could not load the employee directory.')
  const q = opts.search?.trim().toLowerCase() ?? ''
  return employees
    .map(toDirectoryEmployee)
    .sort((a, b) => a.first_name.localeCompare(b.first_name))
    .filter((e) => !opts.department || e.department === opts.department)
    .filter((e) =>
      !q ||
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
      (e.job_position ?? '').toLowerCase().includes(q) ||
      (e.department ?? '').toLowerCase().includes(q) ||
      (e.location ?? '').toLowerCase().includes(q),
    )
}

/**
 * The caller and Admin/HR receive the full record; a normal coworker receives
 * the deliberately smaller directory shape. Everyone gets the manager's name
 * and the direct reports.
 */
export async function getEmployee(id: string): Promise<EmployeeProfile> {
  const result = await api<Required<EmployeeProfile>>(
    'GET',
    `/employees/${encodeURIComponent(id)}`,
    undefined,
    'That employee no longer exists or is outside your company.',
  )
  const employee = 'monthly_wage' in result.employee
    ? toEmployee(result.employee)
    : toDirectoryEmployee(result.employee)
  return {
    employee,
    presence: result.presence,
    manager: result.manager,
    reports: result.reports.map(toDirectoryEmployee),
  }
}

export type EmployeeUpdate = Partial<Pick<
  Employee,
  | 'about'
  | 'skills'
  | 'mobile'
  | 'address'
  | 'avatar_url'
  | 'date_of_birth'
  | 'bank_account_number'
  | 'ifsc_code'
  | 'pan_no'
  | 'uan_no'
  | 'monthly_wage'
  | 'resume_path'
  | 'resume_name'
  // Admin/HR only; the server refuses these from anyone else.
  | 'first_name'
  | 'last_name'
  | 'job_position'
  | 'department'
  | 'location'
  | 'manager_id'
  | 'date_of_joining'
  | 'role'
>>

export async function updateEmployee(id: string, patch: EmployeeUpdate): Promise<Employee> {
  const employee = await api<Employee>(
    'PATCH',
    `/employees/${encodeURIComponent(id)}`,
    patch,
    'Could not save that employee profile.',
  )
  return toEmployee(employee)
}

export type CreateEmployeeInput = {
  first_name: string
  last_name: string
  work_email: string
  job_position: string
  department: string
  location: string
  date_of_joining: string
  monthly_wage: number
  manager_id: string | null
  role: Role
}

export async function createEmployee(input: CreateEmployeeInput) {
  const data = await api<{ employee: Employee; temporaryPassword: string }>(
    'POST',
    '/employees',
    input,
    'Could not create that employee.',
  )
  if (!data.employee || !data.temporaryPassword) {
    throw new ServiceError('The employee-creation service returned an incomplete result.')
  }
  return {
    employee: toEmployee(data.employee),
    temporaryPassword: data.temporaryPassword,
  }
}

export async function deactivateEmployee(id: string): Promise<void> {
  await api('POST', `/employees/${encodeURIComponent(id)}/deactivate`, undefined, 'Could not deactivate that employee.')
}

/** Admin/HR only. Deactivated employees, by name. */
export async function listInactiveEmployees(): Promise<InactiveEmployee[]> {
  return api<InactiveEmployee[]>('GET', '/employees/inactive', undefined, 'Could not load deactivated employees.')
}

export async function reactivateEmployee(id: string): Promise<Employee> {
  const employee = await api<Employee>(
    'POST',
    `/employees/${encodeURIComponent(id)}/reactivate`,
    undefined,
    'Could not reactivate that employee.',
  )
  return toEmployee(employee)
}

/**
 * Admin/HR only. Issues a new one-time temporary password, returned once; the
 * employee is signed out everywhere and must replace it at their next sign-in.
 */
export async function resetEmployeePassword(id: string): Promise<string> {
  const { temporaryPassword } = await api<{ temporaryPassword: string }>(
    'POST',
    `/employees/${encodeURIComponent(id)}/reset-password`,
    undefined,
    'Could not reset that password.',
  )
  return temporaryPassword
}

const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function uploadAvatar(file: File): Promise<string> {
  if (!AVATAR_TYPES.includes(file.type)) throw new ServiceError('Use a JPG, PNG, or WebP avatar.')
  if (file.size > 5 * 1024 * 1024) throw new ServiceError('The avatar must be 5 MB or smaller.')

  const form = new FormData()
  form.append('file', file)
  const { url } = await api<{ url: string }>('POST', '/uploads/avatars', form, 'Could not upload that avatar.')
  return url
}

const AVATAR_PREFIX = '/api/files/avatars/'

export async function deleteAvatar(url: string): Promise<void> {
  const pathname = new URL(url, window.location.origin).pathname
  if (!pathname.startsWith(AVATAR_PREFIX)) return
  const path = decodeURIComponent(pathname.slice(AVATAR_PREFIX.length))
  await api(
    'DELETE',
    `/uploads/avatars?path=${encodeURIComponent(path)}`,
    undefined,
    'Could not remove the previous avatar.',
  )
}

const RESUME_EXTENSIONS = ['pdf', 'doc', 'docx']

/** Stores a résumé privately and returns its object path; attach it with `updateEmployee`. */
export async function uploadResume(file: File): Promise<string> {
  const extension = file.name.toLowerCase().split('.').pop() ?? ''
  if (!RESUME_EXTENSIONS.includes(extension)) throw new ServiceError('Only PDF, DOC, or DOCX files are accepted.')
  if (file.size > 5 * 1024 * 1024) throw new ServiceError('That file is larger than 5 MB.')

  const form = new FormData()
  form.append('file', file)
  const { path } = await api<{ path: string }>('POST', '/uploads/resumes', form, 'Could not upload that résumé.')
  return path
}

/** Opens only for the owner and Admin/HR; the server checks the session. */
export const resumeUrl = (path: string): string =>
  `/api/files/resumes/${path.split('/').map(encodeURIComponent).join('/')}`

/** Removes an uploaded résumé that never got attached (a failed save). */
export async function deleteResume(path: string): Promise<void> {
  await api('DELETE', `/uploads/resumes?path=${encodeURIComponent(path)}`, undefined, 'Could not remove that résumé.')
}
