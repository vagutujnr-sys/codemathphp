alter table public.client_messages
  alter column content drop not null,
  add column attachment_path text,
  add column attachment_name text,
  add column attachment_mime text;

alter table public.client_messages
  drop constraint if exists client_messages_content_check,
  add constraint client_messages_content_check
    check (content is null or length(btrim(content)) between 1 and 4000),
  add constraint client_messages_content_or_attachment_check
    check (content is not null or attachment_path is not null),
  add constraint client_messages_attachment_metadata_check
    check (
      (attachment_path is null and attachment_name is null and attachment_mime is null)
      or (
        attachment_path is not null
        and attachment_name is not null
        and attachment_mime ~ '^(image|audio|video)/'
      )
    );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-chat-media',
  'client-chat-media',
  false,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'audio/aac', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/wav',
    'audio/x-m4a', 'audio/x-wav',
    'video/3gpp', 'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Chat participants read private chat media"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'client-chat-media'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = (select public.client_scope())::text
    )
  );

create policy "Chat participants upload private chat media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'client-chat-media'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = (select public.client_scope())::text
    )
  );

create policy "Chat participants remove their private chat media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'client-chat-media'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = (select public.client_scope())::text
    )
  );

create policy "Chat participants receive private voice call signaling"
  on realtime.messages for select to authenticated
  using (
    realtime.topic() like 'client-call:%'
    and (
      public.is_admin()
      or split_part(realtime.topic(), ':', 2) = (select public.client_scope())::text
    )
  );

create policy "Chat participants send private voice call signaling"
  on realtime.messages for insert to authenticated
  with check (
    realtime.topic() like 'client-call:%'
    and (
      public.is_admin()
      or split_part(realtime.topic(), ':', 2) = (select public.client_scope())::text
    )
  );
