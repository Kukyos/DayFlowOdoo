-- Milestone 6: employee-owned leave balances, requests, and cancellation.

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  leave_type text not null,
  start_date date not null,
  end_date date not null,
  days numeric(5, 2) not null,
  remarks text,
  attachment_url text,
  status text not null default 'pending',
  reviewed_by uuid references public.employees (id) on delete set null,
  review_comment text,
  created_at timestamptz not null default now(),
  constraint leave_requests_type_valid check (leave_type in ('paid', 'sick', 'unpaid')),
  constraint leave_requests_dates_valid check (end_date >= start_date),
  constraint leave_requests_days_positive check (days > 0),
  constraint leave_requests_status_valid check (status in ('pending', 'approved', 'rejected')),
  constraint leave_requests_review_state_valid check (
    (status = 'pending' and reviewed_by is null)
    or (status in ('approved', 'rejected') and reviewed_by is not null)
  )
);

create index leave_requests_employee_created_at_idx
on public.leave_requests (employee_id, created_at desc);

create index leave_requests_pending_created_at_idx
on public.leave_requests (created_at desc)
where status = 'pending';

alter table public.leave_requests enable row level security;
revoke all on table public.leave_requests from anon, authenticated;
grant select, delete on table public.leave_requests to authenticated;
grant all on table public.leave_requests to service_role;

create policy "employees can read their own leave requests"
on public.leave_requests
for select
to authenticated
using (
  employee_id = (select auth.uid())
  and (select private.current_company_id()) is not null
);

create policy "employees can cancel their own pending leave requests"
on public.leave_requests
for delete
to authenticated
using (
  employee_id = (select auth.uid())
  and status = 'pending'
  and (select private.current_company_id()) is not null
);

create function private.working_days_between(p_start_date date, p_end_date date)
returns integer
language sql
immutable
strict
set search_path = ''
as $$
  select count(*)::integer
  from generate_series(p_start_date, p_end_date, interval '1 day') as day(value)
  where extract(isodow from day.value) between 1 and 5
$$;

revoke all on function private.working_days_between(date, date) from public, anon, authenticated;

create function public.create_leave_request(
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

revoke all on function public.create_leave_request(text, date, date, text, text)
from public, anon;
grant execute on function public.create_leave_request(text, date, date, text, text)
to authenticated;

comment on function public.create_leave_request(text, date, date, text, text) is
  'Creates leave for the authenticated active employee and derives working days server-side.';
