-- Milestone 10: one guarded dashboard read instead of six browser round trips.
-- The function returns only the caller's private values and company-safe
-- directory data. Privileged company aggregates/pending requests are null for
-- ordinary employees.

create function public.get_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller public.employees%rowtype;
  attendance_counts jsonb;
  today_record jsonb;
  company_counts jsonb := null;
  in_office jsonb;
  pending_requests jsonb := '[]'::jsonb;
  recent_requests jsonb;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select employee.*
  into caller
  from public.employees as employee
  where employee.id = (select auth.uid())
    and employee.is_active;

  if not found then
    raise exception using errcode = '42501', message = 'An active employee account is required.';
  end if;

  select jsonb_build_object(
    'present', count(*) filter (where day_status = 'present'),
    'absent', count(*) filter (where day_status = 'absent'),
    'half_day', count(*) filter (where day_status = 'half_day'),
    'leave', count(*) filter (where day_status = 'leave')
  )
  into attendance_counts
  from (
    select case
      when record.id is not null then record.status
      when exists (
        select 1
        from public.leave_requests as request
        where request.employee_id = caller.id
          and request.status = 'approved'
          and day.work_date between request.start_date and request.end_date
      ) then 'leave'
      else 'absent'
    end as day_status
    from generate_series(
      date_trunc('month', current_date)::date,
      current_date,
      interval '1 day'
    ) as day(work_date)
    left join public.attendance as record
      on record.employee_id = caller.id
     and record.work_date = day.work_date::date
    where extract(isodow from day.work_date) between 1 and 5
  ) as monthly_days;

  select to_jsonb(record)
  into today_record
  from public.attendance as record
  where record.employee_id = caller.id
    and record.work_date = current_date;

  select coalesce(jsonb_agg(to_jsonb(person) order by person.first_name, person.last_name), '[]'::jsonb)
  into in_office
  from (
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
      'present'::text as presence
    from public.employees as employee
    join public.attendance as record
      on record.employee_id = employee.id
     and record.work_date = current_date
     and record.check_in is not null
    where employee.company_id = caller.company_id
      and employee.is_active
    order by employee.first_name, employee.last_name
    limit 10
  ) as person;

  select coalesce(jsonb_agg(to_jsonb(request_row) order by request_row.created_at desc), '[]'::jsonb)
  into recent_requests
  from (
    select
      request.id,
      request.employee_id,
      concat_ws(' ', caller.first_name, caller.last_name) as employee_name,
      caller.avatar_url,
      request.leave_type,
      request.start_date,
      request.end_date,
      request.days,
      request.remarks,
      request.attachment_url,
      request.status,
      request.reviewed_by,
      request.review_comment,
      request.created_at
    from public.leave_requests as request
    where request.employee_id = caller.id
    order by request.created_at desc
    limit 5
  ) as request_row;

  if caller.role in ('admin', 'hr') then
    select jsonb_build_object(
      'headcount', count(*),
      'present_today', count(*) filter (where presence = 'present'),
      'on_leave_today', count(*) filter (where presence = 'leave'),
      'pending_leave', (
        select count(*)
        from public.leave_requests as request
        join public.employees as employee on employee.id = request.employee_id
        where employee.company_id = caller.company_id
          and request.status = 'pending'
      )
    )
    into company_counts
    from (
      select case
        when exists (
          select 1 from public.attendance as record
          where record.employee_id = employee.id
            and record.work_date = current_date
            and record.check_in is not null
        ) then 'present'
        when exists (
          select 1 from public.leave_requests as request
          where request.employee_id = employee.id
            and request.status = 'approved'
            and current_date between request.start_date and request.end_date
        ) then 'leave'
        else 'absent'
      end as presence
      from public.employees as employee
      where employee.company_id = caller.company_id
        and employee.is_active
    ) as company_employee;

    select coalesce(jsonb_agg(to_jsonb(request_row) order by request_row.created_at desc), '[]'::jsonb)
    into pending_requests
    from (
      select
        request.id,
        request.employee_id,
        concat_ws(' ', employee.first_name, employee.last_name) as employee_name,
        employee.avatar_url,
        request.leave_type,
        request.start_date,
        request.end_date,
        request.days,
        request.remarks,
        request.attachment_url,
        request.status,
        request.reviewed_by,
        request.review_comment,
        request.created_at
      from public.leave_requests as request
      join public.employees as employee on employee.id = request.employee_id
      where employee.company_id = caller.company_id
        and request.status = 'pending'
      order by request.created_at desc
      limit 5
    ) as request_row;
  end if;

  return jsonb_build_object(
    'attendance', attendance_counts,
    'balances', jsonb_build_object(
      'paid', caller.paid_leave_balance,
      'sick', caller.sick_leave_balance
    ),
    'today', jsonb_build_object(
      'checked_in', coalesce((today_record ->> 'check_in') is not null and (today_record ->> 'check_out') is null, false),
      'row', today_record
    ),
    'company', company_counts,
    'in_office', in_office,
    'pending_requests', pending_requests,
    'recent_requests', recent_requests
  );
end;
$$;

revoke all on function public.get_dashboard_summary() from public, anon;
grant execute on function public.get_dashboard_summary() to authenticated;

comment on function public.get_dashboard_summary() is
  'Authenticated dashboard payload; privileged aggregates are emitted only for active Admin/HR callers.';
