# Schema

**Owner: Praneet.** This file and `SERVICES.md` are the data contract. If a
column is not written here, it does not exist — stop and ask rather than invent
one. Other lanes read this file; they do not edit it.

The schema is a living contract. It grows with the active feature. Migrations,
this file, `SERVICES.md`, and `frontend/src/types/database.ts` move together in
one commit — never one without the others.

Conventions: `snake_case`, `uuid` primary keys via `gen_random_uuid()`, every
table carries `created_at timestamptz default now()`, money is `numeric(12,2)`
(never float), a date that means a calendar day is `date` (never `timestamptz`).

---

## Two things that are deliberately *not* columns

**1. Presence status is derived, never stored.** The directory card's indicator
is computed at read time from attendance and approved leave:

| indicator | meaning | rule |
|---|---|---|
| 🟢 green | present | an `attendance` row for today with `check_in` set |
| ✈️ plane | on leave | an approved `time_off_requests` row covering today |
| 🟡 yellow | absent | neither of the above |

Exposed as the `employee_presence` view. **Do not add a `status` column to
`employees`.** A stored status goes stale the moment someone checks in, and with
four sessions in one repo it will be added four times.

**2. Salary component amounts are not stored on the employee.** `salary_components`
stores the *rules* (type + value); the amounts are computed by
`frontend/src/lib/salary.ts` at render time. Amounts are only ever persisted as
a snapshot inside a generated payslip. One computation, one place.

---

## `companies`

Created by public Sign Up, together with its first admin. Everything else is
scoped to a company.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `name` | text not null | "Odoo India" |
| `login_prefix` | text not null | 2 letters, uppercase. `OI` for Odoo India. Drives the login ID |
| `logo_url` | text | Supabase Storage public URL |
| `created_at` | timestamptz | |

---

## `employees`

The profile. One row per person; `id` **is** the `auth.users` id, so RLS can
compare against `auth.uid()` with no join.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | references `auth.users(id)` on delete cascade |
| `company_id` | uuid not null | → `companies` |
| `login_id` | text unique not null | `OIJODO20220001` — see below |
| `emp_code` | text | short internal code, shown on Private Info |
| `role` | text not null | `admin` / `hr` / `employee`. `admin` and `hr` are both privileged; see `AUTH.md` |
| `first_name` | text not null | |
| `last_name` | text not null | |
| `work_email` | text not null | the login email |
| `mobile` | text | |
| `job_position` | text | "Senior Frontend Engineer" |
| `department` | text | |
| `location` | text | |
| `manager_id` | uuid | self-reference, nullable, on delete set null |
| `date_of_joining` | date not null | drives the login ID year |
| `avatar_url` | text | |
| `about` | text | Resume tab — "About" |
| `job_love` | text | Resume tab — "What I love about my job" |
| `interests` | text | Resume tab — "My interests and hobbies" |
| `working_days_per_week` | int default 5 | wireframe: "No of working days in a week" |
| `break_hours` | numeric(4,2) default 1 | wireframe: "Break Time /hrs" |
| `expected_hours_per_day` | numeric(4,2) default 8 | anything beyond this is extra hours |
| `must_change_password` | boolean default true | forces the first-login password change |
| `is_active` | boolean default true | soft delete; never hard-delete a person who has attendance |
| `created_at` / `updated_at` | timestamptz | |

Fields an employee may edit on themselves: `mobile`, `avatar_url`, `about`,
`job_love`, `interests`, and everything in `employee_private`. Admin/HR may edit
all of it. Enforced by RLS, not by hiding the input.

### Login ID

Format: prefix + first two letters of the first name + first two of the last
name + four-digit joining year + four-digit zero-padded serial for that company
and year.

`John Doe`, Odoo India, joined 2022, first hire of that year → `OIJODO20220001`.

Uppercase; non-alphabetic characters stripped from the name parts; padded with
`X` if a name is a single letter. The serial is **not** a count of existing
rows — concurrent inserts would collide. Use the counter table below with an
atomic `update ... returning`, inside a `generate_login_id()` function.

## `login_id_counters`

| column | type | notes |
|---|---|---|
| `company_id` | uuid | composite pk with `year` |
| `year` | int | |
| `last_serial` | int not null default 0 | |

---

## `employee_private`

Private Info tab. **A separate table so RLS can lock it to self + admin/HR.**
Postgres RLS is row-level, not column-level, so these cannot be columns on
`employees` without leaking bank details to the directory.

| column | type | notes |
|---|---|---|
| `employee_id` | uuid pk | → `employees` on delete cascade |
| `date_of_birth` | date | |
| `residing_address` | text | |
| `personal_email` | text | |
| `gender` | text | |
| `nationality` | text | |
| `marital_status` | text | |
| `bank_account_number` | text | |
| `bank_name` | text | |
| `ifsc_code` | text | |
| `pan_no` | text | |
| `uan_no` | text | |

---

## `resume_items`

