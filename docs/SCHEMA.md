# Dayflow schema

The database is one SQLite file, `backend/data/dayflow.db`, created from
`backend/src/schema.sql` on first run and seeded with the demo company.
`npm run db:reset` deletes it (and the uploads folder) and starts over.

Conventions: `snake_case`; ids are UUID strings from `crypto.randomUUID()`;
calendar days are `YYYY-MM-DD` text; timestamps are ISO-8601 UTC text; money and
leave balances are `real` rupees/days; booleans are `0`/`1`; array columns are
JSON text. The API converts booleans and arrays back when it sends a row, so the
frontend sees the shapes in `frontend/src/types/models.ts`.

```text
users → employees → attendance
                  → leave_requests → notifications
companies → employees
users → sessions
```

The database stores data; **access rules live in the API** (`backend/src/routes/`).
The browser never reaches the database directly.

## `users` and `sessions`

`users` holds sign-in credentials: `id`, `email` (unique, case-insensitive),
`password_hash` (scrypt), `created_at`. Every user has exactly one `employees`
row with the same `id`.

`sessions` maps a random token (the `dayflow_session` HttpOnly cookie) to a
`user_id`. Signing out deletes the row; changing a password deletes the user's
other sessions; deactivating an employee deletes all of theirs.

## `companies`

Created with the first admin during company sign-up.

| column | type | notes |
|---|---|---|
| `id` | text pk | |
| `name` | text not null | e.g. `Odoo India` |
| `logo_url` | text | `/api/files/company-logos/...` |
| `time_off_types` | JSON text, default paid/sick/unpaid | Labels available in the request form |
| `working_days` | JSON text, default `[1,2,3,4,5]` | Sunday = 0 through Saturday = 6 |
| `workday_start` / `workday_end` | text, default `09:00:00`/`17:00:00` | Start must be before end |
| `created_at` | text | |

## `employees`

One row per user. `employees.id = users.id`. There are no department, skill,
salary-component or leave-allocation tables.

| column | type | notes |
|---|---|---|
| `id` | text pk | → `users(id)` on delete cascade |
| `company_id` | text not null | → `companies(id)` |
| `role` | text not null | `admin`, `hr`, or `employee` |
| `first_name` / `last_name` | text not null | |
| `work_email` | text not null | The sign-in email; never changed through the API |
| `mobile`, `job_position`, `department`, `location` | text | Department is a plain string |
| `manager_id` | text | → `employees(id)`, on delete set null |
| `date_of_joining` | text date | |
| `avatar_url` | text | `/api/files/avatars/...` |
| `about`, `skills` | text, JSON text | Resume tab |
| `date_of_birth`, `address`, `bank_account_number`, `ifsc_code`, `pan_no`, `uan_no` | text | Private Info |
| `monthly_wage` | real | The one salary input; at least ₹24,998 when set |
| `paid_leave_balance` | real default 24 | Moved only when paid leave is approved |
| `sick_leave_balance` | real default 7 | Moved only when sick leave is approved |
| `resume_path`, `resume_name`, `resume_uploaded_at` | text | Private résumé in the `resumes` store; path must be in the employee's own folder |
| `is_active` | 0/1 default 1 | Soft deactivation |
| `must_change_password` | 0/1 default 0 | Set for HR-created accounts until the temporary password is replaced |
| `created_at` | text | |

`admin` and `hr` are privileged. The role is stored data, assigned by the server.

### Salary calculation

`frontend/src/lib/salary.ts` calculates, without database tables:

- Basic: 50% of monthly wage
- HRA: 50% of Basic
- Standard Allowance: ₹4,167
- Performance Bonus and LTA: 8.33% of Basic each
- Fixed Allowance: the remaining wage
- PF: 12% of Basic; Professional Tax: ₹200

₹24,998 is the lowest wage whose fixed allowance is not negative, which is why
the schema and `POST /api/employees` both enforce it.

## `attendance`

