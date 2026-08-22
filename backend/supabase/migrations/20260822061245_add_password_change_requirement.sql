alter table public.employees
add column must_change_password boolean not null default false;

comment on column public.employees.must_change_password is
  'True for HR-created accounts until Supabase Auth records an actual password change.';

-- Clearing this flag from a browser-callable RPC would let a client bypass the
-- first-login requirement. Tie it to the actual Auth password hash changing
-- instead. This trigger function is private, has a fixed search path, and is
-- not executable by Data API roles.
create or replace function private.clear_password_change_requirement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.employees
    set must_change_password = false
    where id = new.id
      and must_change_password;
  end if;

  return new;
end;
$$;

revoke all on function private.clear_password_change_requirement() from public;
revoke all on function private.clear_password_change_requirement() from anon, authenticated;

create trigger on_auth_user_password_changed
after update of encrypted_password on auth.users
for each row
execute function private.clear_password_change_requirement();
