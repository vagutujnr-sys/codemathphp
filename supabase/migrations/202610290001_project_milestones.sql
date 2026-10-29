create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'completed')),
  due_date date,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_milestones_project_position_idx
  on public.project_milestones (project_id, position, created_at);

alter table public.project_milestones enable row level security;

create policy "Admins or owners read project milestones"
  on public.project_milestones for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.client_id = (select public.client_scope())
    )
  );

create policy "Admins manage project milestones"
  on public.project_milestones for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.project_milestones to authenticated;
grant all on public.project_milestones to service_role;

create or replace function public.sync_project_milestone_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid;
begin
  if tg_op = 'DELETE' then
    target_project_id := old.project_id;
  else
    target_project_id := new.project_id;
  end if;

  if tg_op = 'UPDATE' and old.project_id <> new.project_id then
    update public.projects p
    set progress = coalesce((
          select floor(
            count(*) filter (where m.status = 'completed') * 100.0 / nullif(count(*), 0)
          )::smallint
          from public.project_milestones m
          where m.project_id = old.project_id
        ), 0),
        status = case
          when exists (
            select 1 from public.project_milestones m where m.project_id = old.project_id
          ) and not exists (
            select 1
            from public.project_milestones m
            where m.project_id = old.project_id and m.status <> 'completed'
          ) then 'completed'
          when p.status = 'completed' then 'in_progress'
          else p.status
        end,
        updated_at = now()
    where p.id = old.project_id;
  end if;

  update public.projects p
  set progress = coalesce((
        select floor(
          count(*) filter (where m.status = 'completed') * 100.0 / nullif(count(*), 0)
        )::smallint
        from public.project_milestones m
        where m.project_id = target_project_id
      ), 0),
      status = case
      when exists (
        select 1 from public.project_milestones m where m.project_id = target_project_id
      ) and not exists (
        select 1
        from public.project_milestones m
        where m.project_id = target_project_id and m.status <> 'completed'
      ) then 'completed'
      when p.status = 'completed' then 'in_progress'
      else p.status
      end,
      updated_at = now()
  where p.id = target_project_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['projects', 'project_milestones']
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;

create trigger project_milestones_sync_progress
  after insert or update or delete on public.project_milestones
  for each row execute function public.sync_project_milestone_progress();