Resume tab. Skills and certifications are the same shape, so one table with a
`kind` discriminator rather than two near-identical ones.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `employee_id` | uuid not null | → `employees` on delete cascade |
| `kind` | text not null | `skill` / `certification` |
| `name` | text not null | "React", "AWS Solutions Architect" |
| `detail` | text | issuer, or proficiency level |
| `issued_on` | date | certifications only |
| `sequence` | int default 0 | display order |

---

## `salary_structures`

One current row per employee. **Admin/HR only** — an employee selecting their own
row must be denied. Their read-only salary view comes from their payslip.

| column | type | notes |
|---|---|---|
| `employee_id` | uuid pk | → `employees` on delete cascade |
| `wage` | numeric(12,2) not null | monthly wage. **The single input.** Everything else derives from it |
| `wage_type` | text default 'fixed' | the wireframe offers "Fixed wage" only; keep the column, keep the UI a select |
| `pf_employee_pct` | numeric(5,2) default 12 | on Basic |
| `pf_employer_pct` | numeric(5,2) default 12 | on Basic |
| `professional_tax` | numeric(12,2) default 200 | flat rupees per month |
| `effective_from` | date default current_date | |
| `updated_at` | timestamptz | |

## `salary_components`

The rules. Seeded with the six defaults below when an employee is created.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `employee_id` | uuid not null | → `employees` on delete cascade |
| `name` | text not null | |
| `computation_type` | text not null | `pct_of_wage` / `pct_of_basic` / `fixed` / `residual` |
| `value` | numeric(12,4) | a percentage or a rupee amount. Null for `residual` |
| `sequence` | int not null | evaluation order; `residual` must sort last |

### Defaults, on a ₹50,000 wage

| # | component | type | value | amount |
|---|---|---|---|---|
| 1 | Basic Salary | `pct_of_wage` | 50 | ₹25,000.00 |
| 2 | House Rent Allowance | `pct_of_basic` | 50 | ₹12,500.00 |
| 3 | Standard Allowance | `fixed` | 4167 | ₹4,167.00 |
| 4 | Performance Bonus | `pct_of_basic` | 8.33 | ₹2,082.50 |
| 5 | Leave Travel Allowance | `pct_of_basic` | 8.33 | ₹2,082.50 |
| 6 | Fixed Allowance | `residual` | — | ₹4,168.00 |
| | **Gross** | | | **₹50,000.00** |

Deductions on that structure: PF employee 12% of Basic = ₹3,000.00; Professional
Tax = ₹200.00. Employer PF 12% of Basic = ₹3,000.00 is a company cost, not a
deduction — display it, never subtract it. **Net = ₹46,800.00.**

### The rules, authoritative

1. Evaluate in `sequence`. `pct_of_basic` needs Basic, so Basic sorts first.
2. `residual` = wage − sum(every other component). Exactly one component may be
   `residual`, and it sorts last.
3. Every component recomputes the moment `wage` changes. The Salary Info tab
   does this live, with no save round-trip.
4. Gross must equal wage. Rule 2 guarantees it; assert it anyway.
5. Round each component to 2 decimals and give the residual the rounding
   remainder, so the total is exact to the paisa.
6. Every percentage is a configurable field, including PF and Professional Tax.
   Nothing is hard-coded inside a component.

> **Wireframe discrepancy, resolved — do not re-derive this.** The wireframe
> renders Fixed Allowance as 11.67% of Basic (₹2,918), which makes the six
> components total ₹48,750 against a ₹50,000 wage. Its own written note says
> *"Fixed allowance is = wage - total of all the component"*. The written rule
> wins: the residual is ₹4,168, which happens to be 16.67% of Basic. This also
> satisfies the wireframe's constraint that the total must not exceed the wage.

Implemented once, in `frontend/src/lib/salary.ts`, as a pure function over
`(wage, components, taxes)`. No Supabase import, no second copy in SQL. Both the
Salary Info tab and payslip generation call it. It is the one piece of logic in
this build that earns a unit test.

---

## `attendance`

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `employee_id` | uuid not null | → `employees` |
| `work_date` | date not null | **unique together with `employee_id`** |
| `check_in` | timestamptz | |
| `check_out` | timestamptz | null while still checked in |
| `status` | text not null default 'present' | `present` / `absent` / `half_day` / `leave` |
| `break_minutes` | int default 60 | taken from the employee's `break_hours` at check-in |
| `note` | text | |

`work_hours` and `extra_hours` are **derived**, not columns:
`work_hours = (check_out − check_in) − break_minutes` and
`extra_hours = max(0, work_hours − expected_hours_per_day)`. Both are null while
`check_out` is null.

Check-in is idempotent per day: a second check-in on a day that already has a row
is an error, not a second row. The unique constraint is the enforcement.

---

## Time off

