# Services

**Owner: Praneet.** This is the frontend contract. Pages never call the API
directly; they call `frontend/src/services/`, which calls `/api`. If a function
is not listed here, it does not exist yet.

## Rules

- One file per domain: `auth.ts`, `company.ts`, `employees.ts`,
  `attendance.ts`, `timeOff.ts`, `dashboard.ts`, `notifications.ts`.
- Every function returns data or throws `ServiceError`. `services/client.ts`
  owns the one `api()` helper; a failed request throws the server's `{ message }`.
- Row types live in `frontend/src/types/models.ts` and follow `backend/src/schema.sql`.
- Dates cross the boundary as `YYYY-MM-DD`; money is a number of rupees rounded
  to two decimals.
- Demo data comes from `backend/src/seed.ts`; services never import fixtures.

Each service maps onto one or two API routes in `backend/src/routes/`.

## `auth.ts`

```ts
type SignUpCompanyInput = {
  companyName: string
  firstName: string
  lastName: string
  email: string
  password: string
  mobile?: string
}

type SignUpCompanyResult = { userId: string }
```

| function | route | notes |
|---|---|---|
| `signUpCompany(input)` | `POST /auth/signup` | Creates the company and first admin, and signs in |
| `signIn(email, password)` | `POST /auth/signin` | Returns `Session` |
| `signOut()` | `POST /auth/signout` | |
| `getSession()` | `GET /auth/session` | `Session \| null` |
| `onAuthChange(cb)` | — | Used by `AuthProvider`; returns an unsubscribe function |
| `changePassword(newPassword)` | `POST /auth/password` | Also clears `must_change_password` |
| `currentEmployee()` | `GET /auth/me` | The caller's full employee record, including role |

## `company.ts`

| function | route | notes |
|---|---|---|
| `getCompany()` | `GET /company` | Name, logo, time-off types, working schedule |
| `updateCompany(patch)` | `PATCH /company` | Admin/HR only |
| `uploadCompanyLogo(file)` | `POST /uploads/company-logos` | Returns the public URL |
| `deleteCompanyLogo(url)` | `DELETE /uploads/company-logos` | |

## `employees.ts`

| function | route | notes |
|---|---|---|
| `listEmployees({ search?, department? })` | `GET /directory` | Directory-safe columns plus derived `presence`; filtered client-side |
| `getEmployee(id)` | `GET /employees/:id` | Full record for self or Admin/HR; directory shape for a coworker. Also the manager's name and the active direct reports |
| `createEmployee(input)` | `POST /employees` | Admin/HR only; returns `{ employee, temporaryPassword }` once |
| `updateEmployee(id, patch)` | `PATCH /employees/:id` | Self: safe profile/private fields and résumé. Admin/HR: also wage, names, job, manager, joining date, role (not their own) |
| `deactivateEmployee(id)` | `POST /employees/:id/deactivate` | Admin/HR only; not yourself |
| `listInactiveEmployees()` | `GET /employees/inactive` | Admin/HR only |
| `reactivateEmployee(id)` | `POST /employees/:id/reactivate` | Admin/HR only; the employee keeps their password |
| `resetEmployeePassword(id)` | `POST /employees/:id/reset-password` | Admin/HR only, not yourself; returns a one-time temporary password and signs the employee out |
| `uploadResume(file)` / `deleteResume(path)` | `POST` / `DELETE /uploads/resumes` | Store the file, then attach it with `updateEmployee({ resume_path, resume_name })` |
| `resumeUrl(path)` | — | `/api/files/resumes/<path>`; owner and Admin/HR only |
| `uploadAvatar(file)` / `deleteAvatar(url)` | `POST` / `DELETE /uploads/avatars` | |

## `attendance.ts`

| function | route | notes |
|---|---|---|
| `checkIn()` / `checkOut()` | `POST /attendance/check-in`, `/check-out` | Caller's row for today; one of each per day |
| `todayStatus()` | `GET /attendance/today` | `{ checkedIn, row }` for the header control |
| `myAttendance(employeeId, month)` | `GET /attendance`, `GET /leave` | The month with gaps filled as leave or absent, and derived `work_hours` |
| `companyAttendance(date, { search? })` | `GET /attendance/company` | Admin/HR only day register |
| `summarizeAttendance(days)` / `attendanceSummary(employeeId, month)` | — | `{ present, absent, halfDay, leave }` for working days; today counts only once recorded |

## `timeOff.ts`

| function | route | notes |
|---|---|---|
| `myBalances(employeeId)` | `GET /employees/:id` | `{ paid, sick }` |
| `myRequests(employeeId)` | `GET /leave?employeeId=` | |
| `createRequest(input)` | `POST /leave` | Server derives requester and weekday count, checks the balance, and refuses overlap with your pending/approved requests |
| `cancelRequest(id)` | `DELETE /leave/:id` | Own pending request only; deletes its certificate |
| `pendingRequests()` / `allRequests({ search?, status? })` | `GET /leave` | Admin/HR see the whole company |
| `reviewRequest(id, status, comment?)` | `POST /leave/:id/review` | Admin/HR only; balance moves exactly once, notification written in the same transaction |
| `uploadAttachment(file)` / `deleteAttachment(path)` | `POST` / `DELETE /uploads/leave-documents` | Stores a private object path |
| `signedAttachmentUrl(path)` | — | `/api/files/leave-documents/<path>`; the server checks the session on open |

## `dashboard.ts`

| function | route | notes |
|---|---|---|
| `getDashboardSummary()` | `GET /dashboard` | Own attendance/balances/recent requests for everyone; company aggregates and pending requests only for Admin/HR |

## `notifications.ts`

`listNotifications()`, `unreadNotificationCount()`, `markNotificationRead()`,
and `markAllNotificationsRead()` (`/notifications`) operate only on the caller's
rows. The browser cannot create notifications or edit their content. The
header bell uses all four.

## Other frontend helpers

- `lib/team.ts` — `buildReportingTree(people)` for the directory's Team view.
- `hooks/useAppEvent.ts` — `ATTENDANCE_CHANGED`, fired by the header Check In
  control; the dashboard, attendance and directory reload on it.
- `services/client.ts` — any 401 outside sign-in ends the client session and
  returns to `/signin`.

## `salary.ts`

`frontend/src/lib/salary.ts` is a pure calculation, not a service. It takes
`monthlyWage` and returns Basic, HRA, Standard Allowance, Performance Bonus, LTA,
Fixed Allowance, PF, Professional Tax, and net pay. Employees read their own
`monthly_wage`; Admin/HR edit that same column.
