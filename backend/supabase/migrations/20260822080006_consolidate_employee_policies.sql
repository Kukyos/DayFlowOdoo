-- Milestone 12: consolidate equivalent employee SELECT/UPDATE policies so
-- Postgres evaluates one permissive policy per action and role.

drop policy if exists "employees can read their active record" on public.employees;
drop policy if exists "privileged employees can read company employee records" on public.employees;

create policy "employees can read permitted employee records"
on public.employees for select to authenticated
using (
  is_active
  and (
    id = (select auth.uid())
    or (
      (select private.is_privileged())
      and company_id = (select private.current_company_id())
    )
  )
);

drop policy if exists "employees can update their permitted profile fields" on public.employees;
drop policy if exists "privileged employees can update company employee records" on public.employees;

create policy "employees can update permitted employee records"
on public.employees for update to authenticated
using (
  (
    id = (select auth.uid())
    and is_active
  )
  or (
    (select private.is_privileged())
    and company_id = (select private.current_company_id())
  )
)
with check (
  (
    id = (select auth.uid())
    and is_active
  )
  or (
    (select private.is_privileged())
    and company_id = (select private.current_company_id())
  )
);
