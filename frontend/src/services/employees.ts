/** STUB — fixture-backed. Signatures from docs/SERVICES.md. */
import * as fx from '@/fixtures'
import { buildLoginId, isPrivileged } from '@/types/models'
import type { DirectoryEmployee, Employee, Role } from '@/types/models'
import { clone, latency, ServiceError } from './client'

/**
 * The directory view. Only the columns `employee_directory` exposes —
 * no wage, no bank details, no leave balances. If a field is missing here it is
 * because RLS will not return it, not because it was forgotten.
 */
export async function listEmployees(opts: { search?: string; department?: string } = {}) {
  await latency()
  const q = opts.search?.trim().toLowerCase() ?? ''
  return fx.employees
    .filter((e) => e.is_active)
    .filter((e) => !opts.department || e.department === opts.department)
    .filter((e) =>
      !q ||
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
      (e.job_position ?? '').toLowerCase().includes(q) ||
      (e.department ?? '').toLowerCase().includes(q) ||
      (e.location ?? '').toLowerCase().includes(q),
    )
    .map<DirectoryEmployee>((e) => ({
      id: e.id,
      first_name: e.first_name,
      last_name: e.last_name,
      avatar_url: e.avatar_url,
      job_position: e.job_position,
      department: e.department,
      location: e.location,
      work_email: e.work_email,
      manager_id: e.manager_id,
      about: e.about,
      skills: e.skills,
      presence: fx.presenceById[e.id] ?? 'absent',
    }))
}

/**
 * Own row in full; a coworker's row with the protected columns nulled.
 *
 * The nulling is what RLS will do server-side. Doing it here too means the
 * profile page is built against the shape it will actually receive, instead of
 * discovering half the page is blank during Stage 4.
 */
export async function getEmployee(
  id: string,
  viewer: { id: string; role: Role },
): Promise<Employee> {
  await latency()
  const found = fx.employees.find((e) => e.id === id)
  if (!found) throw new ServiceError('That employee no longer exists.')

  const maySeeAll = viewer.id === id || isPrivileged(viewer.role)
  if (maySeeAll) return clone(found)

  return {
    ...clone(found),
    date_of_birth: null,
    address: null,
    bank_account_number: null,
    ifsc_code: null,
    pan_no: null,
    uan_no: null,
    monthly_wage: null,
    paid_leave_balance: null,
    sick_leave_balance: null,
    mobile: null,
  }
}

export async function updateEmployee(id: string, patch: Partial<Employee>) {
  await latency()
  const found = fx.employees.find((e) => e.id === id)
  if (!found) throw new ServiceError('That employee no longer exists.')
  Object.assign(found, patch)
  return clone(found)
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
    created_at: new Date().toISOString(),
    ...input,
  }
  fx.employees.push(employee)
  fx.presenceById[employee.id] = 'absent'
  return { employee: clone(employee), loginId }
}

export async function deactivateEmployee(id: string) {
  await latency()
  const found = fx.employees.find((e) => e.id === id)
  if (found) found.is_active = false
}

export const departments = (): string[] =>
  [...new Set(fx.employees.map((e) => e.department).filter(Boolean))] as string[]
