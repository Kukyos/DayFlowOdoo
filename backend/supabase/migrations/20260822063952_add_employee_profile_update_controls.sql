-- Milestone 3: controlled profile and wage updates.
--
-- RLS decides which rows can be targeted. This trigger provides the missing
-- column-level boundary so an employee cannot smuggle role, salary, company,
-- leave balance, activation, or password-flag changes through an own-row
-- UPDATE policy.

create or replace function private.enforce_employee_update_boundary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Auth's password-change trigger updates this flag outside a browser JWT.
  -- It has its own narrow condition: a real password-hash change in auth.users.
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.company_id is distinct from old.company_id
    or new.must_change_password is distinct from old.must_change_password then
    raise exception using
      errcode = '42501',
      message = 'Employee identity, company, and password requirement cannot be changed here.';
  end if;

  if not (select private.is_privileged()) then
    if new.role is distinct from old.role
      or new.login_id is distinct from old.login_id
      or new.first_name is distinct from old.first_name
      or new.last_name is distinct from old.last_name
      or new.work_email is distinct from old.work_email
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

create trigger enforce_employee_update_boundary
before update on public.employees
for each row
execute function private.enforce_employee_update_boundary();

grant update on table public.employees to authenticated;

create policy "employees can update their permitted profile fields"
on public.employees
for update
to authenticated
using (
  id = (select auth.uid())
  and is_active
)
with check (
  id = (select auth.uid())
  and is_active
);

create policy "privileged employees can update company employee records"
on public.employees
for update
to authenticated
using (
  (select private.is_privileged())
  and company_id = (select private.current_company_id())
)
with check (
  (select private.is_privileged())
  and company_id = (select private.current_company_id())
);
