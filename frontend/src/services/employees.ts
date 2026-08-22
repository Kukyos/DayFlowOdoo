import * as fx from '@/fixtures'
import { buildLoginId } from '@/types/models'
import type { DirectoryEmployee, Employee, EmployeeProfile, Role } from '@/types/models'
import { ServiceError, clone, latency, supabaseClient, unwrap } from './client'

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

export async function createEmployee(input: {
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
}) {
  await latency(520)
  if (fx.employees.some((e) => e.work_email === input.work_email)) {
    throw new ServiceError('Someone already has that work email.')
  }
  const year = Number(input.date_of_joining.slice(0, 4))
  const serial = fx.employees.filter((e) => e.date_of_joining?.startsWith(`${year}`)).length + 1
  const loginId = buildLoginId('OI', input.first_name, input.last_name, year, serial)

  const employee: Employee = {
    id: `e-${fx.employees.length + 1}`,
    company_id: fx.company.id,
    login_id: loginId,
    avatar_url: null,
    about: null,
    skills: [],
    mobile: null,
    date_of_birth: null,
    address: null,
    bank_account_number: null,
    ifsc_code: null,
    pan_no: null,
    uan_no: null,
    paid_leave_balance: 24,
    sick_leave_balance: 7,
    is_active: true,
    must_change_password: true,
    created_at: new Date().toISOString(),
    ...input,
  }
  fx.employees.push(employee)
  fx.presenceById[employee.id] = 'absent'
  // Fixture-only stand-in. Milestone 8 replaces this with a cryptographically
  // secure value generated by the server-side employee-creation function.
  const temporaryPassword = `Df-${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`
  return { employee: clone(employee), loginId, temporaryPassword }
}

export async function deactivateEmployee(id: string) {
  await latency()
  const found = fx.employees.find((e) => e.id === id)
  if (found) found.is_active = false
}

// The Add Employee fixture workflow remains until Milestone 8. The live
// directory filters itself from `list_employee_directory()` above.
export const departments = (): string[] =>
  [...new Set(fx.employees.map((e) => e.department).filter(Boolean))] as string[]
