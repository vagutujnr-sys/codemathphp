create extension if not exists pgcrypto with schema extensions;

create type public.account_role as enum ('admin', 'client');
create type public.invoice_status as enum ('draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  company text,
  notes text,
  legacy_import_key text unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role public.account_role not null default 'client',
  client_id uuid references public.clients(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint client_role_has_client check (role = 'admin' or client_id is not null)
);

create or replace function public.sync_client_display_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set display_name = new.name
  where client_id = new.id and role = 'client';
  return new;
end;
$$;

create trigger clients_sync_profile_name
after update of name on public.clients
for each row execute function public.sync_client_display_name();

create table public.pin_credentials (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  auth_email text not null unique,
  pin_hash text not null,
  pin_fingerprint text not null unique,
  updated_at timestamptz not null default now()
);

create table public.pin_login_attempts (
  ip_hash text primary key,
  attempt_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  legacy_import_key text unique,
  created_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  invoice_number text not null unique,
  client_name text not null,
  client_email text,
  client_phone text,
  issue_date date not null default current_date,
  due_date date,
  status public.invoice_status not null default 'draft',
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  exchange_rate numeric(14, 6) not null default 1 check (exchange_rate > 0),
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  tax_amount numeric(12, 2) not null default 0 check (tax_amount >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  base_currency text check (base_currency is null or base_currency ~ '^[A-Z]{3}$'),
  base_currency_total numeric(12, 2),
  notes text,
  payment_method text,
  payment_details jsonb,
  legacy_import_key text unique,
  share_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);

create sequence public.invoice_number_seq;

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  legacy_import_key text unique,
  line_total numeric(12, 2) generated always as (round(quantity * unit_price, 2)) stored
);

create sequence public.receipt_number_seq;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id),
  receipt_number text not null unique,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  method text not null,
  reference text,
  legacy_import_key text unique,
  received_at timestamptz not null default now(),
  notes text
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  status text not null default 'in_progress',
  progress smallint not null default 0 check (progress between 0 and 100),
  summary text,
  updated_at timestamptz not null default now()
);

create table public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  content text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.shared_resources (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  content text,
  url text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint shared_resource_has_content check (content is not null or url is not null),
  constraint shared_resource_url_scheme check (url is null or url ~* '^https?://')
);

create index invoices_client_date_idx on public.invoices (client_id, issue_date desc);
create index invoice_items_invoice_idx on public.invoice_items (invoice_id);
create index payments_invoice_idx on public.payments (invoice_id, received_at desc);
create index projects_client_updated_idx on public.projects (client_id, updated_at desc);
create index project_updates_client_created_idx on public.project_updates (client_id, created_at desc);
create index shared_resources_client_created_idx on public.shared_resources (client_id, created_at desc);
create index pin_login_attempts_window_idx on public.pin_login_attempts (window_started_at);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and active
  );
$$;

create or replace function public.client_scope()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select client_id from public.profiles
  where id = (select auth.uid()) and role = 'client' and active
  limit 1;
$$;

create or replace function public.pin_account_for_login(p_pin text)
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
  select c.auth_email
  from public.pin_credentials c
  join public.profiles p on p.id = c.user_id
  where p.active and p.role in ('admin', 'client')
    and c.pin_hash = extensions.crypt(p_pin, c.pin_hash)
  limit 1;
$$;

create or replace function public.is_pin_login_blocked(p_ip_hash text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select blocked_until > now() from public.pin_login_attempts where ip_hash = p_ip_hash),
    false
  );
$$;

