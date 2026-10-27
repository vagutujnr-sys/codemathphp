alter table public.invoices
  alter column status set default 'pending';

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

create or replace view public.invoice_performance
with (security_invoker = true)
as
select s.currency,
       count(*)::integer as invoice_count,
       count(*) filter (where s.status = 'paid')::integer as paid_count,
       count(*) filter (where s.status in ('pending', 'sent', 'partial', 'overdue'))::integer as outstanding_count,
       coalesce(sum(s.total) filter (where s.status <> 'cancelled'), 0)::numeric(14, 2) as billed_total,
       coalesce(sum(s.paid_total), 0)::numeric(14, 2) as collected_total,
       coalesce(sum(greatest(s.total - s.paid_total, 0)) filter (
         where s.status in ('pending', 'sent', 'partial', 'overdue')
       ), 0)::numeric(14, 2) as outstanding_total
from public.invoice_summary s
where public.is_admin()
group by s.currency;
