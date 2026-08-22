-- Dayflow local demo data. `supabase db reset` applies this after migrations.
-- These are intentionally predictable LOCAL credentials; never include this
-- seed in a linked `db push` or reuse the password for a hosted account.
--
-- Company: Neam Tull
-- Users: praneettigga@gmail.com, amohamed@karunya.edu.in,
--        poojashree@karunya.edu.in, athiraarun@karunya.edu.in
-- Password for every seeded user: DayflowDemo7!

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  seed.id,
  'authenticated',
  'authenticated',
  seed.email,
  extensions.crypt('DayflowDemo7!', extensions.gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
from (values
  ('20000000-0000-0000-0000-000000000001'::uuid, 'praneettigga@gmail.com'),
  ('20000000-0000-0000-0000-000000000002'::uuid, 'amohamed@karunya.edu.in'),
  ('20000000-0000-0000-0000-000000000003'::uuid, 'poojashree@karunya.edu.in'),
  ('20000000-0000-0000-0000-000000000004'::uuid, 'athiraarun@karunya.edu.in')
) as seed(id, email);

insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  user_row.id::text,
  user_row.id,
  jsonb_build_object(
    'sub', user_row.id::text,
    'email', user_row.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
from auth.users as user_row
where user_row.id::text like '20000000-0000-0000-0000-0000000000%';

insert into public.companies (id, name)
values ('10000000-0000-0000-0000-000000000001', 'Neam Tull');

insert into public.employees (
  id,
  company_id,
  role,
  first_name,
  last_name,
  work_email,
  mobile,
  job_position,
  department,
  location,
  manager_id,
  date_of_joining,
  about,
  skills,
  date_of_birth,
  address,
  monthly_wage,
  paid_leave_balance,
  sick_leave_balance,
  is_active,
  must_change_password
)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin', 'Praneet', 'Tigga', 'praneettigga@gmail.com', '+91 91908 76543', 'admin', 'management', 'Coimbatore', null, '2024-08-06', 'Oversees company operations, employee administration, and delivery planning.', array['Administration', 'Operations', 'Team Leadership'], '2003-04-18', 'Saravanampatti, Coimbatore, Tamil Nadu', 95000, 24, 7, true, false),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'employee', 'Armaan', 'Mohamed', 'amohamed@karunya.edu.in', '+91 94876 23105', 'Integrator', 'Engineer', 'Coimbatore', '20000000-0000-0000-0000-000000000001', '2024-11-01', 'Connects product services and keeps integrations reliable across the platform.', array['API Integration', 'Supabase', 'TypeScript'], '2003-09-12', 'Kuniyamuthur, Coimbatore, Tamil Nadu', 62000, 22, 7, true, false),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'employee', 'Poojashree', 'Ravichandar', 'poojashree@karunya.edu.in', '+91 93614 58270', 'Frontend Developer', 'Engineering', 'Coimbatore', '20000000-0000-0000-0000-000000000001', '2025-01-06', 'Builds accessible, responsive interfaces with an eye for clear user journeys.', array['React', 'UI Engineering', 'Accessibility'], '2004-02-24', 'Peelamedu, Coimbatore, Tamil Nadu', 58000, 24, 6, true, false),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'employee', 'Athira', 'Arun', 'athiraarun@karunya.edu.in', '+91 90872 41635', 'Quality Assurance Engineer', 'Engineering', 'Coimbatore', '20000000-0000-0000-0000-000000000001', '2025-02-03', 'Improves release confidence through thoughtful test coverage and defect analysis.', array['Quality Assurance', 'API Testing', 'Playwright'], '2003-11-08', 'Vadavalli, Coimbatore, Tamil Nadu', 56000, 23, 7, true, false);

-- Weekday history for a useful current-month attendance view.
insert into public.attendance (employee_id, work_date, check_in, check_out, status)
select
  employee.id,
  day.work_date::date,
  (day.work_date::date + time '09:30') at time zone 'Asia/Kolkata',
  (day.work_date::date + case when extract(day from day.work_date)::int % 7 = 0 then time '13:30' else time '18:00' end) at time zone 'Asia/Kolkata',
  case when extract(day from day.work_date)::int % 7 = 0 then 'half_day' else 'present' end
from public.employees as employee
cross join generate_series(
  date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)::date,
  (now() at time zone 'Asia/Kolkata')::date - 1,
  interval '1 day'
) as day(work_date)
where employee.id in (
  '20000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000004'
)
and extract(isodow from day.work_date) between 1 and 5;

-- Three checked-in people today; Athira remains available as an absent state.
insert into public.attendance (employee_id, work_date, check_in, status)
select employee_id, (now() at time zone 'Asia/Kolkata')::date, ((now() at time zone 'Asia/Kolkata')::date + check_time) at time zone 'Asia/Kolkata', 'present'
from (values
  ('20000000-0000-0000-0000-000000000001'::uuid, time '09:05'),
  ('20000000-0000-0000-0000-000000000002'::uuid, time '09:18'),
  ('20000000-0000-0000-0000-000000000003'::uuid, time '09:42')
) as present_today(employee_id, check_time);

insert into public.leave_requests (
  id, employee_id, leave_type, start_date, end_date, days, remarks, status, reviewed_by, review_comment, created_at
)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'paid', (now() at time zone 'Asia/Kolkata')::date + 2, (now() at time zone 'Asia/Kolkata')::date + 3, greatest(private.working_days_between((now() at time zone 'Asia/Kolkata')::date + 2, (now() at time zone 'Asia/Kolkata')::date + 3), 1), 'Travelling for a family function.', 'pending', null, null, now() - interval '5 hours'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 'paid', (now() at time zone 'Asia/Kolkata')::date - 10, (now() at time zone 'Asia/Kolkata')::date - 8, greatest(private.working_days_between((now() at time zone 'Asia/Kolkata')::date - 10, (now() at time zone 'Asia/Kolkata')::date - 8), 1), 'Short break after completing the frontend milestone.', 'approved', '20000000-0000-0000-0000-000000000001', 'Approved. Enjoy the break.', now() - interval '14 days'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004', 'sick', (now() at time zone 'Asia/Kolkata')::date - 5, (now() at time zone 'Asia/Kolkata')::date - 5, greatest(private.working_days_between((now() at time zone 'Asia/Kolkata')::date - 5, (now() at time zone 'Asia/Kolkata')::date - 5), 1), 'Resting after a fever.', 'rejected', '20000000-0000-0000-0000-000000000001', 'Please attach a medical certificate and resubmit.', now() - interval '7 days');

update public.employees
set paid_leave_balance = paid_leave_balance - greatest(private.working_days_between((now() at time zone 'Asia/Kolkata')::date - 10, (now() at time zone 'Asia/Kolkata')::date - 8), 1)
where id = '20000000-0000-0000-0000-000000000003';
