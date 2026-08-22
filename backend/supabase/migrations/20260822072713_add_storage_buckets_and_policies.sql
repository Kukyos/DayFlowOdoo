-- Milestone 9: company-scoped media buckets and object policies.
-- Avatars and logos are public presentation assets. Leave documents remain
-- private and are opened with short-lived signed URLs from the frontend.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('company-logos', 'company-logos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('leave-documents', 'leave-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Avatar paths: <company-id>/<employee-id>/<unique-file-name>.
create policy "company members can read avatar objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
);

create policy "employees can upload permitted avatar objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
  and (
    (storage.foldername(name))[2] = (select auth.uid())::text
    or (
      (select private.is_privileged())
      and exists (
        select 1 from public.employees as employee
        where employee.id::text = (storage.foldername(name))[2]
          and employee.company_id = (select private.current_company_id())
      )
    )
  )
);

create policy "employees can update permitted avatar objects"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
  and (
    (storage.foldername(name))[2] = (select auth.uid())::text
    or (select private.is_privileged())
  )
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
  and (
    (storage.foldername(name))[2] = (select auth.uid())::text
    or (select private.is_privileged())
  )
);

create policy "employees can delete permitted avatar objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
  and (
    (storage.foldername(name))[2] = (select auth.uid())::text
    or (select private.is_privileged())
  )
);

-- Company logo paths: <company-id>/<unique-file-name>.
create policy "company members can read company logo objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
);

create policy "privileged employees can upload company logo objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'company-logos'
  and (select private.is_privileged())
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
);

create policy "privileged employees can update company logo objects"
on storage.objects for update to authenticated
using (
  bucket_id = 'company-logos'
  and (select private.is_privileged())
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
)
with check (
  bucket_id = 'company-logos'
  and (select private.is_privileged())
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
);

create policy "privileged employees can delete company logo objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'company-logos'
  and (select private.is_privileged())
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
);

-- Leave-document paths: <company-id>/<employee-id>/<unique-file-name>.
create policy "employees can read permitted leave documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'leave-documents'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
  and (
    (storage.foldername(name))[2] = (select auth.uid())::text
    or (select private.is_privileged())
  )
);

create policy "employees can upload their own leave documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'leave-documents'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

create policy "employees can delete their own leave documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'leave-documents'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

grant update on table public.companies to authenticated;

create policy "privileged employees can update their company"
on public.companies for update to authenticated
using (
  (select private.is_privileged())
  and id = (select private.current_company_id())
)
with check (
  (select private.is_privileged())
  and id = (select private.current_company_id())
);
