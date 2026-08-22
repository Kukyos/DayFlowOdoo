-- Dayflow local demo data. `supabase db reset` applies this after migrations.
-- These are intentionally predictable LOCAL credentials; never include this
-- seed in a linked `db push` or reuse the password for a hosted account.
--
-- Admin:    admin@dayflow.local
-- Employee: employee@dayflow.local
-- Password for both: DayflowDemo7!

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
  ('20000000-0000-0000-0000-000000000001'::uuid, 'admin@dayflow.local'),
  ('20000000-0000-0000-0000-000000000002'::uuid, 'hr@dayflow.local'),
  ('20000000-0000-0000-0000-000000000003'::uuid, 'employee@dayflow.local'),
  ('20000000-0000-0000-0000-000000000004'::uuid, 'arjun.rao@dayflow.local'),
  ('20000000-0000-0000-0000-000000000005'::uuid, 'neha.sharma@dayflow.local'),
  ('20000000-0000-0000-0000-000000000006'::uuid, 'vikram.singh@dayflow.local'),
  ('20000000-0000-0000-0000-000000000007'::uuid, 'mira.patel@dayflow.local'),
  ('20000000-0000-0000-0000-000000000008'::uuid, 'aditya.bose@dayflow.local'),
  ('20000000-0000-0000-0000-000000000009'::uuid, 'tara.kapoor@dayflow.local'),
  ('20000000-0000-0000-0000-000000000010'::uuid, 'rahul.verma@dayflow.local'),
  ('20000000-0000-0000-0000-000000000011'::uuid, 'isha.menon@dayflow.local'),
  ('20000000-0000-0000-0000-000000000012'::uuid, 'dev.khanna@dayflow.local')
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
values ('10000000-0000-0000-0000-000000000001', 'Odoo India');

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
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin', 'Ananya', 'Iyer', 'admin@dayflow.local', '+91 98765 10001', 'Managing Director', 'Leadership', 'Bengaluru', null, '2021-04-12', 'Building thoughtful systems for growing teams.', array['Strategy', 'Operations'], '1988-06-17', 'Indiranagar, Bengaluru', 180000, 24, 7, true, false),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'hr', 'Rohan', 'Mehta', 'hr@dayflow.local', '+91 98765 10002', 'People Operations Lead', 'HR', 'Bengaluru', '20000000-0000-0000-0000-000000000001', '2022-01-10', 'Making work clearer, fairer, and easier to navigate.', array['People Ops', 'Hiring', 'Policy'], '1991-09-08', 'Koramangala, Bengaluru', 95000, 22, 7, true, false),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'employee', 'Kavya', 'Nair', 'employee@dayflow.local', '+91 98765 10003', 'Product Designer', 'Design', 'Bengaluru', '20000000-0000-0000-0000-000000000002', '2023-02-06', 'Product designer focused on calm, legible workflows.', array['Figma', 'Research', 'Prototyping'], '1996-02-21', 'HSR Layout, Bengaluru', 72000, 20, 6, true, false),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'employee', 'Arjun', 'Rao', 'arjun.rao@dayflow.local', '+91 98765 10004', 'Senior Engineer', 'Engineering', 'Hyderabad', '20000000-0000-0000-0000-000000000001', '2022-07-18', 'Backend engineer who enjoys reliable systems and small APIs.', array['Postgres', 'TypeScript', 'Distributed Systems'], '1993-11-03', 'Madhapur, Hyderabad', 120000, 24, 7, true, false),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'employee', 'Neha', 'Sharma', 'neha.sharma@dayflow.local', '+91 98765 10005', 'Account Executive', 'Sales', 'Mumbai', '20000000-0000-0000-0000-000000000002', '2024-01-15', 'Helping teams choose practical tools that fit how they work.', array['Sales', 'CRM', 'Negotiation'], '1997-05-14', 'Powai, Mumbai', 68000, 24, 7, true, false),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'employee', 'Vikram', 'Singh', 'vikram.singh@dayflow.local', '+91 98765 10006', 'Support Specialist', 'Support', 'Delhi', '20000000-0000-0000-0000-000000000002', '2023-08-21', 'Turning difficult customer moments into clear next steps.', array['Support', 'Documentation', 'Training'], '1995-01-29', 'Saket, Delhi', 56000, 23, 5, true, false),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'employee', 'Mira', 'Patel', 'mira.patel@dayflow.local', '+91 98765 10007', 'Frontend Engineer', 'Engineering', 'Ahmedabad', '20000000-0000-0000-0000-000000000004', '2024-03-11', 'Building accessible interfaces with precise interactions.', array['React', 'Accessibility', 'CSS'], '1998-07-19', 'Navrangpura, Ahmedabad', 82000, 24, 7, true, false),
  ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'employee', 'Aditya', 'Bose', 'aditya.bose@dayflow.local', '+91 98765 10008', 'Finance Analyst', 'Finance', 'Kolkata', '20000000-0000-0000-0000-000000000001', '2022-11-07', 'Keeping forecasts grounded and reporting understandable.', array['Forecasting', 'Excel', 'Analysis'], '1992-04-30', 'Salt Lake, Kolkata', 78000, 24, 7, true, false),
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', 'employee', 'Tara', 'Kapoor', 'tara.kapoor@dayflow.local', '+91 98765 10009', 'Visual Designer', 'Design', 'Bengaluru', '20000000-0000-0000-0000-000000000003', '2025-01-20', 'Exploring expressive visual systems without losing clarity.', array['Brand', 'Illustration', 'Motion'], '1999-10-12', 'Jayanagar, Bengaluru', 62000, 24, 7, true, false),
  ('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'employee', 'Rahul', 'Verma', 'rahul.verma@dayflow.local', '+91 98765 10010', 'Sales Development Representative', 'Sales', 'Pune', '20000000-0000-0000-0000-000000000005', '2023-10-09', 'Curious about customer problems and crisp follow-through.', array['Prospecting', 'Research', 'CRM'], '1997-12-01', 'Viman Nagar, Pune', 52000, 24, 7, true, false),
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'employee', 'Isha', 'Menon', 'isha.menon@dayflow.local', '+91 98765 10011', 'Customer Success Manager', 'Support', 'Chennai', '20000000-0000-0000-0000-000000000002', '2024-05-13', 'Helping customers build habits that last beyond onboarding.', array['Onboarding', 'Success Plans', 'Training'], '1994-08-25', 'Adyar, Chennai', 74000, 24, 7, true, false),
  ('20000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'employee', 'Dev', 'Khanna', 'dev.khanna@dayflow.local', '+91 98765 10012', 'Quality Engineer', 'Engineering', 'Bengaluru', '20000000-0000-0000-0000-000000000004', '2025-06-02', 'Testing the boundaries where assumptions usually hide.', array['Playwright', 'API Testing', 'Quality'], '1998-03-16', 'Whitefield, Bengaluru', 66000, 24, 7, true, false);

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
  '20000000-0000-0000-0000-000000000004',
  '20000000-0000-0000-0000-000000000005',
  '20000000-0000-0000-0000-000000000007',
  '20000000-0000-0000-0000-000000000008',
  '20000000-0000-0000-0000-000000000012'
)
and extract(isodow from day.work_date) between 1 and 5;

