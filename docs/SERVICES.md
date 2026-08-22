# Services

**Owner: Praneet.** The contract between the frontend and Supabase. Every
function the frontend may call is listed here; nothing else exists.

**Pages never import `supabase`.** Pages call `frontend/src/services/`; services
call Supabase. If the function you need is not in this file, ask — do not reach
around the layer, and do not invent a signature.

## Rules

- One file per domain: `auth.ts`, `employees.ts`, `attendance.ts`, `timeOff.ts`,
  `salary.ts`, `payroll.ts`, `company.ts`.
- Every function returns the data or **throws**. No `{ data, error }` tuples
  leaking into pages — one `unwrap()` helper in `services/client.ts` turns a
  Supabase error into a thrown `Error`, and pages use their normal error state.
- Types come from `frontend/src/types/database.ts`, which is generated. Run
  `npx supabase gen types typescript` after every migration and commit it. Never
  hand-edit it, and never write a second definition of a row type.
- Dates cross the boundary as `YYYY-MM-DD` strings, not `Date` objects.
- Money crosses as `number` in rupees, already rounded to 2 decimals.

## Stubbing, during Stage 3

A service that does not exist yet is **stubbed at its real signature**, returning
data from `frontend/src/fixtures/`. The page is never blocked, and the contract
is proven before it is implemented. `fixtures/` lives outside `services/` because
`services/` is one owner's lane; fixture shapes must match `SCHEMA.md` columns
exactly, so Stage 4 is a one-line import swap per page.

---

## `auth.ts`

| function | returns | notes |
|---|---|---|
| `signUpCompany({ companyName, logoFile, adminName, email, password })` | `Session` | Public Sign Up. Creates the company **and** its first admin. The only public registration path |
| `signIn(loginIdOrEmail, password)` | `Session` | Accepts either the login ID or the work email. A login ID is resolved to its email first |
| `signOut()` | `void` | |
| `getSession()` | `Session \| null` | |
| `onAuthChange(cb)` | unsubscribe fn | Wraps `onAuthStateChange` for `AuthProvider` |
| `changePassword(newPassword)` | `void` | Also clears `must_change_password` |
| `currentEmployee()` | `Employee` | The caller's own row, with `role`. What `AuthProvider` puts in context |

## `company.ts`

| function | returns | notes |
|---|---|---|
| `getCompany()` | `Company` | The caller's company. Header logo and name |
| `updateCompany(patch)` | `Company` | Admin only |

## `employees.ts`

| function | returns | notes |
|---|---|---|
| `listEmployees({ search?, department? })` | `EmployeeCard[]` | The directory grid. Reads `employee_presence`, so each card carries `presence: 'present' \| 'leave' \| 'absent'` |
| `getEmployee(id)` | `EmployeeProfile` | Profile in view mode. Includes `private` and `resume` when the caller may see them, null when not |
| `createEmployee(input)` | `{ employee, loginId, tempPassword }` | **Admin/HR only.** Generates the login ID and a first password, seeds the six default salary components and the standard time-off allocations. See `AUTH.md` §5 — mechanism decided in Stage 2 |
| `updateEmployee(id, patch)` | `Employee` | RLS decides which fields land. Self-edit is limited to `mobile`, `avatar_url`, `about`, `job_love`, `interests` |
| `updatePrivateInfo(id, patch)` | `EmployeePrivate` | Private Info tab |
| `uploadAvatar(id, file)` | `string` | Returns the public URL. Supabase Storage bucket `avatars` |
| `listResumeItems(id)` | `ResumeItem[]` | Skills + certifications |
| `addResumeItem(id, item)` | `ResumeItem` | The "+ Add Skills" control |
| `removeResumeItem(itemId)` | `void` | |
| `deactivateEmployee(id)` | `void` | Sets `is_active = false`. Never a hard delete |

## `attendance.ts`

| function | returns | notes |
|---|---|---|
| `checkIn()` | `AttendanceRow` | Today, for the caller. Throws if already checked in today |
| `checkOut()` | `AttendanceRow` | Throws if there is no open row today |
| `todayStatus()` | `{ checkedIn: boolean; row: AttendanceRow \| null }` | Drives the header Check In / Check Out control |
| `myAttendance(month)` | `AttendanceDay[]` | Day-wise for the caller, one entry per calendar day of `month`, with `workHours` and `extraHours` derived and gaps filled as absent |
| `companyAttendance(date, { search? })` | `AttendanceDay[]` | **Admin/HR only.** Every employee for one day — the wireframe's admin list view |
| `attendanceSummary(employeeId, month)` | `{ present, absent, halfDay, leave, totalWorkingDays }` | The count cards above the table |

## `timeOff.ts`

| function | returns | notes |
|---|---|---|
| `myBalances()` | `Balance[]` | From `time_off_balances`. Feeds the "24 Days Available" cards |
| `myRequests()` | `TimeOffRequest[]` | Employee list view |
| `createRequest(input)` | `TimeOffRequest` | Computes working days in the range. Requires an attachment when the type says so |
| `cancelRequest(id)` | `void` | Only while `pending` |
| `uploadAttachment(file)` | `string` | Storage bucket `timeoff-attachments` |
| `listTypes()` | `TimeOffType[]` | Populates the type select |
| `pendingRequests()` | `TimeOffRequest[]` | **Admin/HR only.** The approval queue, newest first |
| `allRequests({ search?, status? })` | `TimeOffRequest[]` | **Admin/HR only.** Full list view |
| `reviewRequest(id, 'approved' \| 'rejected', comment?)` | `TimeOffRequest` | **Admin/HR only.** Stamps `reviewed_by` and `reviewed_at` |
| `allocate(input)` | `TimeOffAllocation` | **Admin/HR only.** The Allocation form |

## `salary.ts`

| function | returns | notes |
|---|---|---|
| `getStructure(employeeId)` | `{ structure, components }` | **Admin/HR only** — RLS denies an employee even their own row |
| `updateWage(employeeId, wage)` | `{ structure, components }` | Persists the wage. Amounts are not stored; they recompute |
| `updateComponent(id, patch)` | `SalaryComponent` | Change a computation type or a percentage |
| `updateTaxes(employeeId, patch)` | `SalaryStructure` | PF percentages, professional tax |

`frontend/src/lib/salary.ts` — **not a service**, a pure function, no Supabase
import, owned by Praneet but readable by everyone:

```ts
computeSalary(wage: number, components: SalaryComponent[], taxes: TaxConfig): {
  lines: { name: string; amount: number }[]
  gross: number            // must equal wage
  deductions: { name: string; amount: number }[]
  employerCost: { name: string; amount: number }[]   // employer PF — shown, never subtracted
  net: number
}
```

The Salary Info tab calls it on every keystroke in the wage field — no round-trip,
no loading state, the whole table just moves. Payroll calls the same function.
Rules and worked example are in `SCHEMA.md`.

## `payroll.ts` — Tier 2

| function | returns | notes |
|---|---|---|
| `payableDays(employeeId, month)` | `{ totalWorkingDays, payableDays, unpaidLeaveDays, missingDays }` | Attendance and approved leave decide this. The interesting query in the build |
| `generatePayslip(employeeId, month)` | `Payslip` | **Admin/HR only.** Combines `payableDays` with `computeSalary` and snapshots the result into `breakdown` |
| `myPayslips()` | `Payslip[]` | Read-only for the employee. Their salary view |
| `getPayslip(id)` | `Payslip` | The printable slip |

## Not services

Charts, formatting, and date maths are `frontend/src/lib/`, not `services/`.
A function that does not touch Supabase does not belong behind the data layer.
