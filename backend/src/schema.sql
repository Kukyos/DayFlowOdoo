-- Dayflow SQLite schema.
--
-- Conventions: ids are UUID strings; calendar days are `YYYY-MM-DD` text;
-- timestamps are ISO-8601 UTC text; booleans are 0/1; arrays are JSON text.
-- Access rules live in the API (src/routes/), not in the database.

create table if not exists users (
  id text primary key,
  email text not null unique collate nocase,
  password_hash text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists sessions (
  token text primary key,
  user_id text not null references users (id) on delete cascade,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists sessions_user_id_idx on sessions (user_id);

create table if not exists companies (
  id text primary key,
  name text not null check (trim(name) <> ''),
  logo_url text,
  time_off_types text not null default '["paid","sick","unpaid"]',
  working_days text not null default '[1,2,3,4,5]',
  workday_start text not null default '09:00:00',
  workday_end text not null default '17:00:00',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check (workday_start < workday_end)
);

create table if not exists employees (
  id text primary key references users (id) on delete cascade,
  company_id text not null references companies (id) on delete cascade,
  role text not null check (role in ('admin', 'hr', 'employee')),
  first_name text not null check (trim(first_name) <> ''),
  last_name text not null check (trim(last_name) <> ''),
  work_email text not null check (trim(work_email) <> ''),
  mobile text,
  job_position text,
  department text,
  location text,
  manager_id text references employees (id) on delete set null,
  date_of_joining text,
  avatar_url text,
  about text,
  skills text,
  date_of_birth text,
  address text,
  bank_account_number text,
  ifsc_code text,
  pan_no text,
  uan_no text,
  -- 24,998 is the lowest wage whose fixed allowance (lib/salary.ts) is not negative.
  monthly_wage real check (monthly_wage is null or monthly_wage >= 24998),
  paid_leave_balance real not null default 24 check (paid_leave_balance >= 0),
  sick_leave_balance real not null default 7 check (sick_leave_balance >= 0),
  resume_path text,
  resume_name text,
  resume_uploaded_at text,
  is_active integer not null default 1,
  must_change_password integer not null default 0,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists employees_company_id_idx on employees (company_id);

create table if not exists attendance (
  id text primary key,
  employee_id text not null references employees (id) on delete cascade,
  work_date text not null,
  check_in text,
  check_out text,
  status text not null default 'present'
    check (status in ('present', 'half_day', 'absent', 'leave')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (employee_id, work_date),
  check (check_out is null or (check_in is not null and check_out >= check_in))
);

create table if not exists leave_requests (
  id text primary key,
  employee_id text not null references employees (id) on delete cascade,
  leave_type text not null check (leave_type in ('paid', 'sick', 'unpaid')),
  start_date text not null,
  end_date text not null,
  days real not null check (days > 0),
  remarks text,
  attachment_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by text references employees (id) on delete set null,
  review_comment text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check (end_date >= start_date),
  check (
    (status = 'pending' and reviewed_by is null)
    or (status in ('approved', 'rejected') and reviewed_by is not null)
  )
);

create index if not exists leave_requests_employee_created_idx
on leave_requests (employee_id, created_at desc);

create table if not exists notifications (
  id text primary key,
  employee_id text not null references employees (id) on delete cascade,
  type text not null check (type in ('leave_approved', 'leave_rejected')),
  title text not null check (trim(title) <> ''),
  message text not null check (trim(message) <> ''),
  leave_request_id text unique references leave_requests (id) on delete cascade,
  read_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists notifications_employee_created_idx
on notifications (employee_id, created_at desc);
