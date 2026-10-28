-- Post-hackathon audit fixes:
-- 1. A leave request may not overlap the employee's own pending or approved
--    leave, and an approval may not overlap approved leave, so a balance is
--    never charged twice for the same day.
-- 2. Attendance counts start at the employee's joining date, and today is not
--    an absence until the day is over.
-- 3. Only an admin may change a role, and never their own.

create or replace function public.create_leave_request(
  p_leave_type text,
  p_start_date date,
  p_end_date date,
  p_remarks text default null,
  p_attachment_url text default null
)
returns public.leave_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller public.employees;
  requested_days integer;
  result public.leave_requests;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'You must be signed in to request leave.';
  end if;

  select employee.*
  into caller
  from public.employees as employee
  where employee.id = (select auth.uid())
    and employee.is_active;

  if not found then
    raise exception using errcode = '42501', message = 'You must be an active employee to request leave.';
  end if;

  if p_leave_type not in ('paid', 'sick', 'unpaid') then
    raise exception using errcode = '22023', message = 'Choose paid, sick, or unpaid leave.';
  end if;

  if p_end_date < p_start_date then
    raise exception using errcode = '22023', message = 'The end date cannot be before the start date.';
  end if;

  requested_days := private.working_days_between(p_start_date, p_end_date);
  if requested_days = 0 then
    raise exception using errcode = '22023', message = 'That range contains no working days.';
  end if;

  if exists (
    select 1
    from public.leave_requests as request
    where request.employee_id = caller.id
      and request.status in ('pending', 'approved')
      and request.start_date <= p_end_date
      and request.end_date >= p_start_date
  ) then
    raise exception using
      errcode = '22023',
      message = 'You already have leave requested for some of those days.';
  end if;

  if p_leave_type = 'paid' and requested_days > caller.paid_leave_balance then
    raise exception using
      errcode = '22023',
      message = format('Only %s paid days remaining.', caller.paid_leave_balance);
  end if;

  if p_leave_type = 'sick' and requested_days > caller.sick_leave_balance then
    raise exception using
      errcode = '22023',
      message = format('Only %s sick days remaining.', caller.sick_leave_balance);
  end if;

  insert into public.leave_requests (
    employee_id,
    leave_type,
    start_date,
    end_date,
    days,
    remarks,
    attachment_url
  )
  values (
    caller.id,
    p_leave_type,
    p_start_date,
    p_end_date,
    requested_days,
    nullif(btrim(p_remarks), ''),
    nullif(btrim(p_attachment_url), '')
  )
  returning * into result;

  return result;
end;
$$;

create or replace function public.review_leave_request(
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

  if p_status = 'approved' and exists (
    select 1
    from public.leave_requests as other
    where other.employee_id = request.employee_id
      and other.id <> request.id
      and other.status = 'approved'
      and other.start_date <= request.end_date
      and other.end_date >= request.start_date
  ) then
    raise exception using
      errcode = '22023',
      message = 'Some of those days are already covered by approved leave.';
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
set timezone = 'Asia/Kolkata'
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
    and (employee.date_of_joining is null or employee.date_of_joining <= p_work_date)
    and (
      nullif(btrim(p_search), '') is null
      or concat_ws(' ', employee.first_name, employee.last_name) ilike
        '%' || btrim(p_search) || '%'
    )
  order by employee.first_name, employee.last_name;
end;
$$;

create or replace function public.get_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'Asia/Kolkata'
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

  -- Counted from the joining date (greatest() ignores a null one). Today only
  -- counts once there is a record: it is not an absence before the day ends.
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
      greatest(date_trunc('month', current_date)::date, caller.date_of_joining),
      current_date,
      interval '1 day'
    ) as day(work_date)
    left join public.attendance as record
      on record.employee_id = caller.id
     and record.work_date = day.work_date::date
    where extract(isodow from day.work_date) between 1 and 5
      and (day.work_date::date < current_date or record.id is not null)
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

  -- HR is privileged but must not grant itself or anyone else admin access.
  if new.role is distinct from old.role and (
    new.id = (select auth.uid())
    or not exists (
      select 1
      from public.employees as caller
      where caller.id = (select auth.uid())
        and caller.role = 'admin'
        and caller.is_active
    )
  ) then
    raise exception using
      errcode = '42501',
      message = 'Only an admin can change another employee''s access level.';
  end if;

  return new;
end;
$$;
