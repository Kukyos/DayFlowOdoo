# Dayflow: backend and middleware review notes

A plain-language guide to how Dayflow's "backend" works, written from the code in
`frontend/src/`, `backend/supabase/`, `vercel.json`, and `docs/AUTH.md` /
`docs/SERVICES.md`. Pair it with `docs/DBMS_REVIEW.md` for the database side.

## 1. There is no custom server

Dayflow has **no Express, Node, or Django API of its own**. It uses a
backend-as-a-service: **Supabase**. Think of Supabase as a ready-made backend
made of four parts:

| Part | What it does for Dayflow |
|---|---|
| **PostgreSQL** | Stores all data and enforces rules (constraints, RLS, triggers, functions) |
| **Data API** (auto-generated REST) | Turns table queries and function calls from the browser into SQL. This is what `supabase.from('employees').select()` and `supabase.rpc('check_in')` hit |
| **Auth** | Sign-up, sign-in, passwords, email confirmation, and JWT sessions. Users live in `auth.users` |
| **Storage** | File buckets for avatars, logos, leave certificates, and résumés |
| **Edge Functions** | Small server-side TypeScript programs (Deno). Dayflow has exactly one: `create-employee` |

So the `backend/` folder holds configuration and code that lives *inside* Supabase:
migrations (the schema), `seed.sql` (demo data), `config.toml` (local settings),
and the one Edge Function.

## 2. Architecture

```text
Browser (React 19 + Vite + Tailwind, hosted on Vercel)
  │
  │  pages  →  services/*.ts  →  supabase-js client
  │                                   │  HTTPS + JWT (Authorization header)
  ▼                                   ▼
┌───────────────────────── Supabase ─────────────────────────┐
│  Auth (JWT)   Data API    Storage     Edge Function         │
│                  │           │         create-employee      │
│                  ▼           ▼              │               │
│            PostgreSQL  (RLS · triggers · functions)  ◄──────┘
└─────────────────────────────────────────────────────────────┘
```

Stack from `frontend/package.json`: React 19, React Router 7, Vite 8,
Tailwind 4, TypeScript, `@supabase/supabase-js`.

## 3. Following one request: clicking "Check in"

1. The button calls `checkIn()` in `frontend/src/services/attendance.ts`.
2. That runs `supabaseClient().rpc('check_in')`.
3. `supabase-js` sends an HTTPS request to the Data API with the user's **JWT**
   in the `Authorization` header.
4. Supabase verifies the JWT, then runs the database function as the
   `authenticated` role. Inside the function, `auth.uid()` reads the user's id
   from that JWT.
5. The `check_in()` function inserts today's `attendance` row. The UNIQUE
   constraint blocks a second check-in.
6. The row comes back to the browser and the service returns it, or throws a
   `ServiceError` with a friendly message.

The key idea: the browser never sends "I am employee X". The database learns who
is calling from the verified token.

## 4. Where the "middleware" is

Classic middleware is code that sits between a request and the real handler and
checks things like "is this user logged in?". With no Express server, Dayflow
spreads that job across several layers:

| Layer | File / place | What it does | Real security? |
|---|---|---|---|
| **Route guards** | `components/auth/RouteGuards.tsx`, `router.tsx` | `ProtectedRoute` (must be signed in), `AdminRoute` (Admin/HR only), `PublicOnlyRoute` (signed-in users skip sign-in), `PasswordChangeRoute` (forced password change) | **No.** Only decides what screens to show |
| **Session context** | `context/AuthProvider.tsx`, `context/session.ts` | Restores the session, loads the employee row, exposes `isPrivileged` and `mustChangePassword` through `useSession()` | No |
| **Service layer** | `services/*.ts`, `services/client.ts` | The only code that talks to Supabase. Pages never import the client. `unwrap()` turns errors into `ServiceError` | No |
| **JWT check** | Supabase gateway | Rejects requests without a valid token | **Yes** |
| **RLS policies** | Postgres | Filter which rows each user can read or write | **Yes** |
| **Triggers** | Postgres | Block forbidden column changes (e.g. an employee editing their own wage) | **Yes** |
| **Function guards** | `is_privileged()` checks inside RPCs | Refuse non-Admin/HR callers | **Yes** |
| **Edge Function wrapper** | `withSupabase({ auth: "user" })` | Verifies the caller's JWT before the handler runs, then gives it two clients (see section 6) | **Yes** |

`docs/AUTH.md` states the rule directly: *"Route guards are a user experience
measure; RLS is the security boundary."* If someone bypasses the UI and calls the
API by hand, the database still refuses.

### Helpers worth knowing

- `useAsync(fn, deps)` (`hooks/useAsync.ts`) gives every page loading, ready and
  error states. It also ignores stale responses (the `alive` flag), so a slow old
  search can't overwrite a newer one.