create or replace function public.record_pin_login_failure(p_ip_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.pin_login_attempts
  where window_started_at < now() - interval '1 day';

  insert into public.pin_login_attempts (ip_hash, attempt_count, window_started_at)
  values (p_ip_hash, 1, now())
  on conflict (ip_hash) do update
    set attempt_count = case
          when public.pin_login_attempts.window_started_at < now() - interval '15 minutes' then 1
          else public.pin_login_attempts.attempt_count + 1
        end,
        window_started_at = case
          when public.pin_login_attempts.window_started_at < now() - interval '15 minutes' then now()
          else public.pin_login_attempts.window_started_at
        end,
        blocked_until = case
          when public.pin_login_attempts.window_started_at < now() - interval '15 minutes' then null
          when public.pin_login_attempts.attempt_count + 1 >= 8 then now() + interval '15 minutes'
          else public.pin_login_attempts.blocked_until
        end;
end;
$$;

create or replace function public.clear_pin_login_failures(p_ip_hash text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.pin_login_attempts where ip_hash = p_ip_hash;
$$;

create or replace function public.provision_pin_account(
  p_user_id uuid,
  p_display_name text,
  p_role public.account_role,
  p_auth_email text,
  p_pin text,
  p_pin_fingerprint text,
  p_client_id uuid default null,
  p_client jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_client_id uuid := p_client_id;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    raise exception 'PIN must be exactly six digits';
  end if;
  if p_role = 'client' and new_client_id is null then
    insert into public.clients (name, email, phone, company)
    values (
      coalesce(p_client->>'name', p_display_name),
      nullif(p_client->>'email', ''),
      nullif(p_client->>'phone', ''),
      nullif(p_client->>'company', '')
    )
    returning id into new_client_id;
  end if;
  insert into public.profiles (id, display_name, role, client_id)
  values (p_user_id, p_display_name, p_role, new_client_id);
  insert into public.pin_credentials (user_id, auth_email, pin_hash, pin_fingerprint)
  values (
    p_user_id, p_auth_email, extensions.crypt(p_pin, extensions.gen_salt('bf', 12)),
    p_pin_fingerprint
  );
  return new_client_id;
end;
$$;

create or replace function public.change_pin(p_user_id uuid, p_pin text, p_pin_fingerprint text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    raise exception 'PIN must be exactly six digits';
  end if;
  update public.pin_credentials
  set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 12)),
      pin_fingerprint = p_pin_fingerprint,
      updated_at = now()
  where user_id = p_user_id;
  if not found then raise exception 'Account does not exist'; end if;
end;
$$;

create or replace function public.record_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text default null,
  p_notes text default null
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_row public.invoices;
  payment_row public.payments;
  paid_sum numeric(12, 2);
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  select * into invoice_row from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice does not exist'; end if;
  if p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  select coalesce(sum(amount), 0) into paid_sum from public.payments where invoice_id = p_invoice_id;
  if p_amount > invoice_row.total - paid_sum then
    raise exception 'Payment exceeds the outstanding balance';
  end if;

  insert into public.payments (invoice_id, receipt_number, amount, currency, method, reference, notes)
  values (
    p_invoice_id,
    'RCT-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.receipt_number_seq')::text, 6, '0'),
    p_amount,
    invoice_row.currency,
    p_method,
    p_reference,
    p_notes
  )
  returning * into payment_row;

  select coalesce(sum(amount), 0) into paid_sum from public.payments where invoice_id = p_invoice_id;
  update public.invoices
  set status = case
    when paid_sum >= total then 'paid'::public.invoice_status
    when paid_sum > 0 then 'partial'::public.invoice_status
    else status
  end
  where id = p_invoice_id;
  return payment_row;
end;
$$;

create or replace function public.create_invoice(
  p_client_id uuid,
  p_issue_date date,
  p_due_date date,
  p_currency text,
  p_exchange_rate numeric,
  p_notes text,
  p_payment_method text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  client_row public.clients;
  new_invoice_id uuid;
  computed_subtotal numeric(12, 2);
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one invoice item is required';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where coalesce(nullif(item->>'description', ''), '') = ''
      or coalesce((item->>'quantity')::numeric, 0) <= 0
      or coalesce((item->>'unit_price')::numeric, -1) < 0
  ) then
    raise exception 'Invoice items contain invalid values';
  end if;

  select * into client_row from public.clients where id = p_client_id;
  if not found then raise exception 'Client does not exist'; end if;
  select sum(round((item->>'quantity')::numeric * (item->>'unit_price')::numeric, 2))
  into computed_subtotal
  from jsonb_array_elements(p_items) item;

  insert into public.invoices (
    client_id, invoice_number, client_name, client_email, client_phone, issue_date,
    due_date, currency, exchange_rate, subtotal, total, notes, payment_method
  )
  values (
    client_row.id,
    'INV-' || to_char(p_issue_date, 'YYYYMMDD') || '-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0'),
    client_row.name, client_row.email, client_row.phone,
    p_issue_date, p_due_date, upper(p_currency), p_exchange_rate, computed_subtotal,
    computed_subtotal, p_notes, p_payment_method
  )
  returning id into new_invoice_id;

  insert into public.invoice_items (invoice_id, description, quantity, unit_price)
  select new_invoice_id, item->>'description', (item->>'quantity')::numeric,
         (item->>'unit_price')::numeric
  from jsonb_array_elements(p_items) item;
  return new_invoice_id;
end;
$$;

