create table public.invoice_settings (
  id boolean primary key default true check (id),
  business_name text not null default 'CodeMath',
  payment_details text not null default '',
  special_notes text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.invoice_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.invoice_settings enable row level security;

create policy "Admins manage invoice settings"
  on public.invoice_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Authenticated users read invoice settings"
  on public.invoice_settings for select to authenticated
  using (true);

grant select, insert, update on public.invoice_settings to authenticated;

create or replace view public.invoice_summary
with (security_invoker = true)
as
select i.id, i.invoice_number, i.client_id, i.client_name, i.issue_date, i.due_date,
       i.status, i.currency, i.total,
       coalesce(sum(p.amount), 0)::numeric(12, 2) as paid_total,
       i.share_token,
       i.client_email,
       i.client_phone,
       i.notes,
       i.payment_method
from public.invoices i
left join public.payments p on p.invoice_id = i.id
group by i.id;

create or replace function public.get_public_invoice(p_share_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'invoice', jsonb_build_object(
      'invoice_number', i.invoice_number,
      'client_name', i.client_name,
      'client_email', i.client_email,
      'client_phone', i.client_phone,
      'issue_date', i.issue_date,
      'due_date', i.due_date,
      'status', i.status,
      'currency', i.currency,
      'total', i.total,
      'paid_total', coalesce((select sum(p.amount) from public.payments p where p.invoice_id = i.id), 0),
      'notes', i.notes,
      'payment_method', i.payment_method
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', item.description,
        'quantity', item.quantity,
        'unit_price', item.unit_price,
        'line_total', item.line_total
      ) order by item.id)
      from public.invoice_items item
      where item.invoice_id = i.id
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'receipt_number', payment.receipt_number,
        'amount', payment.amount,
        'currency', payment.currency,
        'method', payment.method,
        'received_at', payment.received_at
      ) order by payment.received_at, payment.id)
      from public.payments payment
      where payment.invoice_id = i.id
    ), '[]'::jsonb),
    'settings', jsonb_build_object(
      'business_name', settings.business_name,
      'payment_details', settings.payment_details,
      'special_notes', settings.special_notes
    )
  )
  from public.invoices i
  cross join public.invoice_settings settings
  where i.share_token = p_share_token
  limit 1;
$$;

revoke all on function public.get_public_invoice(uuid) from public;
grant execute on function public.get_public_invoice(uuid) to anon, authenticated;
