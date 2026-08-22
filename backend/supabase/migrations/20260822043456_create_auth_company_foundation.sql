-- Dayflow authentication foundation.
-- Supabase Auth owns credentials and sessions in auth.users. These application
-- tables store the company and employee data associated with an Auth user.

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  login_prefix text,
  logo_url text,
  created_at timestamptz not null default now(),
  constraint companies_name_not_blank check (btrim(name) <> '')
);

create table public.employees (
  id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  login_id text unique,
  role text not null,
  first_name text not null,
  last_name text not null,
  work_email text not null,
  mobile text,
  job_position text,
  department text,
  location text,
  manager_id uuid references public.employees (id) on delete set null,
  date_of_joining date,
  avatar_url text,
  about text,
  skills text[],
  date_of_birth date,
  address text,
  bank_account_number text,
  ifsc_code text,
  pan_no text,
  uan_no text,
  monthly_wage numeric(12, 2),
  paid_leave_balance numeric(5, 2) not null default 24,
  sick_leave_balance numeric(5, 2) not null default 7,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint employees_role_valid check (role in ('admin', 'hr', 'employee')),
  constraint employees_first_name_not_blank check (btrim(first_name) <> ''),
  constraint employees_last_name_not_blank check (btrim(last_name) <> ''),
  constraint employees_work_email_not_blank check (btrim(work_email) <> ''),
  constraint employees_monthly_wage_nonnegative check (
    monthly_wage is null or monthly_wage >= 0
  ),
  constraint employees_paid_leave_balance_nonnegative check (paid_leave_balance >= 0),
  constraint employees_sick_leave_balance_nonnegative check (sick_leave_balance >= 0)
);

create index employees_company_id_idx on public.employees (company_id);
create index employees_manager_id_idx on public.employees (manager_id);

alter table public.companies enable row level security;
alter table public.employees enable row level security;

-- Opt in to Data API reads explicitly. RLS below still controls which rows an
-- authenticated request can see. The browser cannot write either table yet.
revoke all on table public.companies from anon, authenticated;
revoke all on table public.employees from anon, authenticated;
grant select on table public.companies to authenticated;
grant select on table public.employees to authenticated;
grant all on table public.companies to service_role;
grant all on table public.employees to service_role;

create policy "employees can read their active record"
on public.employees
for select
to authenticated
using (
  (select auth.uid()) = id
  and is_active
);

create policy "employees can read their company"
on public.companies
for select
to authenticated
using (
  exists (
    select 1
    from public.employees as employee
    where employee.id = (select auth.uid())
      and employee.company_id = companies.id
      and employee.is_active
  )
);

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.handle_new_company_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  company_name text := nullif(btrim(new.raw_user_meta_data ->> 'company_name'), '');
  first_name text := nullif(btrim(new.raw_user_meta_data ->> 'first_name'), '');
  last_name text := nullif(btrim(new.raw_user_meta_data ->> 'last_name'), '');
  mobile text := nullif(btrim(new.raw_user_meta_data ->> 'mobile'), '');
  company_id uuid := gen_random_uuid();
begin
  -- Other Auth creation flows, including the future server-side employee invite,
  -- create their application row in their own trusted transaction.
  if new.raw_user_meta_data ->> 'registration_type' is distinct from 'company' then
    return new;
  end if;

  if company_name is null then
    raise exception using
      errcode = '22023',
      message = 'Company name is required for company registration.';
  end if;

  if first_name is null or last_name is null then
    raise exception using
      errcode = '22023',
      message = 'Admin first name and last name are required for company registration.';
  end if;

  if new.email is null or btrim(new.email) = '' then
    raise exception using
      errcode = '22023',
      message = 'Email is required for company registration.';
  end if;

  insert into public.companies (id, name)
  values (company_id, company_name);

  -- raw_user_meta_data supplies profile input only. Authorization data is fixed
  -- here: public registration always creates the first admin of a new company.
  insert into public.employees (
    id,
    company_id,
    role,
    first_name,
    last_name,
    work_email,
    mobile
  )
  values (
    new.id,
    company_id,
    'admin',
    first_name,
    last_name,
    new.email,
    mobile
  );

  return new;
end;
$$;

revoke all on function private.handle_new_company_signup() from public;
revoke all on function private.handle_new_company_signup() from anon, authenticated;

create trigger on_auth_user_created_create_company
after insert on auth.users
for each row
execute function private.handle_new_company_signup();