One row per employee per work date (`unique (employee_id, work_date)`).

| column | type | notes |
|---|---|---|
| `id` | text pk | |
| `employee_id` | text not null | → `employees(id)` on delete cascade |
| `work_date` | text date | Asia/Kolkata calendar day |
| `check_in` / `check_out` | text timestamp | `check_out` is null until Check Out, and never before `check_in` |
| `status` | text default `present` | `present`, `half_day`, `absent`, or `leave` |
| `created_at` | text | |

`work_hours` is derived at read time from `check_out - check_in`. Attendance
counts start at the employee's `date_of_joining`, and today is not counted as an
absence before the day is over.

## `leave_requests`

| column | type | notes |
|---|---|---|
| `id` | text pk | |
| `employee_id` | text not null | → `employees(id)` on delete cascade |
| `leave_type` | text | `paid`, `sick`, or `unpaid` |
| `start_date` / `end_date` | text date | Inclusive; end ≥ start |
| `days` | real > 0 | Weekdays in the range, counted by the server |
| `remarks` | text | |
| `attachment_url` | text | Object path in the private `leave-documents` store; must be the requester's own upload, and is deleted when the request is cancelled |
| `status` | text default `pending` | `pending`, `approved`, or `rejected` |
| `reviewed_by` | text | → `employees(id)`; set exactly when the status is decided |
| `review_comment` | text | |
| `created_at` | text | |

A new request may not overlap the employee's own pending or approved requests,
and a request is never approved over days already covered by approved leave —
so a balance can never be charged twice for the same day.

## `notifications`

Written by the server when a leave request is decided: `employee_id`, `type`
(`leave_approved` / `leave_rejected`), `title`, `message`, `leave_request_id`
(unique — one notification per decision), nullable `read_at`, `created_at`.

## Derived presence

Never stored. For a given day: checked in → `present`; otherwise approved leave
covering the day → `leave`; otherwise `absent`. The directory, the dashboard and
the company attendance register all use `presenceSql()` in
`backend/src/queries.ts`, so they cannot disagree.

## Access rules (enforced in `backend/src/routes/`)

| resource | employee | admin / HR |
|---|---|---|
| company | read own | read and update own |
| employee full record | own only | anyone in the company |
| directory (safe columns + presence) | own company | own company |
| employee update | own safe fields: about, skills, mobile, address, avatar, date of birth, bank/IFSC/PAN/UAN, résumé | also names, job, department, location, manager (no loops), joining date, wage, role (not your own), balances — never id, company, sign-in email, or password flag |
| create / deactivate / reactivate employee | — | own company; never deactivate yourself |
| reset a password | — | anyone else in the company: issues a one-time temporary password and signs them out |
| attendance | own rows; check in/out today only | read company rows and the day register |
| leave requests | own; create; cancel own pending | read company; approve/reject once |
| notifications | own; mark read | own; mark read |
| avatars, company logos | public to read; upload own avatar | upload any avatar / logo |
| leave documents, résumés | own only | anyone in the company |

Every rule has a case in `backend/test/api.test.ts`.

## Files

Uploads are stored on disk at `backend/uploads/<bucket>/<company-id>/...`.
Avatars (JPG/PNG/WebP, 5 MB) and company logos (also SVG, 5 MB) are served
publicly at `/api/files/<bucket>/...`. Leave documents (PDF/JPG/PNG, 10 MB) and
résumés (PDF/DOC/DOCX, 5 MB) are served from the same path only after the
session check above. Upload bodies over 11 MB are refused before they are read.

## Seed data

`backend/src/seed.ts` creates the company **Neam Tull** with six people, this
month's weekday attendance (every seventh day a half day), four checked in today,
and pending, approved and rejected leave. Every account's password is
`DayflowDemo7!`.

## Deliberately out of scope

Departments, skills, certifications, leave types and allocations, salary
structures/components, payroll runs, payslip history, holidays, attendance
corrections, configurable payroll formulas, and email.
