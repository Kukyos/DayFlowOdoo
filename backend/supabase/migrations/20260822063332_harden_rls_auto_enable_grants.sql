-- Hosted projects may install this event-trigger function to enable RLS on new
-- public tables. Event triggers do not need Data API roles to execute their
-- backing function, so remove those browser-callable grants when it exists.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
