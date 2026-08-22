-- Align the implemented frontend flows with their database contracts.

create index if not exists leave_requests_reviewed_by_idx
on public.leave_requests (reviewed_by);

alter table public.employees
drop constraint employees_monthly_wage_nonnegative;

alter table public.employees
add constraint employees_monthly_wage_valid check (
  monthly_wage is null or monthly_wage >= 24998
);

-- Auth owns the sign-in email and employee creation timestamps. Browser-side
-- profile updates must never let even a privileged user desynchronise them.
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
    or new.must_change_password is distinct from old.must_change_password
    or new.work_email is distinct from old.work_email
    or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '42501',
      message = 'Employee identity, sign-in email, company, creation time, and password requirement cannot be changed here.';
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

revoke all on function private.enforce_employee_update_boundary()
from public, anon, authenticated;

alter table public.employees drop column login_id;
alter table public.companies drop column login_prefix;

-- Dayflow currently operates on an India workday. Keep every server-derived
-- current_date aligned with the browser's Asia/Kolkata calendar date.
alter function public.check_in() set timezone = 'Asia/Kolkata';
alter function public.check_out() set timezone = 'Asia/Kolkata';
alter function public.list_employee_directory() set timezone = 'Asia/Kolkata';
alter function public.list_company_attendance(date, text) set timezone = 'Asia/Kolkata';
alter function public.get_dashboard_summary() set timezone = 'Asia/Kolkata';
