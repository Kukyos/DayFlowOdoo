# Dayflow: DBMS review notes

A study guide to the database side of Dayflow, written from the migrations in
`backend/supabase/migrations/`, `backend/supabase/seed.sql`, and the frontend
service layer. The example queries were written against this schema but have not
been run against a live database.

## 1. Big picture

- **DBMS:** PostgreSQL, hosted on Supabase. The commit "migrated to supabase"
  moved the project off SQLite. The old `backend/data/dayflow.db` is still in the
  repo but no longer used.
- **Schema as code:** the schema is built by 17 timestamped migration files in
  `backend/supabase/migrations/`, applied in order. Demo data is in
  `backend/supabase/seed.sql`.
- **Where the logic lives:** the React frontend calls the database directly. It
  uses table queries, stored functions (RPCs), and Row Level Security (RLS)
  policies. The permission rules are in the database, not in app code.

## 2. Tables

| Table | Purpose | Key columns |
|---|---|---|
| `companies` | A tenant (one company) | `id`, `name`, `logo_url`, `time_off_types text[]`, `working_days smallint[]`, `workday_start/end time` |
| `employees` | One row per person | `id`, `company_id`, `role`, `manager_id`, `monthly_wage numeric(12,2)`, `paid_leave_balance`, `sick_leave_balance`, `skills text[]`, `is_active`, `must_change_password`, plus profile and bank fields |
| `attendance` | One row per employee per day | `employee_id`, `work_date date`, `check_in`/`check_out timestamptz`, `status` |
| `leave_requests` | Time-off requests | `employee_id`, `leave_type`, `start_date`, `end_date`, `days`, `status`, `reviewed_by`, `review_comment` |
| `notifications` | In-app alerts on leave decisions | `employee_id`, `leave_request_id`, `type`, `read_at` |

Supabase also provides `auth.users` (credentials) and `storage.objects` /
`storage.buckets` (files). The `employees` table links to `auth.users`.

## 3. ER relationships

```text
auth.users ──1:1── employees ──N:1── companies
                     │  ▲
                     │  └─ manager_id (self-reference, nullable)
                     ├──1:N── attendance      UNIQUE(employee_id, work_date)
                     ├──1:N── leave_requests  (employee_id)
                     │          └─ reviewed_by → employees (second FK to the same table)
                     └──1:N── notifications ──0..1── leave_requests
```

| FK | ON DELETE | Reason |
|---|---|---|
| `employees.id → auth.users.id` | CASCADE | Both the PK and an FK, which makes it a 1:1 relationship |
| `employees.company_id → companies` | CASCADE | Deleting a company deletes its people |
| `employees.manager_id → employees` | SET NULL | A recursive relationship. Deleting a manager keeps the employees |
| `attendance` / `leave_requests` / `notifications.employee_id` | CASCADE | Child rows go with the employee |
| `leave_requests.reviewed_by → employees` | SET NULL | The request survives if the reviewer is deleted |
| `notifications.leave_request_id` | CASCADE | |

## 4. Constraints and indexes

- **PKs:** UUID surrogate keys with `gen_random_uuid()`.
- **UNIQUE:** `attendance_one_row_per_employee_day (employee_id, work_date)`.
  This is the natural composite candidate key. A double check-in raises error
  `23505`, which `check_in()` catches.
- **CHECK constraints:**
  - `role in ('admin','hr','employee')`
  - `btrim(first_name) <> ''` (no blank names)
  - leave balances `>= 0`
  - `monthly_wage >= 24998`
  - `end_date >= start_date`
  - `days > 0`
  - `check_out >= check_in`
  - `workday_start < workday_end`
  - `status in (...)`
- **State-machine CHECK:**
  `(status='pending' and reviewed_by is null) or (status in ('approved','rejected') and reviewed_by is not null)`.
  A request can't be decided without a reviewer.
- **NOT NULL / DEFAULT:** leave balances default to 24 paid and 7 sick days.
  `is_active` defaults to true.
