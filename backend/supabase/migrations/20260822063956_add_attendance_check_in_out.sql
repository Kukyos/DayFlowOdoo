-- Milestone 4: server-authoritative, one-row-per-day attendance actions.

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  work_date date not null,
  check_in timestamptz,
  check_out timestamptz,
  status text not null default 'present',
  created_at timestamptz not null default now(),
  constraint attendance_one_row_per_employee_day unique (employee_id, work_date),
  constraint attendance_status_valid check (status in ('present', 'half_day', 'absent', 'leave')),
  constraint attendance_check_out_after_check_in check (
    check_out is null or (check_in is not null and check_out >= check_in)
  )
);

create index attendance_employee_work_date_idx on public.attendance (employee_id, work_date desc);

alter table public.attendance enable row level security;
revoke all on table public.attendance from anon, authenticated;
grant select on table public.attendance to authenticated;
grant all on table public.attendance to service_role;

create policy "employees can read their own attendance"
on public.attendance
for select
to authenticated
using (
  employee_id = (select auth.uid())
  and (select private.current_company_id()) is not null
);

create policy "privileged employees can read company attendance"
on public.attendance
for select
to authenticated
using (
  (select private.is_privileged())
  and exists (
    select 1
    from public.employees as employee
    where employee.id = attendance.employee_id
      and employee.company_id = (select private.current_company_id())
  )
);

create or replace function public.check_in()
returns public.attendance
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.attendance;
begin
  if (select auth.uid()) is null
    or (select private.current_company_id()) is null then
    raise exception using errcode = '42501', message = 'You must be an active employee to check in.';
  end if;

  insert into public.attendance (employee_id, work_date, check_in, status)
  values ((select auth.uid()), current_date, now(), 'present')
  returning * into result;

  return result;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'You have already checked in today.';
end;
$$;

create or replace function public.check_out()
returns public.attendance
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.attendance;
begin
  if (select auth.uid()) is null
    or (select private.current_company_id()) is null then
    raise exception using errcode = '42501', message = 'You must be an active employee to check out.';
  end if;

  update public.attendance
  set check_out = now()
  where employee_id = (select auth.uid())
    and work_date = current_date
    and check_in is not null
    and check_out is null
  returning * into result;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'You do not have an open check-in today.';
  end if;

  return result;
end;
$$;

revoke all on function public.check_in() from public, anon;
revoke all on function public.check_out() from public, anon;
grant execute on function public.check_in() to authenticated;
grant execute on function public.check_out() to authenticated;

create or replace view public.employee_directory
with (security_invoker = false)
as
select
  employee.id,
  employee.first_name,
  employee.last_name,
  employee.avatar_url,
  employee.job_position,
  employee.department,
  employee.location,
  employee.work_email,
  employee.manager_id,
  employee.about,
  employee.skills,
  case
    when exists (
      select 1
      from public.attendance as record
      where record.employee_id = employee.id
        and record.work_date = current_date
        and record.check_in is not null
    ) then 'present'
    else 'absent'
  end::text as presence
from public.employees as employee
where employee.is_active
  and employee.company_id = (select private.current_company_id());

comment on view public.employee_directory is
  'Company-scoped safe coworker data; present means checked in today. Approved leave joins in Milestone 5.';