-- Five checked-in people today, one approved leave covering today, and the
-- remaining employees absent gives every presence state on the directory.
insert into public.attendance (employee_id, work_date, check_in, status)
select employee_id, (now() at time zone 'Asia/Kolkata')::date, ((now() at time zone 'Asia/Kolkata')::date + check_time) at time zone 'Asia/Kolkata', 'present'
from (values
  ('20000000-0000-0000-0000-000000000001'::uuid, time '09:05'),
  ('20000000-0000-0000-0000-000000000002'::uuid, time '09:18'),
  ('20000000-0000-0000-0000-000000000003'::uuid, time '09:42'),
  ('20000000-0000-0000-0000-000000000004'::uuid, time '09:27'),
  ('20000000-0000-0000-0000-000000000007'::uuid, time '10:02')
) as present_today(employee_id, check_time);

insert into public.leave_requests (
  id, employee_id, leave_type, start_date, end_date, days, remarks, status, reviewed_by, review_comment, created_at
)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000011', 'sick', (now() at time zone 'Asia/Kolkata')::date - 1, (now() at time zone 'Asia/Kolkata')::date + 1, private.working_days_between((now() at time zone 'Asia/Kolkata')::date - 1, (now() at time zone 'Asia/Kolkata')::date + 1), 'Recovering at home after a fever.', 'approved', '20000000-0000-0000-0000-000000000002', 'Take care and keep us posted.', now() - interval '2 days'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 'paid', (now() at time zone 'Asia/Kolkata')::date + 2, (now() at time zone 'Asia/Kolkata')::date + 3, greatest(private.working_days_between((now() at time zone 'Asia/Kolkata')::date + 2, (now() at time zone 'Asia/Kolkata')::date + 3), 1), 'Family event out of town.', 'pending', null, null, now() - interval '5 hours'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000005', 'unpaid', (now() at time zone 'Asia/Kolkata')::date + 9, (now() at time zone 'Asia/Kolkata')::date + 9, greatest(private.working_days_between((now() at time zone 'Asia/Kolkata')::date + 9, (now() at time zone 'Asia/Kolkata')::date + 9), 1), 'Personal appointment.', 'pending', null, null, now() - interval '3 hours'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000006', 'paid', (now() at time zone 'Asia/Kolkata')::date + 10, (now() at time zone 'Asia/Kolkata')::date + 12, greatest(private.working_days_between((now() at time zone 'Asia/Kolkata')::date + 10, (now() at time zone 'Asia/Kolkata')::date + 12), 1), 'Travelling for a family celebration.', 'pending', null, null, now() - interval '1 hour'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000009', 'paid', (now() at time zone 'Asia/Kolkata')::date - 10, (now() at time zone 'Asia/Kolkata')::date - 8, greatest(private.working_days_between((now() at time zone 'Asia/Kolkata')::date - 10, (now() at time zone 'Asia/Kolkata')::date - 8), 1), 'Short break after the design launch.', 'approved', '20000000-0000-0000-0000-000000000002', 'Approved. Enjoy the break.', now() - interval '14 days'),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000010', 'sick', (now() at time zone 'Asia/Kolkata')::date - 5, (now() at time zone 'Asia/Kolkata')::date - 5, greatest(private.working_days_between((now() at time zone 'Asia/Kolkata')::date - 5, (now() at time zone 'Asia/Kolkata')::date - 5), 1), 'Not feeling well.', 'rejected', '20000000-0000-0000-0000-000000000002', 'Please attach a medical certificate and resubmit.', now() - interval '7 days');

update public.employees
set sick_leave_balance = sick_leave_balance - private.working_days_between((now() at time zone 'Asia/Kolkata')::date - 1, (now() at time zone 'Asia/Kolkata')::date + 1)
where id = '20000000-0000-0000-0000-000000000011';

update public.employees
set paid_leave_balance = paid_leave_balance - greatest(private.working_days_between((now() at time zone 'Asia/Kolkata')::date - 10, (now() at time zone 'Asia/Kolkata')::date - 8), 1)
where id = '20000000-0000-0000-0000-000000000009';