- **Indexes:**
  - B-tree on FKs: `employees(company_id)`, `employees(manager_id)`,
    `leave_requests(reviewed_by)`.
  - Composite: `attendance(employee_id, work_date desc)`.
  - **Partial index:** `leave_requests(created_at desc) where status='pending'`,
    for the approval queue.
  - **Partial unique index:** `notifications(leave_request_id) where leave_request_id is not null`,
    so a request gets at most one notification.

## 5. Normalization

- **Derived values are not stored.** `presence` (present/leave/absent) and
  `work_hours` are computed at query time. That avoids update anomalies. The
  README says there is no `status` column to go stale.
- **Things that bend the rules, which you should be ready to explain:**
  - `skills text[]` and `working_days smallint[]` are arrays, which strictly
    breaks 1NF. Postgres supports arrays, and the project skips a join table.
  - `employees.department` is free text, not a `departments` table. This is a
    transitive redundancy, and renaming a department would need a mass update.
    `docs/SCHEMA.md` lists departments as deliberately out of scope.
  - `leave_requests.days` is derived from the two dates but stored on purpose.
    It snapshots the weekday count at request time, even if the working-days
    setting changes later.
  - Leave balances are stored on `employees` and updated inside a transaction,
    rather than computed from a ledger.

## 6. Transactions and ACID: `review_leave_request()`

This is the best function to demo. It runs as one transaction:

1. It checks the caller is Admin/HR.
2. `SELECT ... FOR UPDATE` locks the request row, so two reviewers can't approve
   it at once (**isolation**).
3. It checks `status = 'pending'`, so a request can't be decided twice.
4. For paid or sick leave it runs
   `UPDATE employees SET balance = balance - days WHERE balance >= days`. If no
   row updates, it raises an error.
5. It updates the request's status, which fires the `notify_leave_decision`
   trigger. That trigger inserts the notification.

If any step raises an exception, everything rolls back (**atomicity**). The
CHECK constraints and FKs keep the data valid (**consistency**). Postgres's
write-ahead log provides **durability**.

## 7. Triggers, functions, views

**Triggers**

| Trigger | When | Does |
|---|---|---|
| `on_auth_user_created_create_company` | AFTER INSERT on `auth.users` | Creates the company and admin employee row on sign-up |
| `on_auth_user_password_changed` | AFTER UPDATE of `encrypted_password` | Clears `must_change_password` |
| `enforce_employee_update_boundary` | BEFORE UPDATE on `employees` | Blocks employees from changing role, wage, balances, and so on. This is column-level security, which RLS can't do |
| `enforce_notification_update_boundary` | BEFORE UPDATE on `notifications` | Only `read_at` can change |
| `notify_leave_decision` | AFTER UPDATE of `status` on `leave_requests` | Inserts the notification |

**Functions (RPCs)**

- `check_in`, `check_out`
- `create_leave_request`, `review_leave_request`
- `deactivate_employee`
- `list_employee_directory`, `list_company_attendance`
- `get_dashboard_summary`, which returns `jsonb` built with `jsonb_build_object`,
  `jsonb_agg`, and `count(*) FILTER`
- Helpers in the `private` schema: `current_company_id()`, `is_privileged()`,
  `working_days_between()`

**View story:** an `employee_directory` view was created, then dropped and
replaced by the `list_employee_directory()` function. A `SECURITY DEFINER` view
bypasses RLS, and Supabase's advisor flagged it. A guarded function exposes the
same safe columns without that problem.

## 8. Security: RLS and grants

- **Row Level Security:** every table has `ENABLE ROW LEVEL SECURITY`. Policies
  are `USING` (which rows are visible) and `WITH CHECK` (which rows may be
  written).
- **Example policy:** an employee sees `employee_id = auth.uid()`, and Admin/HR
  see rows in their own company. Policies were consolidated into one per action
  so Postgres evaluates fewer of them.
- **Grants:** `REVOKE ALL` from `anon`/`authenticated`, then grant only what's
  needed. For example, the browser has `SELECT` and `DELETE` on `leave_requests`
  but no `INSERT`, so inserts must go through `create_leave_request()`.
