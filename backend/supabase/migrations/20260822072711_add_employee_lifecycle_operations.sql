-- Milestone 8: guarded soft-deactivation. Auth-account creation lives in the
-- create-employee Edge Function because the browser must never receive an
-- Auth admin key.

create or replace function public.deactivate_employee(p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if not (select private.is_privileged()) then
    raise exception using errcode = '42501', message = 'Only Admin or HR can deactivate employees.';
  end if;

  if p_employee_id = caller_id then
    raise exception using errcode = '22023', message = 'You cannot deactivate your own account.';
  end if;

  update public.employees as employee
  set is_active = false
  where employee.id = p_employee_id
    and employee.company_id = (select private.current_company_id())
    and employee.is_active;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'That active employee does not exist in your company.';
  end if;
end;
$$;

revoke all on function public.deactivate_employee(uuid) from public, anon;
grant execute on function public.deactivate_employee(uuid) to authenticated;

comment on function public.deactivate_employee(uuid) is
  'Admin/HR-only same-company soft deactivation; self-deactivation is refused.';
