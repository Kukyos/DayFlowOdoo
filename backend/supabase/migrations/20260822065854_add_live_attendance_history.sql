-- Milestone 5: live attendance history and a privileged company-day register.

create function public.list_company_attendance(
  p_work_date date default current_date,
  p_search text default null
)
returns table (
  work_date date,
  employee_id uuid,
  employee_name text,
  avatar_url text,
  check_in timestamptz,
  check_out timestamptz,
  status text,
  work_hours numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not (select private.is_privileged()) then
    raise exception using
      errcode = '42501',
      message = 'Only Admin and HR employees can view company attendance.';
  end if;

  return query
  select
    p_work_date,
    employee.id,
    concat_ws(' ', employee.first_name, employee.last_name),
    employee.avatar_url,
    record.check_in,
    record.check_out,
    coalesce(record.status, 'absent')::text,
    case
      when record.check_in is not null and record.check_out is not null
        then round((extract(epoch from (record.check_out - record.check_in)) / 3600)::numeric, 2)
      else null::numeric
    end
  from public.employees as employee
  left join public.attendance as record
    on record.employee_id = employee.id
   and record.work_date = p_work_date
  where employee.is_active
    and employee.company_id = (select private.current_company_id())
    and (
      nullif(btrim(p_search), '') is null
      or concat_ws(' ', employee.first_name, employee.last_name) ilike
        '%' || btrim(p_search) || '%'
    )
  order by employee.first_name, employee.last_name;
end;
$$;

revoke all on function public.list_company_attendance(date, text) from public, anon;
grant execute on function public.list_company_attendance(date, text) to authenticated;

comment on function public.list_company_attendance(date, text) is
  'Admin/HR-only company attendance register. Missing rows are returned as absent.';
