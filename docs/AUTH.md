# Auth

The session and access contract for the four-table hackathon MVP.

## Registration and roles

Public Sign Up is for a **new company only**. It creates one `companies` row and
the first `employees` row with `role = 'admin'`. The database—not client-supplied
metadata—sets that role.

Employees never self-register. An Admin or HR user creates an employee through a
server-side Supabase invite operation, which creates `auth.users` and the linked
`employees` row. The frontend never receives a service-role key.

| role | access |
|---|---|
| `admin` | Full company access |
| `hr` | Same privileged access for this MVP |
| `employee` | Own full row, own attendance, own leave; directory-safe coworker data |

`admin` and `hr` are privileged. SQL and TypeScript each centralize that test;
components must not make their own role comparison.

## Sign-in

The required MVP path is **email + password**. `login_id` may be generated for
HR display, but resolving it before authentication is out of scope. This avoids
an unauthenticated employee-email lookup and keeps time on HR features.

## Session state

`AuthProvider` exposes:

```ts
{
  status: 'loading' | 'authenticated' | 'unauthenticated',
  session: Session | null,
  employee: Employee | null,
  isPrivileged: boolean
}
```

It starts at `loading` while Supabase restores the persisted session. Do not
treat loading as unauthenticated. The employee record is fetched after the
session, so callers handle `employee === null` briefly.

## Routes

| route | guard |
|---|---|
| `/` | public landing |
| `/signin`, `/signup` | public; redirect authenticated users to `/dashboard` |
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

Seed and share privately one admin account and one employee account. Both use
normal email/password authentication; no mock user or development bypass.
Supabase persists a browser session, so the team can log in once and exercise
the same RLS path during the demo.
