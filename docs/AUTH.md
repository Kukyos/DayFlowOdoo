# Auth

The session-state and routing contract between the public pages and the app.
Read this before building any route or any guard.

## 1. Who can register

**Only a company can register itself.** Public Sign Up creates a company and its
first admin, in one step: company name, logo, admin name, email, password.

**An employee cannot self-register.** HR or an admin creates them; the system
issues a login ID and a first password. This is the wireframe's rule and it wins
over the PDF's §3.1.1, which describes an open sign-up with a role dropdown. An
open sign-up with a role dropdown would let anyone select "HR" and read every
salary in the company.

So the public surface is exactly three routes: landing, sign in, sign up.

## 2. Roles

| role | means |
|---|---|
| `admin` | Full access. Created by Sign Up |
| `hr` | HR officer. Same access as `admin` in this build |
| `employee` | Own data only |

`admin` and `hr` are both privileged; `is_privileged()` in SQL and
`isPrivileged(employee)` in TS are the only checks anywhere. **Never compare
`role === 'admin'` in a component** — the day HR needs to differ, it is one
function to change instead of thirty comparisons.

## 3. Session state

`AuthProvider` (`frontend/src/context/AuthProvider.tsx`, backend lane) exposes:

```ts
{ status: 'loading' | 'authenticated' | 'unauthenticated',
  session: Session | null,
  employee: Employee | null,   // includes role — null while loading
  isPrivileged: boolean }
```

`status` starts at `loading` on every mount, because Supabase reads the persisted
session asynchronously. **A guard that treats `loading` as `unauthenticated`
bounces a logged-in user to sign-in on every refresh.** Render nothing (or a
splash) while loading; decide only once `status` settles.

`employee` is fetched after the session resolves, so there is a window where
`status === 'authenticated'` and `employee === null`. Anything reading
`employee.role` must handle it.

## 4. Routing

| route | guard |
|---|---|
| `/` landing | public |
| `/signin`, `/signup` | public; redirect to `/dashboard` if already authenticated |
| `/change-password` | authenticated; **forced** when `must_change_password` |
| `/dashboard` | authenticated |
| `/employees`, `/employees/:id` | authenticated |
| `/employees/new` | privileged |
| `/attendance` | authenticated — the page itself switches between the own view and the company view on `isPrivileged` |
| `/time-off` | authenticated — same split |
| `/time-off/approvals` | privileged |
| `/profile` | authenticated (own profile) |
| `/payslips` | authenticated (own) |

Two guards only: `ProtectedRoute` and `AdminRoute`. `AdminRoute` sends a
non-privileged user to `/dashboard`, not to `/signin` — they are logged in, they
are simply not allowed here, and a sign-in bounce reads as a bug.

**The forced password change outranks every other redirect.** If
`must_change_password` is true, every authenticated route redirects to
`/change-password` except that route itself. Get this right once, in
`ProtectedRoute`, not per page.

**The guard is not the security boundary. RLS is.** A guard hides a screen; it
does not stop a request. Every rule here has a matching policy in `SCHEMA.md`.

## 5. Creating an employee — open decision, Stage 2

Creating an auth user for someone else needs the Supabase `service_role` key,
which cannot reach the browser. Two ways, and the team decided to choose in
Stage 2 rather than now.

**Option A — Edge Function.** `createEmployee` calls an Edge Function that holds
`service_role`, creates the auth user with a generated password, inserts the
`employees` row, and returns the login ID and temp password once for HR to hand
over.

- Correct, and matches the wireframe exactly.
- Cost, and it is real: the function and its secret deploy to Supabase separately
  from the Vercel build, so **a green Vercel deploy stops implying a working
  app**. Whoever takes this owns deploying it and saying so.

**Option B — pending row plus claim.** HR creates an `employees` row with a
generated login ID and no auth user. The person completes a one-time sign-up with
that login ID, which links the auth user to the waiting row.

- No Edge Function, no second deploy, no service key.
- Bends the "a normal user cannot register" rule, and needs its own care: the
  claim path must accept a login ID that exists, is unclaimed, and is in the
  right company — otherwise it is an open sign-up with extra steps.

Whichever is chosen: **the generated password is shown to HR exactly once**, at
creation, and `must_change_password` is true. Never email it, never store it in
plaintext, never render it again on the profile.

## 6. Dev accounts

Two seeded accounts, in the shared Supabase project, both with
`must_change_password = false`. Everyone logs in as these all day. Supabase
persists the session in local storage by default — **leave that on**, log in
once, and the session survives reloads and restarts. Nobody needs a dev bypass,
and everyone exercises the real auth path all day.

| role | login | password |
|---|---|---|
| Admin / HR | _(seeded by Praneet in Stage 2)_ | _(shared privately, never committed)_ |
| Employee | _(seeded by Praneet in Stage 2)_ | _(shared privately, never committed)_ |

**These are a Stage 2 exit criterion, not a Stage 4 task.** Until they exist,
every screen behind `ProtectedRoute` is unreviewable. A previous run built ten
screens nobody could open.

**Never build a mock user object.** A fake user passes the route guard, then
every query still goes out without a JWT, RLS rejects it, and the afternoon
disappears into phantom 401s.

Until the seeds exist, the stopgap is a smoke test that renders every route with
an unauthenticated and a mocked-authenticated provider and asserts no crash. One
file, and it catches the class of error an auth wall hides.
