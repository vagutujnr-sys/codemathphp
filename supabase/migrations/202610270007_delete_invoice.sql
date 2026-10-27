create or replace function public.delete_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  delete from public.payments
  where invoice_id = p_invoice_id;

  delete from public.invoice_items
  where invoice_id = p_invoice_id;

  delete from public.invoices
  where id = p_invoice_id;

  if not found then
    raise exception 'Invoice does not exist';
  end if;
end;
$$;

revoke all on function public.delete_invoice(uuid) from public, anon;
grant execute on function public.delete_invoice(uuid) to authenticated;
