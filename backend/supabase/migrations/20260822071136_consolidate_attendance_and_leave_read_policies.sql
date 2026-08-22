-- Converge iterative and fresh installs on one SELECT policy per table.
-- This keeps the employee/admin OR boundary while avoiding duplicate
-- permissive-policy evaluation for every attendance and leave read.

drop policy if exists "employees can read their own attendance"
on public.attendance;

drop policy if exists "privileged employees can read company attendance"
on public.attendance;

drop policy if exists "employees can read permitted attendance"
on public.attendance;

create policy "employees can read permitted attendance"
on public.attendance
for select
to authenticated
using (
  (select private.current_company_id()) is not null
  and (
    employee_id = (select auth.uid())
    or (
      (select private.is_privileged())
      and exists (
        select 1
        from public.employees as employee
        where employee.id = attendance.employee_id
          and employee.company_id = (select private.current_company_id())
      )
    )
  )
);

drop policy if exists "employees can read their own leave requests"
on public.leave_requests;

drop policy if exists "privileged employees can read company leave requests"
on public.leave_requests;

drop policy if exists "employees can read permitted leave requests"
on public.leave_requests;

create policy "employees can read permitted leave requests"
on public.leave_requests
for select
to authenticated
using (
  (select private.current_company_id()) is not null
  and (
    employee_id = (select auth.uid())
    or (
      (select private.is_privileged())
      and exists (
        select 1
        from public.employees as employee
        where employee.id = leave_requests.employee_id
          and employee.company_id = (select private.current_company_id())
      )
    )
  )
);
