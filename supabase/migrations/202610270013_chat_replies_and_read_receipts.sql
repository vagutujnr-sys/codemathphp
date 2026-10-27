alter table public.client_messages
  add column reply_to_id uuid,
  add column read_at timestamptz,
  add constraint client_messages_client_id_id_key unique (client_id, id),
  add constraint client_messages_reply_same_client_fkey
    foreign key (client_id, reply_to_id)
    references public.client_messages (client_id, id);

create policy "Chat recipients mark messages as read"
  on public.client_messages for update to authenticated
  using (
    sender_id <> (select auth.uid())
    and (public.is_admin() or client_id = (select public.client_scope()))
    and read_at is null
  )
  with check (
    sender_id <> (select auth.uid())
    and (public.is_admin() or client_id = (select public.client_scope()))
    and read_at is not null
  );

grant update (read_at) on public.client_messages to authenticated;