- **`SECURITY DEFINER` + `set search_path = ''`:** the function runs with its
  owner's rights, and the empty search path prevents hijacking via look-alike
  objects.
- **`(select auth.uid())`:** wrapping it in a subselect lets Postgres evaluate it
  once per query instead of once per row.
- **Storage policies:** file paths start with `<company-id>/<employee-id>/...`,
  and policies check those path segments.
- `docs/RLS_TEST_MATRIX.md` is a ready-made demo script for who can do what.

## 9. Query cheat sheet for this schema

```sql
-- Filter + sort
select first_name, department, monthly_wage from employees
where is_active and monthly_wage > 55000 order by monthly_wage desc;

-- Self join: employee and manager
select e.first_name as employee, m.first_name as manager
from employees e left join employees m on m.id = e.manager_id;

-- Anti-join: who has NOT checked in today
select e.first_name from employees e
left join attendance a on a.employee_id = e.id and a.work_date = current_date
where a.id is null and e.is_active;

-- Aggregate + HAVING
select department, count(*) as headcount, round(avg(monthly_wage),2) as avg_wage
from employees where is_active group by department having count(*) > 1;

-- Derived work hours
select employee_id, work_date,
       round(extract(epoch from check_out - check_in)/3600, 2) as hours
from attendance where check_out is not null;

-- Join + GROUP BY: approved leave days per person and type
select e.first_name, l.leave_type, sum(l.days) as days_taken
from leave_requests l join employees e on e.id = l.employee_id
where l.status = 'approved' group by e.first_name, l.leave_type;

-- Correlated EXISTS: on approved leave today
select e.first_name from employees e
where exists (select 1 from leave_requests l
              where l.employee_id = e.id and l.status = 'approved'
                and current_date between l.start_date and l.end_date);

-- Array operators
select first_name from employees where skills @> array['React'];
select e.first_name, s from employees e, unnest(e.skills) as s;

-- Window function (not used in the project, but a common ask)
select first_name, monthly_wage,
       rank() over (partition by department order by monthly_wage desc) as dept_rank
from employees;

-- Manual transaction (same idea as review_leave_request)
begin;
  select * from leave_requests where id = '<id>' and status = 'pending' for update;
  update employees set paid_leave_balance = paid_leave_balance - 2
    where id = '<emp>' and paid_leave_balance >= 2;
  update leave_requests set status='approved', reviewed_by='<admin>' where id='<id>';
commit;   -- or rollback;

-- DDL
alter table employees add column nickname text;
create index emp_dept_idx on employees (department);
```

**RLS in demos:** the Supabase SQL editor runs as a superuser, which bypasses
RLS. To act as a user in a SQL session:

```sql
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<employee-uuid>"}', true);
select * from employees;   -- now only that user's visible rows
```

## 10. Weak spots a reviewer might probe

- **The migrations in the repo are behind the hosted database.** The generated
  types and services use `employees.resume_path`, `resume_name` and
  `resume_uploaded_at`, plus a `resumes` storage bucket, and `docs/SERVICES.md`
  says leave creation and approval refuse overlapping leave. None of that is in
  `backend/supabase/migrations/`, so those parts of this document describe only
  what the repo's migrations create. See `docs/BACKEND_REVIEW.md` section 12.
- **No overlap protection in the repo's migrations.** `create_leave_request()` and
  `review_leave_request()` as written there don't stop overlapping date ranges.
  Postgres could enforce it with
  `EXCLUDE USING gist (employee_id WITH =, daterange(start_date, end_date, '[]') WITH &&)`.
- **`employees.work_email` has no UNIQUE constraint.** Uniqueness is enforced
  only in `auth.users`.
- **`department` is plain text.** This is a deliberate denormalization.
- **Stale docs.** `docs/SCHEMA.md` says the seed has 12 employees, but `seed.sql`
  creates 4. The README's demo accounts (`odootestadmin@…`) are in the hosted
  database, not in the seed. Check the migrations when the docs and files
  disagree.
- **Leave type mismatch.** `companies.time_off_types` is configurable, but the
  CHECK on `leave_requests.leave_type` is hard-coded to paid, sick and unpaid.
