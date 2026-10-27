create table public.client_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(btrim(content)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index client_messages_client_created_idx
  on public.client_messages (client_id, created_at);

alter table public.client_messages enable row level security;

create policy "Admins and clients read their own chat"
  on public.client_messages for select to authenticated
  using (public.is_admin() or client_id = (select public.client_scope()));

create policy "Admins and clients send their own chat messages"
  on public.client_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (public.is_admin() or client_id = (select public.client_scope()))
  );

grant select, insert on public.client_messages to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'client_messages'
  ) then
    alter publication supabase_realtime add table public.client_messages;
  end if;
end;
$$;
