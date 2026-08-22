# Services

**Owner: Praneet.** This is the frontend contract for the four-table MVP.
Pages never import `supabase`; they call `frontend/src/services/`, which calls
Supabase. If a function is not listed here, it does not exist yet.

## Rules

- One file per domain: `auth.ts`, `company.ts`, `employees.ts`,
  `attendance.ts`, `timeOff.ts`, and `salary.ts`.
- Every function returns data or throws. `services/client.ts` owns the one
  `unwrap()` helper.
- Types come from generated `frontend/src/types/database.ts`, never hand-edited.
- Dates cross the boundary as `YYYY-MM-DD`; money is a number of rupees rounded
  to two decimals.
- Demo data comes from `backend/supabase/seed.sql`; production services never
  import local fixtures.

**Live through Milestone 9:** company reads/updates, directory/profile,
employee creation/deactivation, attendance, time off, avatars, company logos,
private leave attachments, and the guarded dashboard summary now call Supabase.
The unused frontend fixture layer has been removed.

## `dashboard.ts`

| function | returns | notes |
|---|---|---|
| `getDashboardSummary()` | `DashboardSummary` | One authenticated RPC; own attendance/balances/recent requests for everyone, company aggregates and pending requests only for Admin/HR |

## `auth.ts`

`getSession()` is asynchronous in the Supabase implementation because the
browser client restores its persisted session through `supabase.auth.getSession()`.

```ts
type SignUpCompanyInput = {
  companyName: string
  firstName: string
  lastName: string
  email: string
  password: string
  mobile?: string
}

type SignUpCompanyResult = {
  userId: string
  confirmationRequired: boolean
}
```

| function | returns | notes |
|---|---|---|
| `signUpCompany(input)` | `SignUpCompanyResult` | Public company registration. Creates the first admin, company, and employee record; email confirmation is required before a session exists |
| `signIn(email, password)` | `Session` | Email and password only for the MVP |
| `signOut()` | `void` | |
| `getSession()` | `Session \| null` | |
| `onAuthChange(cb)` | unsubscribe function | Used by `AuthProvider` |
| `changePassword(newPassword)` | `void` | Updates the Auth password; the private Auth trigger clears `must_change_password` |
| `currentEmployee()` | `Employee` | The signed-in caller's full employee row, including role |

## `company.ts`

| function | returns | notes |
|---|---|---|
| `getCompany()` | `Company` | Header logo and name |
| `updateCompany(patch)` | `Company` | Admin only |
| `uploadCompanyLogo(file)` | `string` | `company-logos` bucket |

## `employees.ts`

| function | returns | notes |
|---|---|---|
| `listEmployees({ search?, department? })` | `EmployeeCard[]` | Calls the narrow `list_employee_directory()` RPC; includes derived `presence` |
| `getEmployee(id)` | `EmployeeProfile` | Own/privileged full profile or a directory-safe coworker profile; a normal employee may read their own wage but not a coworker's |
| `createEmployee(input)` | `{ employee, loginId, temporaryPassword }` | Admin/HR only. Calls the server-side creation flow; the temporary password is returned once and never persisted in plaintext |
| `updateEmployee(id, patch)` | `Employee` | RLS/trigger permit self-edits only to safe profile/private fields; Admin/HR can update company employees |
| `deactivateEmployee(id)` | `void` | Admin/HR only; sets `is_active = false` |
| `uploadAvatar(file)` | `string` | `avatars` bucket |

## `attendance.ts`

| function | returns | notes |
|---|---|---|
| `checkIn()` | `AttendanceRow` | Calls the guarded server action for the caller; errors if one already exists |
| `checkOut()` | `AttendanceRow` | Calls the guarded server action for the caller's open row |
| `todayStatus()` | `{ checkedIn: boolean; row: AttendanceRow \| null }` | Reads the caller's current-day row for the header control |
| `myAttendance(month)` | `AttendanceDay[]` | Current user's month, with derived `workHours` |
| `companyAttendance(date, { search? })` | `AttendanceDay[]` | Calls the guarded Admin/HR-only company register RPC |
| `attendanceSummary(employeeId, month)` | `{ present, absent, halfDay, leave }` | Count cards |

## `timeOff.ts`

| function | returns | notes |
|---|---|---|
| `myBalances()` | `{ paid: number; sick: number }` | Reads the caller's employee balances |
| `myRequests()` | `LeaveRequest[]` | |
| `createRequest(input)` | `LeaveRequest` | Server derives caller and working-day count; type is `paid`, `sick`, or `unpaid` |
| `cancelRequest(id)` | `void` | Own pending request only |
| `uploadAttachment(file)` | `string` | Stores a private object path in `leave-documents`; optional for MVP |
| `signedAttachmentUrl(path)` | `string` | Short-lived URL for an authorized employee or Admin/HR viewer |
| `pendingRequests()` | `LeaveRequest[]` | Admin/HR only |
| `allRequests({ search?, status? })` | `LeaveRequest[]` | Admin/HR only |
| `reviewRequest(id, status, comment?)` | `LeaveRequest` | Admin/HR only; server derives reviewer; approval adjusts balance exactly once and atomically |

## `salary.ts`

`frontend/src/lib/salary.ts` is a pure calculation, not a Supabase service. It
takes `monthlyWage` and returns Basic, HRA, Standard Allowance, Performance
Bonus, LTA, Fixed Allowance, PF, Professional Tax, and net pay. Employee salary
info reads their permitted `monthly_wage` from `employees`; Admin/HR edit that
same column. There is no `payroll.ts`, payslip, or salary-component service in
the MVP.
