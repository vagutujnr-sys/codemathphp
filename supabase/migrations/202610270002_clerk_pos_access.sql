alter table public.profiles
  drop constraint if exists client_role_has_client;
alter table public.profiles
  add constraint staff_or_client_profile_has_client check (
    role::text in ('admin', 'clerk') or client_id is not null
  );

create or replace function public.is_invoice_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role::text in ('admin', 'clerk')
      and active
  );
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
  where p.active
    and p.role::text in ('admin', 'clerk', 'client')
    and c.pin_hash = extensions.crypt(p_pin, c.pin_hash)
  limit 1;
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
  if not public.is_invoice_staff() then raise exception 'Invoice staff access required'; end if;
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
  if not public.is_invoice_staff() then raise exception 'Invoice staff access required'; end if;
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

create policy "Invoice staff read clients"
  on public.clients for select to authenticated
  using (public.is_invoice_staff());
create policy "Invoice staff read invoices"
  on public.invoices for select to authenticated
  using (public.is_invoice_staff());
create policy "Invoice staff read invoice lines"
  on public.invoice_items for select to authenticated
  using (public.is_invoice_staff());
create policy "Invoice staff read payments"
  on public.payments for select to authenticated
  using (public.is_invoice_staff());

revoke all on function public.pin_account_for_login(text) from public, anon, authenticated;
grant execute on function public.pin_account_for_login(text) to service_role;
revoke all on function public.record_payment(uuid, numeric, text, text, text) from public, anon;
grant execute on function public.record_payment(uuid, numeric, text, text, text) to authenticated;
revoke all on function public.create_invoice(uuid, date, date, text, numeric, text, text, jsonb) from public, anon;
grant execute on function public.create_invoice(uuid, date, date, text, numeric, text, text, jsonb) to authenticated;
