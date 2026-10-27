alter table public.project_updates
  add column screenshot_paths text[] not null default array[]::text[];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-progress',
  'project-progress',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins and project clients read progress screenshots"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'project-progress'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = (select public.client_scope())::text
    )
  );

create policy "Admins upload project progress screenshots"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'project-progress' and public.is_admin());

create policy "Admins delete project progress screenshots"
  on storage.objects for delete to authenticated
  using (bucket_id = 'project-progress' and public.is_admin());
