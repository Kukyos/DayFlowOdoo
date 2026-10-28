-- Résumé files, previously held only in browser memory. Private like leave
-- documents: the owner and their company's Admin/HR read them through
-- short-lived signed URLs. The directory RPC does not expose these columns, so
-- coworkers never see a résumé.

alter table public.employees
add column resume_path text,
add column resume_name text,
add column resume_uploaded_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  5242880,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Résumé paths: <company-id>/<employee-id>/<unique-file-name>.
create policy "employees can read permitted resumes"
on storage.objects for select to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
  and (
    (storage.foldername(name))[2] = (select auth.uid())::text
    or (select private.is_privileged())
  )
);

create policy "employees can upload their own resumes"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

create policy "employees can delete their own resumes"
on storage.objects for delete to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select private.current_company_id())::text
  and (storage.foldername(name))[2] = (select auth.uid())::text
);
