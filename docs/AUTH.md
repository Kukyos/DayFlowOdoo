# Auth

The session and access contract for the four-table hackathon MVP.

## Registration and roles

Public Sign Up is for a **new company only**. It creates one `companies` row and
the first `employees` row with `role = 'admin'`. The database—not client-supplied
metadata—sets that role.

The sign-up request supplies `company_name`, `first_name`, `last_name`, and an
optional `mobile` value as profile metadata. The auth service adds the internal
`registration_type = 'company'` discriminator; callers never supply a role.
After sign-in, Admin/HR can upload the company logo from the account menu; the
public sign-up transaction itself does not attempt a pre-session upload.

Employees never self-register. An Admin or HR user creates an employee through a
server-side operation, which creates `auth.users` and the linked `employees` row
and returns a cryptographically secure temporary password once. The frontend
never receives a service-role key, and the temporary password is never stored in
plaintext by the application. The authenticated `create-employee` Edge
Function holds the server credential, checks the caller's live employee role,
and removes the new Auth user if linking the employee row fails.

| role | access |
|---|---|
| `admin` | Full company access |
| `hr` | Same privileged access for this MVP |
| `employee` | Own full row, own attendance, own leave; directory-safe coworker data |

`admin` and `hr` are privileged. SQL and TypeScript each centralize that test;
components must not make their own role comparison.

## Sign-in

Employees may sign in with **work email + password** or their generated
**Login ID + password**. Login IDs use the company-name first word in uppercase
plus a six-digit sequence (for example, `ODOO-000001`) and never change after
creation. Employee creation generates a Login ID and a temporary password.

Email confirmation is required. Company sign-up creates the Auth user, company,
and first admin atomically, but returns no session. The page shows a check-email
state; after following the confirmation link, the user signs in normally and is
redirected to `/dashboard`. Passwords must contain at least eight characters.

**Dashboard action remaining:** enable Auth leaked-password protection. The
linked project's security advisor still reports it disabled; this is a hosted
Auth setting rather than a repository migration.

HR-created employees are created with confirmed email and
`must_change_password = true`. Their first successful sign-in is restricted to
the password-change screen. A private database trigger clears the flag only
when Supabase Auth changes that user's actual password hash; clients cannot
clear it with a direct employee-row update. The generated password is shown
only to the creating Admin/HR and is not sent by email in the MVP.

For local development, confirmation links return to
`http://localhost:5173/signin`. Hosted Vercel URLs must be added to the Supabase
Auth redirect allow-list before testing a deployed preview.

## Session state

`AuthProvider` exposes:

```ts
{
  status: 'loading' | 'authenticated' | 'unauthenticated',
  session: Session | null,
  employee: Employee | null,
  employeeError: string | null,
  isPrivileged: boolean,
  mustChangePassword: boolean,
  refreshEmployee: () => Promise<Employee | null>
}
```

It starts at `loading` while Supabase restores the persisted session. Do not
treat loading as unauthenticated. The employee record is fetched after the
session, so callers handle `employee === null` briefly. If the session is valid
but the employee row cannot be loaded, guards show `employeeError` with retry
and logout actions instead of treating the user as signed out.

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
experience measure; RLS is the security boundary.

## Dev accounts

Seed and share privately one admin account and one employee account. Both may
use normal email/password authentication or their generated Login ID; no mock
user or development bypass.
Supabase persists a browser session, so the team can log in once and exercise
the same RLS path during the demo.
