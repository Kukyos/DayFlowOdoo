# Auth

The session and access contract between the frontend and the local API.

## Registration and roles

Public Sign Up is for a **new company only**. `POST /api/auth/signup` creates
the user, one `companies` row, and the first `employees` row with
`role = 'admin'` in a single transaction, then signs the new admin straight in.
The server sets the role; the request cannot supply one. There is no email
confirmation step.

The sign-up form supplies `companyName`, `firstName`, `lastName`, `email`,
`password`, and an optional `mobile`. After sign-in, Admin/HR can upload the
company logo from the account menu.

Employees never self-register. An Admin or HR user creates an employee through
`POST /api/employees`, which creates the user and the linked employee row and
returns a random temporary password **once**. Only the password hash is stored.

| role | access |
|---|---|
| `admin` | Full company access |
| `hr` | Same privileged access for this MVP |
| `employee` | Own full record, own attendance, own leave; directory-safe coworker data |

`admin` and `hr` are privileged. The API (`isPrivileged()` in
`backend/src/auth.ts`) and the frontend (`isPrivileged()` in `types/models.ts`)
each centralise that test; components must not make their own role comparison.

## Sign-in

Email + password. Passwords need at least eight characters with a letter and a
number. A wrong password, an unknown email and a deactivated account all get the
same "Those details do not match an account." answer.

HR-created employees start with `must_change_password = true`. Their first
sign-in is restricted to the password-change screen. `POST /api/auth/password`
replaces the password hash and clears the flag in one transaction; the flag
cannot be cleared through a profile update. The temporary password is shown only
to the creating Admin/HR and is not emailed.

## Sessions

A session is a random 256-bit token in the `dayflow_session` cookie: HttpOnly,
SameSite=Lax, 30 days. The token is looked up in the `sessions` table on every
request. The browser reaches the API through Vite's `/api` proxy, so the cookie
is first-party and needs no CORS setup.

## Session state

`AuthProvider` exposes:

```ts
{
  status: 'loading' | 'authenticated' | 'unauthenticated',
  session: Session | null,          // { user: { id, email } }
  employee: Employee | null,
  employeeError: string | null,
  isPrivileged: boolean,
  mustChangePassword: boolean,
  refreshEmployee: () => Promise<Employee | null>
}
```

It starts at `loading` until `GET /api/auth/session` says whether the cookie is
still valid. Do not treat loading as unauthenticated. The employee record is
fetched after the session, so callers handle `employee === null` briefly. If the
session is valid but the employee record cannot be loaded, guards show
`employeeError` with retry and logout actions instead of treating the user as
signed out.

`services/auth.ts` notifies `AuthProvider` through `onAuthChange` with
`INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`, and `USER_UPDATED` (after a
password change, so the cleared flag is reloaded).

## Routes

| route | guard |
|---|---|
| `/` | redirect: authenticated users to `/dashboard`, otherwise `/signin` |
| `/signin`, `/signup` | public; redirect authenticated users to `/dashboard` |
| `/change-password` | authenticated; mandatory while `must_change_password` is true |
| `/dashboard` | authenticated |
| `/employees`, `/employees/:id` | authenticated |
| `/employees/new` | Admin/HR |
| `/attendance` | authenticated; own/company view selected by role |
| `/time-off` | authenticated; own/company view selected by role |
| `/time-off/approvals` | Admin/HR |
| `/profile` | authenticated own profile |

Use `ProtectedRoute` and `AdminRoute`. An authenticated employee denied an
Admin/HR route goes to `/dashboard`, not `/signin`. Route guards are a user
experience measure; the API is the security boundary.

## Dev accounts

`backend/src/seed.ts` creates `odootestadmin@gmail.com` (Admin) and
`odootestemployee@gmail.com` (Employee), plus four team accounts, all with the
password `DayflowDemo7!`. The sign-in page's demo panel fills the first two.
There is no mock user or development bypass.
