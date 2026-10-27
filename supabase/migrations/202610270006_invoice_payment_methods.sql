alter table public.invoice_settings
  add column payment_methods jsonb not null default '[]'::jsonb;

update public.invoice_settings
set payment_methods = '[
  {"name":"Bank transfer","instructions":"","active":true},
  {"name":"PayPal","instructions":"","active":true},
  {"name":"EcoCash","instructions":"","active":true},
  {"name":"InnBucks","instructions":"","active":true},
  {"name":"Other","instructions":"","active":true}
]'::jsonb;

update public.invoice_settings
set payment_methods = jsonb_set(
  payment_methods,
  '{0,instructions}',
  to_jsonb(payment_details)
)
where payment_details <> '';

alter table public.invoice_settings
  add constraint invoice_settings_payment_methods_array
  check (jsonb_typeof(payment_methods) = 'array');

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
      'special_notes', settings.special_notes,
      'payment_methods', coalesce((
        select jsonb_agg(method.value)
        from jsonb_array_elements(settings.payment_methods) as method(value)
        where method.value->>'active' = 'true'
      ), '[]'::jsonb)
    )
  )
  from public.invoices i
  cross join public.invoice_settings settings
  where i.share_token = p_share_token
  limit 1;
$$;

revoke all on function public.get_public_invoice(uuid) from public;
grant execute on function public.get_public_invoice(uuid) to anon, authenticated;