create or replace function public.create_project(
  p_client_id uuid,
  p_name text,
  p_status text,
  p_progress smallint,
  p_summary text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_project_id uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  insert into public.projects (client_id, name, status, progress, summary)
  values (p_client_id, p_name, p_status, p_progress, p_summary)
  returning id into new_project_id;
  return new_project_id;
end;
$$;

create or replace view public.invoice_summary
with (security_invoker = true)
as
select i.id, i.invoice_number, i.client_id, i.client_name, i.issue_date, i.due_date,
       i.status, i.currency, i.total,
       coalesce(sum(p.amount), 0)::numeric(12, 2) as paid_total
from public.invoices i
left join public.payments p on p.invoice_id = i.id
group by i.id;

create or replace view public.invoice_performance
with (security_invoker = true)
as
select s.currency,
       count(*)::integer as invoice_count,
       count(*) filter (where s.status = 'paid')::integer as paid_count,
       count(*) filter (where s.status in ('sent', 'partial', 'overdue'))::integer as outstanding_count,
       coalesce(sum(s.total) filter (where s.status <> 'cancelled'), 0)::numeric(14, 2) as billed_total,
       coalesce(sum(s.paid_total), 0)::numeric(14, 2) as collected_total,
       coalesce(sum(greatest(s.total - s.paid_total, 0)) filter (where s.status in ('sent', 'partial', 'overdue')), 0)::numeric(14, 2) as outstanding_total
from public.invoice_summary s
where public.is_admin()
group by s.currency;

alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.pin_credentials enable row level security;
alter table public.pin_login_attempts enable row level security;
alter table public.services enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.projects enable row level security;
alter table public.project_updates enable row level security;
alter table public.shared_resources enable row level security;

create policy "Users read their own profile or admins read all"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());
create policy "Admins manage client records"
  on public.clients for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Clients read their own client record"
  on public.clients for select to authenticated
  using (id = (select public.client_scope()));
create policy "Authenticated users read active services"
  on public.services for select to authenticated using (active or public.is_admin());
create policy "Admins manage services"
  on public.services for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins or owners read invoices"
  on public.invoices for select to authenticated
  using (public.is_admin() or client_id = (select public.client_scope()));
create policy "Admins manage invoices"
  on public.invoices for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins or owners read invoice lines"
  on public.invoice_items for select to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.invoices i
      where i.id = invoice_id and i.client_id = (select public.client_scope())
    )
  );
create policy "Admins manage invoice lines"
  on public.invoice_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins or owners read payments"
  on public.payments for select to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.invoices i
      where i.id = invoice_id and i.client_id = (select public.client_scope())
    )
  );
create policy "Admins manage payments"
  on public.payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins or owners read projects"
  on public.projects for select to authenticated
  using (public.is_admin() or client_id = (select public.client_scope()));
create policy "Admins manage projects"
  on public.projects for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins update projects"
  on public.projects for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins or owners read project updates"
  on public.project_updates for select to authenticated
  using (public.is_admin() or client_id = (select public.client_scope()));
create policy "Admins publish project updates"
  on public.project_updates for insert to authenticated
  with check (public.is_admin() and created_by = (select auth.uid()));
create policy "Admins or owners read shared resources"
  on public.shared_resources for select to authenticated
  using (public.is_admin() or client_id = (select public.client_scope()));
create policy "Admins publish shared resources"
  on public.shared_resources for insert to authenticated
  with check (public.is_admin() and created_by = (select auth.uid()));

revoke all on public.pin_credentials, public.pin_login_attempts from anon, authenticated;
grant select, insert, update, delete on public.clients, public.profiles, public.services,
  public.invoices, public.invoice_items, public.payments, public.projects,
  public.project_updates, public.shared_resources to authenticated;
grant all on public.clients, public.profiles, public.pin_credentials, public.pin_login_attempts,
  public.services, public.invoices, public.invoice_items, public.payments, public.projects,
  public.project_updates, public.shared_resources to service_role;
grant usage on schema public to authenticated, service_role;
grant usage, select on sequence public.invoice_number_seq, public.receipt_number_seq to service_role;
revoke all on function public.pin_account_for_login(text) from public, anon, authenticated;
revoke all on function public.is_pin_login_blocked(text) from public, anon, authenticated;
revoke all on function public.record_pin_login_failure(text) from public, anon, authenticated;
revoke all on function public.clear_pin_login_failures(text) from public, anon, authenticated;
revoke all on function public.provision_pin_account(uuid, text, public.account_role, text, text, text, uuid, jsonb) from public, anon;
revoke all on function public.change_pin(uuid, text, text) from public, anon;
revoke all on function public.record_payment(uuid, numeric, text, text, text) from public, anon;
revoke all on function public.create_invoice(uuid, date, date, text, numeric, text, text, jsonb) from public, anon;
revoke all on function public.create_project(uuid, text, text, smallint, text) from public, anon;
grant execute on function public.pin_account_for_login(text) to service_role;
grant execute on function public.is_pin_login_blocked(text) to service_role;
grant execute on function public.record_pin_login_failure(text) to service_role;
grant execute on function public.clear_pin_login_failures(text) to service_role;
grant execute on function public.provision_pin_account(uuid, text, public.account_role, text, text, text, uuid, jsonb) to authenticated, service_role;
grant execute on function public.change_pin(uuid, text, text) to authenticated, service_role;
grant execute on function public.record_payment(uuid, numeric, text, text, text) to authenticated;
grant execute on function public.create_invoice(uuid, date, date, text, numeric, text, text, jsonb) to authenticated;
grant execute on function public.create_project(uuid, text, text, smallint, text) to authenticated;
grant select on public.invoice_summary, public.invoice_performance to authenticated;
