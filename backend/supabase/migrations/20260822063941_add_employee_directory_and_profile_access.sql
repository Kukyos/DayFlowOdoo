-- Milestone 2: company-scoped, directory-safe employee reads.
--
-- The employee table remains the source of full/private data. Coworkers use
-- this view instead, so sensitive columns cannot arrive in the browser.

create or replace function private.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select employee.company_id
  from public.employees as employee
  where employee.id = (select auth.uid())
    and employee.is_active
$$;

create or replace function private.is_privileged()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select employee.role in ('admin', 'hr')
    from public.employees as employee
    where employee.id = (select auth.uid())
      and employee.is_active
  ), false)
$$;

revoke all on function private.current_company_id() from public, anon;
revoke all on function private.is_privileged() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.current_company_id() to authenticated;
grant execute on function private.is_privileged() to authenticated;

create policy "privileged employees can read company employee records"
on public.employees
for select
to authenticated
using (
  (select private.is_privileged())
  and company_id = (select private.current_company_id())
);

create view public.employee_directory
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
  'absent'::text as presence
from public.employees as employee
where employee.is_active
  and employee.company_id = (select private.current_company_id());

revoke all on table public.employee_directory from public, anon;
grant select on table public.employee_directory to authenticated;

comment on view public.employee_directory is
  'Company-scoped safe coworker data. Presence becomes live with attendance in Milestone 4.';
