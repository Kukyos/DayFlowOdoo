-- Tier 3 backend: company configuration and durable in-app notifications.

alter table public.companies
add column time_off_types text[] not null default array['paid', 'sick', 'unpaid']::text[],
add column working_days smallint[] not null default array[1, 2, 3, 4, 5]::smallint[],
add column workday_start time not null default time '09:00',
add column workday_end time not null default time '17:00',
add constraint companies_time_off_types_valid check (
  cardinality(time_off_types) > 0
  and array_position(time_off_types, null) is null
),
add constraint companies_working_days_valid check (
  cardinality(working_days) > 0
  and working_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
),
add constraint companies_workday_valid check (workday_start < workday_end);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  leave_request_id uuid references public.leave_requests (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_valid check (type in ('leave_approved', 'leave_rejected')),
  constraint notifications_title_not_blank check (btrim(title) <> ''),
  constraint notifications_message_not_blank check (btrim(message) <> '')
);

create index notifications_employee_created_idx
on public.notifications (employee_id, created_at desc);

create unique index notifications_leave_decision_unique
on public.notifications (leave_request_id)
where leave_request_id is not null;

alter table public.notifications enable row level security;

revoke all on table public.notifications from anon, authenticated;
grant select, update on table public.notifications to authenticated;
grant all on table public.notifications to service_role;

create policy "employees can read their notifications"
on public.notifications
for select
to authenticated
using ((select auth.uid()) = employee_id);

create policy "employees can mark their notifications read"
on public.notifications
for update
to authenticated
using ((select auth.uid()) = employee_id)
with check ((select auth.uid()) = employee_id);

create or replace function private.enforce_notification_update_boundary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.employee_id is distinct from old.employee_id
    or new.type is distinct from old.type
    or new.title is distinct from old.title
    or new.message is distinct from old.message
    or new.leave_request_id is distinct from old.leave_request_id
    or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '42501',
      message = 'Only notification read state can be changed.';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_notification_update_boundary()
from public, anon, authenticated;

create trigger enforce_notification_update_boundary
before update on public.notifications
for each row execute function private.enforce_notification_update_boundary();

create or replace function private.notify_leave_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status in ('approved', 'rejected') then
    insert into public.notifications (
      employee_id,
      type,
      title,
      message,
      leave_request_id
    ) values (
      new.employee_id,
      'leave_' || new.status,
      case new.status
        when 'approved' then 'Time off approved'
        else 'Time off declined'
      end,
      format(
        'Your %s leave request from %s to %s was %s.',
        replace(new.leave_type, '_', ' '),
        to_char(new.start_date, 'DD Mon YYYY'),
        to_char(new.end_date, 'DD Mon YYYY'),
        new.status
      ),
      new.id
    );
  end if;

  return new;
end;
$$;

revoke all on function private.notify_leave_decision()
from public, anon, authenticated;

create trigger notify_leave_decision
after update of status on public.leave_requests
for each row execute function private.notify_leave_decision();

comment on table public.notifications is
  'Server-created in-app notifications. Employees may read their own rows and change read_at only.';
