# Dayflow MVP schema

Conventions: `snake_case`; UUID primary keys use `gen_random_uuid()`; all money
is `numeric(12,2)`; calendar days are `date`; timestamps are `timestamptz`.
Every application table has RLS enabled.

```text
auth.users → employees → attendance
                       → leave_requests
companies → employees
```

## `companies`

Created with the first admin during company sign-up.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `name` | text not null | e.g. `Odoo India` |
| `login_prefix` | text | e.g. `OI`; used only when generating a display login ID |
| `logo_url` | text | company-logo Storage URL |
| `created_at` | timestamptz default now() | |

## `employees`

One row per authenticated user. `employees.id = auth.users.id`; this makes own
row checks use `auth.uid()` directly. There are no department, skill, private
information, salary, leave-allocation, or login-counter tables.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | → `auth.users(id)` on delete cascade |
| `company_id` | uuid not null | → `companies(id)` |
| `login_id` | text unique | Optional generated HR-facing ID, e.g. `OIJODO20220001`; email is the MVP sign-in credential |
| `role` | text not null | `admin`, `hr`, or `employee` |
| `first_name` / `last_name` | text not null | |
| `work_email` | text not null | Auth email |
| `mobile` | text | |
| `job_position` | text | |
| `department` | text | Plain string |
| `location` | text | |
| `manager_id` | uuid | → `employees(id)`, nullable, on delete set null |
| `date_of_joining` | date | |
| `avatar_url` | text | avatar Storage URL |
| `about` | text | Resume tab |
| `skills` | text[] | Resume tab |
| `date_of_birth` | date | Private Info |
| `address` | text | Private Info |
| `bank_account_number` | text | Private Info |
| `ifsc_code` | text | Private Info |
| `pan_no` | text | Private Info |
| `uan_no` | text | Private Info |
| `monthly_wage` | numeric(12,2) | The one salary input |
| `paid_leave_balance` | numeric(5,2) default 24 | Mutated only when paid leave is approved |
| `sick_leave_balance` | numeric(5,2) default 7 | Mutated only when sick leave is approved |
| `is_active` | boolean default true | Soft deactivation |
| `created_at` | timestamptz default now() | |

`admin` and `hr` are privileged. The role is database data, never read from
user-editable `auth.users.raw_user_meta_data` for authorization.

### Salary calculation

`frontend/src/lib/salary.ts` calculates, without database tables:

- Basic: 50% of monthly wage
- HRA: 50% of Basic
- Standard Allowance: ₹4,167
- Performance Bonus and LTA: 8.33% of Basic each
- Fixed Allowance: the remaining wage
- PF: 12% of Basic; Professional Tax: ₹200

The components are display values. No payroll, salary-component, or payslip
records are stored in the MVP.

## `attendance`

One row per employee per work date.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `employee_id` | uuid not null | → `employees(id)` on delete cascade |
| `work_date` | date not null | Unique together with `employee_id` |
| `check_in` | timestamptz | Set by Check In |
| `check_out` | timestamptz | Null until Check Out |
| `status` | text not null default `'present'` | `present`, `half_day`, `absent`, or `leave` |
| `created_at` | timestamptz default now() | |

`work_hours` is derived at read time: `check_out - check_in`. A second check-in
for the same date fails through the unique constraint.

## `leave_requests`

The full Time Off feature. There are no leave-type, allocation, or balance
tables.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `employee_id` | uuid not null | → `employees(id)` on delete cascade |
| `leave_type` | text not null | `paid`, `sick`, or `unpaid` |
| `start_date` / `end_date` | date not null | Inclusive range |
| `days` | numeric(5,2) not null | Calculated by the request service |
| `remarks` | text | |
| `attachment_url` | text | leave-documents Storage URL; optional for MVP |
| `status` | text not null default `'pending'` | `pending`, `approved`, or `rejected` |
| `reviewed_by` | uuid | → `employees(id)` |
| `review_comment` | text | |
| `created_at` | timestamptz default now() | |

Approving a paid or sick request decrements the matching balance in the same
database operation. Unpaid leave changes no balance. Re-reviewing an already
approved request must not deduct a balance twice.

## `employee_directory` view

Normal employees must never query coworkers' full `employees` rows. This view
exposes only:

```text
id, first_name, last_name, avatar_url, job_position, department, location,
work_email, manager_id, about, skills, presence
```

It must never expose wages, private information, or leave balances. `presence`
is derived at query time, never stored on `employees`:

1. checked in today → `present`
2. otherwise, approved leave covering today → `leave`
3. otherwise → `absent`

Because employees can select only their own `employees` row, this view needs
owner privileges (`security_invoker = false`) and must enforce its own company
scope using the caller's employee row. Grant authenticated users `SELECT` only
on this narrow view, not broad coworker access to `employees`.

## RLS and controlled operations

Use small helper functions based on the caller's `employees` row:
`current_company_id()` and `is_privileged()`. Keep privileged functions out of
the browser; never expose a service-role key.

| resource | employee | admin / HR |
|---|---|---|
| `companies` | select own company | select and update own company |
| `employees` | select own full row; update own permitted profile/private fields | select, insert, update company employees |
| `employee_directory` | select company directory | select company directory |
| `attendance` | select own; check in/out own current-day row | select and update company attendance |
| `leave_requests` | select own; create own; cancel/update pending own request | select all company requests; approve or reject |

An employee update policy must not allow changing `role`, `company_id`,
`monthly_wage`, leave balances, `is_active`, or another employee's identity.
Use a trigger or a dedicated update function to enforce that column boundary.
Leave approval should be a protected transactional function that validates the
reviewer and request company, changes status, stamps `reviewed_by`, and adjusts
the appropriate balance exactly once.

## Auth and Storage

The first public company registration creates its admin, company, and employee
row. Employees are created by Admin/HR through a server-side invite operation;
employees do not self-register. Email and password are the required sign-in
path. A generated `login_id` is useful for display but is not an authentication
dependency in this MVP.

Storage buckets: `avatars`, `leave-documents`, and `company-logos`. Bucket
policies must scope uploads and updates to the caller's company/employee path.

## Seed data

Create one company, 10–12 employees (one admin, one HR, and 8–10 employees),
realistic profiles and salary values, attendance for the current week/month,
all three presence states today, and three pending leave requests. Use department
strings such as Engineering, Design, HR, Sales, and Support.

## Deliberately out of scope

Departments, skills, certifications, documents, leave types, leave allocations,
salary structures/components, payroll runs, payslip history, holidays, working
schedules, attendance corrections, and configurable payroll formulas.
