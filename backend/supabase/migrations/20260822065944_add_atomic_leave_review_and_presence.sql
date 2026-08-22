-- Milestone 7: company leave reads, one-time review, and leave-aware presence.

create policy "privileged employees can read company leave requests"
on public.leave_requests
for select
to authenticated
using (
  (select private.is_privileged())
  and exists (
    select 1
    from public.employees as employee
    where employee.id = leave_requests.employee_id
      and employee.company_id = (select private.current_company_id())
  )
);

create function public.review_leave_request(
  p_request_id uuid,
  p_status text,
  p_comment text default null
)
returns public.leave_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.leave_requests;
  result public.leave_requests;
begin
  if (select auth.uid()) is null
    or not (select private.is_privileged()) then
    raise exception using
      errcode = '42501',
      message = 'Only Admin and HR employees can review leave requests.';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception using
      errcode = '22023',
      message = 'A leave request can only be approved or rejected.';
  end if;

  select leave_request.*
  into request
  from public.leave_requests as leave_request
  join public.employees as employee on employee.id = leave_request.employee_id
  where leave_request.id = p_request_id
    and employee.company_id = (select private.current_company_id())
  for update of leave_request;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'That leave request no longer exists or is outside your company.';
  end if;

  if request.status <> 'pending' then
    raise exception using
      errcode = '22023',
      message = 'That leave request has already been decided.';
  end if;

  if p_status = 'approved' and request.leave_type = 'paid' then
    update public.employees
    set paid_leave_balance = paid_leave_balance - request.days
    where id = request.employee_id
      and paid_leave_balance >= request.days;

    if not found then
      raise exception using
        errcode = '22023',
        message = 'The employee no longer has enough paid leave for this request.';
    end if;
  elsif p_status = 'approved' and request.leave_type = 'sick' then
    update public.employees
    set sick_leave_balance = sick_leave_balance - request.days
    where id = request.employee_id
      and sick_leave_balance >= request.days;

    if not found then
      raise exception using
        errcode = '22023',
        message = 'The employee no longer has enough sick leave for this request.';
    end if;
  end if;

  update public.leave_requests
  set
    status = p_status,
    reviewed_by = (select auth.uid()),
    review_comment = nullif(btrim(p_comment), '')
  where id = request.id
  returning * into result;

  return result;
end;
$$;

revoke all on function public.review_leave_request(uuid, text, text)
from public, anon;
grant execute on function public.review_leave_request(uuid, text, text)
to authenticated;

comment on function public.review_leave_request(uuid, text, text) is
  'Admin/HR-only one-time review. Approval decrements paid or sick balance in the same transaction.';

create or replace function public.list_employee_directory()
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
      when exists (
        select 1
        from public.leave_requests as request
        where request.employee_id = employee.id
          and request.status = 'approved'
          and request.start_date <= current_date
          and request.end_date >= current_date
      ) then 'leave'
      else 'absent'
    end::text
  from public.employees as employee
  where employee.is_active
    and employee.company_id = (select private.current_company_id())
$$;

create or replace function public.list_company_attendance(
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
    case
      when record.id is not null then record.status
      when exists (
        select 1
        from public.leave_requests as request
        where request.employee_id = employee.id
          and request.status = 'approved'
          and request.start_date <= p_work_date
          and request.end_date >= p_work_date
      ) then 'leave'
      else 'absent'
    end::text,
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

comment on function public.list_company_attendance(date, text) is
  'Admin/HR-only company register. Missing rows are derived as approved leave or absence.';