- `useDebounced` waits 250 ms before searching so every keystroke doesn't hit the
  server.
- `types/database.ts` is generated from the database, so TypeScript knows every
  table, column and function signature.
- `services/dashboard.ts` checks the shape of the JSON that
  `get_dashboard_summary()` returns instead of trusting it blindly.

## 5. Authentication

- **Method:** email and password only. There is no social login.
- **Tokens:** Supabase issues a **JWT** (valid 3600 seconds in `config.toml`) plus
  a refresh token. Refresh-token rotation is enabled. `supabase-js` stores the
  session in the browser and refreshes it automatically.
- **Session state:** `AuthProvider` subscribes to `onAuthStateChange`. Its status
  is `loading`, `authenticated` or `unauthenticated`. Loading is not treated as
  signed out, so a refresh doesn't flash the sign-in page.
- **Company sign-up:** `signUpCompany()` calls `auth.signUp()` with metadata. A
  database trigger (`on_auth_user_created_create_company`) then creates the
  company and the first `admin` employee row in the same transaction. The role is
  set by the trigger, never by the client.
- **Email confirmation:** required (`enable_confirmations = true`). Sign-up
  returns no session until the user clicks the link. Confirmation links return to
  `/signin`, and the Vercel URL must be in the Auth redirect allow-list.
- **Employees don't self-register.** Admin/HR create them through the Edge
  Function (next section).
- **First login for created employees:** `must_change_password = true` locks them
  to `/change-password`. A database trigger clears the flag only when Supabase
  Auth actually changes the password hash, so the browser can't clear it itself.
- **Safe error messages:** sign-in says "Those details do not match an account"
  for every failure, so it can't be used to discover which emails exist.
- **Client-side checks** (password length and letter+number rule, email format)
  give instant feedback. The server enforces the real rules.

## 6. The one custom server program: `create-employee`

File: `backend/supabase/functions/create-employee/index.ts`.

**Why it exists:** creating a user needs Supabase's **service-role key**, which
bypasses all security rules. That key must never reach a browser, so this step
runs on the server.

It uses two clients provided by `withSupabase`:

- `ctx.supabase`: acts *as the calling user*, so RLS applies.
- `ctx.supabaseAdmin`: uses the service-role key and bypasses RLS.

**Step by step:**

1. Only `POST` is allowed (otherwise 405).
2. Parse and validate the body: names, email format, `YYYY-MM-DD` date, wage at
   least ₹24,998, role in `admin`/`hr`/`employee`.
3. Confirm who is calling with `getUser()`, then load the caller's employee row
   through the RLS-scoped client. Reject unless they are an active Admin or HR
   (403).
4. If a manager is given, check with the admin client that they are an active
   employee of the same company.
5. Generate a random temporary password with `crypto.getRandomValues`.
6. `auth.admin.createUser()` creates the Auth account (409 if the email is
   taken).
7. Insert the matching `employees` row with `must_change_password: true`.
8. **If step 7 fails, delete the Auth user again** (a compensating action), then
   return an error.
9. Return the employee and the temporary password **once**. The password isn't
   stored in plaintext and isn't emailed.

**Concept to mention:** Auth and the application tables are separate systems, so
step 6 and step 7 can't share one database transaction. Step 8 is a manual
"undo". Compare this with `review_leave_request()`, which is one real
transaction and rolls back automatically.

## 7. Authorization (who may do what)

Three roles stored in `employees.role`: `admin`, `hr`, `employee`. Admin and HR
are equally privileged in this MVP.

| Area | Employee | Admin / HR |
|---|---|---|
| Own employee row | Read, and edit permitted profile fields | Read and edit all company employees |
| Coworkers | Safe directory data only (no wage, bank details or balances) | Full rows |
| Attendance | Own; check in and out via RPC | Whole company for any day |
| Leave | Create and cancel own pending requests | See all; approve or reject |
| Create or deactivate employees | No | Yes |
| Company settings | No | Yes |

The role is read from the database, never from user-editable metadata. The
safe-directory trick: employees can't `SELECT` coworkers' rows, so a
`SECURITY DEFINER` function (`list_employee_directory`) returns only the safe
columns.

## 8. File storage

- **Buckets:** `avatars` and `company-logos` (public), `leave-documents` (private).
  The code also uses a private `resumes` bucket (see section 11).
- **Paths:** `<company-id>/<employee-id>/<random-uuid>.<ext>`. Storage policies
  check these path segments, so users can only touch their own company's files.
- **Limits:** avatars and logos 5 MB, leave documents 10 MB, résumés 5 MB. Allowed
  MIME types are enforced per bucket.
- **Private files** open through `createSignedUrl(path, 60)`: a link that expires
  after 60 seconds.