Three tables, because an allocation ("you have 24 paid days") and a request ("I
want the 13th to the 14th") are different objects with different lifetimes.
Balance is one minus the other, never a stored counter that can drift.

## `time_off_types`

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `company_id` | uuid not null | |
| `name` | text not null | Paid Time Off · Sick Leave · Unpaid Leave |
| `is_paid` | boolean not null | **false for Unpaid Leave — this is what reduces payable days** |
| `requires_attachment` | boolean default false | true for Sick Leave (certificate) |
| `color` | text | a token name from `DESIGN.md`, not a hex |

## `time_off_allocations`

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `employee_id` | uuid not null | |
| `type_id` | uuid not null | |
| `days` | numeric(5,2) not null | |
| `valid_from` / `valid_to` | date | the wireframe's "Validity Period" |
| `allocated_by` | uuid | → `employees` |

## `time_off_requests`

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `employee_id` | uuid not null | |
| `type_id` | uuid not null | |
| `start_date` / `end_date` | date not null | |
| `days` | numeric(5,2) not null | working days in the range, computed on submit |
| `description` | text | the wireframe's "Add remarks" |
| `attachment_url` | text | Supabase Storage; required when the type says `requires_attachment` |
| `status` | text not null default 'pending' | `pending` / `approved` / `rejected` |
| `reviewed_by` | uuid | → `employees` |
| `reviewed_at` | timestamptz | |
| `review_comment` | text | |

### `time_off_balances` (view)

`employee_id, type_id, allocated, taken, available`, where `allocated` sums
allocations valid today and `taken` sums **approved** requests. This is what
feeds the "24 Days Available" cards. Pending requests do not reduce the balance;
surface them separately if the card has room.

---

## `payslips`

Tier 2, but specified now because it is the integration that makes this more than
four CRUD screens. Attendance and leave decide the payable days; the salary
structure decides the money.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `employee_id` | uuid not null | |
| `period` | date not null | first of the month. **unique together with `employee_id`** |
| `total_working_days` | int not null | from `working_days_per_week` across the month |
| `payable_days` | numeric(5,2) not null | see below |
| `gross` | numeric(12,2) not null | |
| `deductions` | numeric(12,2) not null | |
| `net` | numeric(12,2) not null | |
| `breakdown` | jsonb not null | **snapshot** of every component and deduction at generation time |
| `generated_at` | timestamptz | |
| `generated_by` | uuid | → `employees` |

`payable_days = total_working_days − unpaid_leave_days − missing_attendance_days`,
where a missing day is a working day with no attendance row and no approved
leave. A half-day counts 0.5. `breakdown` is a snapshot because a payslip must
not change when someone later edits the salary structure.

---

## RLS

**Every table has RLS enabled. No exceptions, no "we will add it later".**

Two helper functions, both `security definer`, used by every policy below:

- `current_company_id()` → the caller's `employees.company_id`
- `is_privileged()` → true when the caller's `role` is `admin` or `hr`

| table | employee | admin / HR |
|---|---|---|
| `companies` | select own company | select own; update own |
| `employees` | select all in company (the directory); update **own row, limited columns** | select / insert / update all in company |
| `employee_private` | select + update own | select + update all in company |
| `resume_items` | full CRUD on own | full CRUD in company |
| `salary_structures` | **no select** | full CRUD in company |
| `salary_components` | **no select** | full CRUD in company |
| `attendance` | select own; insert own for today; update own open row | select / insert / update all in company |
| `time_off_types` | select | full CRUD |
| `time_off_allocations` | select own | full CRUD in company |
| `time_off_requests` | select own; insert own; update own **while pending** | select all; update status on all in company |
| `payslips` | select own | full CRUD in company |

Three specifics that are easy to get wrong and are the entire point of the table:

- **The Salary Info tab is admin-only.** The wireframe says so explicitly. An
  employee selecting their own `salary_structures` row must be denied.
- **An employee must not edit an approved request** back to pending, and must not
  set `status` at all. Restrict the update policy to `status = 'pending'` and keep
  `status` out of the employee-facing service.
- **An employee must not change their own `role`.** A permissive update policy on
  `employees` is a privilege-escalation path straight to the salary table.

> RLS is the one place AI output looks correct and silently is not. Policies come
> out either too permissive or locking you out. **Test each one manually against
> both the seeded employee account and the seeded admin account before moving
> on.** A select that returns rows it should not is invisible in the UI.

---

## Seed data — Tier 1

The directory grid is the hero screenshot and the first thing a judge sees. It
needs to look like a real company.

- One company: **Odoo India**, prefix `OI`, with a logo.
- **12–15 employees** across engineering, design, HR, sales and support: real
  names, joining years spread over 2019–2025 so login IDs differ, wages from
  ₹35,000 to ₹120,000, avatars, and `manager_id` values that form an actual
  reporting tree.
- Two seeded accounts the team logs in with all day, both with
  `must_change_password = false`: one **admin/HR**, one **employee**. Credentials
  live in `docs/AUTH.md`. Never build a mock user object — a fake user passes the
  route guard and then every query goes out without a JWT.
- Attendance for the **current month to date**, so the day-wise view is not empty:
  mostly present with realistic 09:00–19:00 times, a few half-days, a few
  absences, a few days on approved leave.
- Presence spread across all three indicators **today**, or the directory's best
  feature is invisible in the screenshot.
- Time off: 24 paid / 7 sick allocated per person, several approved requests in
  the past, and **3–4 pending requests** so the admin approval queue is not empty.
- Salary structures on everyone, with the six default components.

Never "Employee 1". Never lorem ipsum.
