import type { DirectoryEmployee, Employee, EmployeeProfile, Role } from '@/types/models'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { ServiceError, supabaseClient, unwrap } from './client'

type DirectoryRow = {
  id: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  job_position: string | null
  department: string | null
  location: string | null
  work_email: string | null
  manager_id: string | null
  about: string | null
  skills: string[] | null
  presence: string | null
}

function toDirectoryEmployee(row: DirectoryRow): DirectoryEmployee {
  if (!row.id || !row.first_name || !row.last_name || !row.work_email) {
    throw new ServiceError('The employee directory returned an incomplete profile.')
  }
  if (row.presence !== 'present' && row.presence !== 'leave' && row.presence !== 'absent') {
    throw new ServiceError('The employee directory returned an unsupported presence status.')
  }
  return {
    ...row,
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    work_email: row.work_email,
    presence: row.presence,
  }
}

function toEmployee(row: Omit<Employee, 'role'> & { role: string }): Employee {
  if (row.role !== 'admin' && row.role !== 'hr' && row.role !== 'employee') {
    throw new ServiceError('The employee record has an unsupported access role.')
  }
  return { ...row, role: row.role }
}

/**
 * The directory RPC. Only the columns `list_employee_directory()` exposes —
 * no wage, no bank details, no leave balances. If a field is missing here it is
 * because RLS will not return it, not because it was forgotten.
 */
export async function listEmployees(opts: { search?: string; department?: string } = {}) {
  const { data, error } = await supabaseClient()
    .rpc('list_employee_directory')
  const employees = unwrap({ data, error })
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
 * RLS returns a full row for the caller or a privileged colleague. For a
 * normal coworker the full-row query returns nothing, then the safe directory
 * view supplies the deliberately smaller profile shape.
 */
export async function getEmployee(id: string): Promise<EmployeeProfile> {
  const client = supabaseClient()
  const fullResult = await client.from('employees').select('*').eq('id', id).maybeSingle()
  if (fullResult.error) throw new ServiceError(fullResult.error.message, fullResult.error)

  const directoryResult = await client.rpc('list_employee_directory')
  if (directoryResult.error) {
    throw new ServiceError('Could not load the employee directory.', directoryResult.error)
  }
  const directoryRow = directoryResult.data.find((row) => row.id === id)
  if (!directoryRow) {
    throw new ServiceError('That employee no longer exists or is outside your company.')
  }
  const directory = toDirectoryEmployee(directoryRow)
  const employee = fullResult.data ? toEmployee(fullResult.data) : directory
  return { employee, presence: directory.presence }
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
>>

export async function updateEmployee(id: string, patch: EmployeeUpdate): Promise<Employee> {
  const { data, error } = await supabaseClient()
    .from('employees')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  const employee = unwrap({ data, error }, 'Could not save that employee profile.')
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

type CreateEmployeeResult = {
  employee: Omit<Employee, 'role'> & { role: string }
  temporaryPassword: string
}

export async function createEmployee(input: CreateEmployeeInput) {
  const { data, error } = await supabaseClient().functions.invoke<CreateEmployeeResult>(
    'create-employee',
    { body: input },
  )
  if (error) {
    let message = 'Could not create that employee.'
    if (error instanceof FunctionsHttpError) {
      const detail = await error.context.json().catch(() => null) as { message?: string } | null
      if (detail?.message) message = detail.message
    }
    throw new ServiceError(message, error)
  }
  if (!data?.employee || !data.temporaryPassword) {
    throw new ServiceError('The employee-creation service returned an incomplete result.')
  }
  return {
    employee: toEmployee(data.employee),
    temporaryPassword: data.temporaryPassword,
  }
}

export async function deactivateEmployee(id: string): Promise<void> {
  const { error } = await supabaseClient().rpc('deactivate_employee', { p_employee_id: id })
  if (error) throw new ServiceError(error.message, error)
}

const AVATAR_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function uploadAvatar(file: File): Promise<string> {
  const extension = AVATAR_TYPES[file.type]
  if (!extension) throw new ServiceError('Use a JPG, PNG, or WebP avatar.')
  if (file.size > 5 * 1024 * 1024) throw new ServiceError('The avatar must be 5 MB or smaller.')

  const client = supabaseClient()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData.user) throw new ServiceError('Sign in before uploading an avatar.')
  const { data: employee, error: employeeError } = await client
    .from('employees')
    .select('company_id')
    .eq('id', userData.user.id)
    .single()
  if (employeeError || !employee) throw new ServiceError('Could not resolve your company.')

  const path = `${employee.company_id}/${userData.user.id}/${crypto.randomUUID()}.${extension}`
  const { error } = await client.storage.from('avatars').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw new ServiceError('Could not upload that avatar.', error)
  return client.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

export async function deleteAvatar(publicUrl: string): Promise<void> {
  const marker = '/storage/v1/object/public/avatars/'
  const pathname = new URL(publicUrl).pathname
  const markerIndex = pathname.indexOf(marker)
  if (markerIndex < 0) return
  const path = decodeURIComponent(pathname.slice(markerIndex + marker.length))
  const { error } = await supabaseClient().storage.from('avatars').remove([path])
  if (error) throw new ServiceError('Could not remove the previous avatar.', error)
}