- **Cleanup on failure:** `uploadResume()` uploads the file, then updates the
  employee row. If the row update fails, it deletes the just-uploaded file. This
  is another manual compensation, in the browser this time.

## 9. API map: frontend call to database object

| Service function | Supabase call | Database side |
|---|---|---|
| `signIn` / `signOut` / `signUpCompany` | `auth.*` | Auth + sign-up trigger |
| `currentEmployee` | `from('employees').select('*')` | RLS "own row" |
| `listEmployees` | `rpc('list_employee_directory')` | Safe projection + derived presence |
| `updateEmployee` | `from('employees').update()` | RLS + update-boundary trigger |
| `createEmployee` | `functions.invoke('create-employee')` | Edge Function |
| `deactivateEmployee` | `rpc('deactivate_employee')` | Soft delete (`is_active = false`) |
| `checkIn` / `checkOut` | `rpc('check_in')` / `rpc('check_out')` | One row per day |
| `myAttendance` | `from('attendance')` + `from('leave_requests')` | RLS; gaps filled in the browser |
| `companyAttendance` | `rpc('list_company_attendance')` | Admin/HR only, LEFT JOIN |
| `createRequest` | `rpc('create_leave_request')` | Server counts working days |
| `reviewRequest` | `rpc('review_leave_request')` | One transaction, row lock |
| `cancelRequest` | `from('leave_requests').delete()` | Policy allows own *pending* only |
| `getDashboardSummary` | `rpc('get_dashboard_summary')` | One call returning JSON |
| notifications | `from('notifications')` | Own rows; only `read_at` editable |

`get_dashboard_summary()` replaced six separate browser round trips with one
call. Fewer network requests is a performance point worth making.

## 10. Deployment and configuration

- **Frontend:** built and hosted on Vercel. `vercel.json` sets the install and
  build commands, the output folder `frontend/dist`, and a rewrite of every path
  to `index.html`. That rewrite is what lets React Router handle URLs like
  `/dashboard` on a hard refresh.
- **Backend:** a hosted Supabase project. `config.toml` configures the *local*
  Supabase stack (ports, auth settings, redirect URLs).
- **Environment variables:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
  Vite exposes `VITE_`-prefixed variables to the browser. That's fine for the
  anon key because it is public by design and RLS protects the data. The
  **service-role key** is never in the frontend.

## 11. Likely viva questions

- **Where is your backend?** Supabase (Postgres, Auth, Storage, Edge Function).
  Business rules live in database functions, RLS policies and triggers, not in a
  separate API server.
- **If the frontend is public, what stops a user editing the request?** The JWT
  proves who they are, and RLS, triggers and function guards enforce what they may
  do. The UI guards are only for convenience.
- **Why an Edge Function for creating employees?** It needs the service-role key,
  which can't go to the browser. It also creates an Auth user and a table row,
  which no single SQL transaction can cover.
- **What happens if the second step fails?** The function deletes the Auth user it
  just created (compensating action).
- **Anon key vs service-role key?** The anon key is public and subject to RLS. The
  service-role key bypasses RLS and stays on the server.
- **What is a JWT?** A signed token containing the user's id and role. The server
  verifies the signature and trusts the claims inside it.
- **Why a service layer?** One place for every backend call, consistent error
  handling, and the ability to change the backend without touching pages.
- **Why `SECURITY DEFINER` functions?** They run with the owner's rights so they
  can return a safe subset of data that RLS would otherwise hide, and they check
  the caller themselves.

## 12. Honest notes and weak spots

- **The repo's migrations are behind the hosted database.** `types/database.ts`
  and `services/employees.ts` use `resume_path`, `resume_name`,
  `resume_uploaded_at` and a `resumes` bucket, and `docs/SERVICES.md` and
  `TimeOff.tsx` describe an overlap check on leave approval. None of these appear
  in any file under `backend/supabase/migrations/`. They were presumably applied
  straight to the hosted project. A fresh `supabase db reset` from this repo would
  not recreate them. Before the review, either generate a migration from the
  hosted schema (`supabase db pull`) or be ready to say so.
- **Search runs in the browser.** `listEmployees()` fetches the whole directory
  and filters in JavaScript, and `getEmployee()` fetches the whole directory to
  find one person. That's fine for a small company, but it wouldn't scale.
  `config.toml` also caps API responses at 1000 rows.
- **Compensating actions aren't atomic.** If the browser closes between an upload
  and the row update, an orphan file can remain.
- **Email isn't sent for new employees.** The temporary password is shown once to
  the creating Admin/HR.
- **Leaked-password protection** is noted in `docs/AUTH.md` as a hosted Auth
  setting still to enable.
- **Demo accounts:** the README warns the demo logins and the reveal panel
  (`components/auth/DemoCredentials.tsx`) must be removed before real data is
  stored.
