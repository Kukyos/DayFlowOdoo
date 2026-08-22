-- Allow employees to use a stable, company-prefixed Login ID in addition to
-- their Supabase Auth email. Credentials remain in auth.users; this migration
-- stores only the public identifier and allocates it atomically.

alter table public.companies
add column login_prefix text;

alter table public.employees
add column login_id text;

create table private.login_prefix_sequences (
  prefix text primary key,
  next_sequence bigint not null check (next_sequence > 0)
);

-- The first word is a concise, stable company prefix. A company rename does
-- not rewrite existing IDs or change the stored prefix.
update public.companies
set login_prefix = coalesce(
  nullif(
    upper(regexp_replace(split_part(btrim(name), ' ', 1), '[^A-Za-z0-9]', '', 'g')),
    ''
  ),
  'DAYFLOW'
)
where login_prefix is null;

alter table public.companies
alter column login_prefix set not null;

alter table public.companies
add constraint companies_login_prefix_valid
check (login_prefix ~ '^[A-Z0-9]+$');

with numbered_employees as (
  select
    employee.id,
    company.login_prefix,
    row_number() over (
      partition by company.login_prefix
      order by employee.created_at, employee.id
    ) as sequence_number
  from public.employees as employee
  join public.companies as company on company.id = employee.company_id
)
update public.employees as employee
set login_id = numbered_employees.login_prefix || '-' || lpad(numbered_employees.sequence_number::text, 6, '0')
from numbered_employees
where employee.id = numbered_employees.id;

insert into private.login_prefix_sequences (prefix, next_sequence)
select
  company.login_prefix,
  count(employee.id) + 1
from public.companies as company
left join public.employees as employee on employee.company_id = company.id
group by company.login_prefix
on conflict (prefix) do update
set next_sequence = greatest(
  private.login_prefix_sequences.next_sequence,
  excluded.next_sequence
);

alter table public.employees
alter column login_id set not null;

alter table public.employees
add constraint employees_login_id_unique unique (login_id),
add constraint employees_login_id_valid check (login_id ~ '^[A-Z0-9]+-[0-9]{6,}$');

create or replace function public.allocate_employee_login_id(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  prefix text;
  sequence_number bigint;
begin
  select company.login_prefix
  into prefix
  from public.companies as company
  where company.id = p_company_id;

  if prefix is null then
    raise exception using errcode = 'P0002', message = 'Company login prefix was not found.';
  end if;

  insert into private.login_prefix_sequences as sequence (prefix, next_sequence)
  values (prefix, 2)
  on conflict (prefix) do update
  set next_sequence = sequence.next_sequence + 1
  returning next_sequence - 1 into sequence_number;

  return prefix || '-' || lpad(sequence_number::text, 6, '0');
end;
$$;

revoke all on function public.allocate_employee_login_id(uuid) from public, anon, authenticated;
grant execute on function public.allocate_employee_login_id(uuid) to service_role;

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
  company_prefix text;
begin
  if new.raw_user_meta_data ->> 'registration_type' is distinct from 'company' then
    return new;
  end if;

  if company_name is null then
    raise exception using errcode = '22023', message = 'Company name is required for company registration.';
  end if;
  if first_name is null or last_name is null then
    raise exception using errcode = '22023', message = 'Admin first name and last name are required for company registration.';
  end if;
  if new.email is null or btrim(new.email) = '' then
    raise exception using errcode = '22023', message = 'Email is required for company registration.';
  end if;

  company_prefix := coalesce(
    nullif(upper(regexp_replace(split_part(company_name, ' ', 1), '[^A-Za-z0-9]', '', 'g')), ''),
    'DAYFLOW'
  );

  insert into public.companies (id, name, login_prefix)
  values (company_id, company_name, company_prefix);

  insert into public.employees (
    id, company_id, login_id, role, first_name, last_name, work_email, mobile
  ) values (
    new.id,
    company_id,
    public.allocate_employee_login_id(company_id),
    'admin',
    first_name,
    last_name,
    new.email,
    mobile
  );

  return new;
end;
$$;

revoke all on function private.handle_new_company_signup() from public, anon, authenticated;

create or replace function private.enforce_employee_update_boundary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.company_id is distinct from old.company_id
    or new.login_id is distinct from old.login_id
    or new.must_change_password is distinct from old.must_change_password
    or new.work_email is distinct from old.work_email
    or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '42501',
      message = 'Employee identity, Login ID, sign-in email, company, creation time, and password requirement cannot be changed here.';
  end if;

  if not (select private.is_privileged()) then
    if new.role is distinct from old.role
      or new.first_name is distinct from old.first_name
      or new.last_name is distinct from old.last_name
      or new.job_position is distinct from old.job_position
      or new.department is distinct from old.department
      or new.location is distinct from old.location
      or new.manager_id is distinct from old.manager_id
      or new.date_of_joining is distinct from old.date_of_joining
      or new.monthly_wage is distinct from old.monthly_wage
      or new.paid_leave_balance is distinct from old.paid_leave_balance
      or new.sick_leave_balance is distinct from old.sick_leave_balance
      or new.is_active is distinct from old.is_active then
      raise exception using
        errcode = '42501',
        message = 'You can only update your permitted profile and private information.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_employee_update_boundary() from public, anon, authenticated;
