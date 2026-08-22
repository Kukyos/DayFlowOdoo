-- The directory view intentionally used owner permissions to avoid granting
-- broad employee-table reads. Supabase's advisor correctly flags that view
-- shape as security-definer. Expose the same narrow projection as an explicit
-- guarded RPC instead, keeping the full table private to coworkers.

drop view public.employee_directory;

create function public.list_employee_directory()
returns table (
  id uuid,
  first_name text,
  last_name text,
  avatar_url text,
  job_position text,
  department text,
  location text,
  work_email text,
  manager_id uuid,
  about text,
  skills text[],
  presence text
)
language sql
stable
security definer
set search_path = ''
as $$
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
    end::text
  from public.employees as employee
  where employee.is_active
    and employee.company_id = (select private.current_company_id())
$$;

revoke all on function public.list_employee_directory() from public, anon;
grant execute on function public.list_employee_directory() to authenticated;
