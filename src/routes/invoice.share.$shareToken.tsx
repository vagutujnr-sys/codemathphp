import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import logo from "@/assets/codemath-logo.png";
import { api, type PublicInvoiceData } from "@/lib/invoicing-api";

export const Route = createFileRoute("/invoice/share/$shareToken")({
  head: () => ({
    meta: [{ title: "Shared invoice | CodeMath" }],
  }),
  component: SharedInvoiceRoute,
});

function SharedInvoiceRoute() {
  const { shareToken } = Route.useParams();
  const [data, setData] = useState<PublicInvoiceData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .publicInvoice(shareToken)
      .then(setData)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load this invoice.");
      });
  }, [shareToken]);

  if (!data && !error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 text-sm text-muted-foreground">
        Loading shared invoice…
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p role="alert" className="border-l-4 border-destructive bg-destructive/10 p-4 text-sm">
          {error}
        </p>
      </main>
    );
  }

  const { invoice, items, payments, settings } = data;
  const selectedPaymentMethod = settings.payment_methods.find(
    (method) => method.name.trim().toLowerCase() === invoice.payment_method?.trim().toLowerCase(),
  );
  const money = (amount: number) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: invoice.currency,
      maximumFractionDigits: 2,
    }).format(amount);

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-8 text-foreground sm:px-8 print:bg-white print:p-0">
      <article className="mx-auto max-w-4xl border border-border bg-card p-5 shadow-card sm:p-8 print:border-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-5">
          <div>
            <img src={logo} alt="CodeMath" className="mb-4 h-14 w-auto object-contain" />
            <p className="font-display text-lg font-bold text-secondary">
              {settings.business_name}
            </p>
            <h1 className="mt-4 font-display text-2xl font-bold text-secondary">
              {invoice.invoice_number}
            </h1>
            <section className="mt-1 text-sm">
              <h2 className="font-semibold text-secondary">Bill to</h2>
              <p className="text-muted-foreground">{invoice.client_name}</p>
              {invoice.client_email && (
                <p className="text-muted-foreground">{invoice.client_email}</p>
              )}
              {invoice.client_phone && (
                <p className="text-muted-foreground">{invoice.client_phone}</p>
              )}
            </section>
          </div>
          <div className="text-sm sm:text-right">
            <p>
              <span className="font-semibold">Issue date:</span> {invoice.issue_date}
            </p>
            {invoice.due_date && (
              <p>
                <span className="font-semibold">Due date:</span> {invoice.due_date}
              </p>
            )}
            <p className="mt-2 capitalize text-muted-foreground">{invoice.status}</p>
            <button
              type="button"
              onClick={() => window.print()}
              className="mt-3 border border-border px-3 py-2 font-semibold print:hidden"
            >
              Print / Save PDF
            </button>
          </div>
        </header>
        <section className="mt-5 border-l-4 border-primary bg-accent px-4 py-4 text-sm text-accent-foreground">
          By asking the right questions and getting into the very core of your brands personality,
          we perform the research necessary to establish the design style that best suites your
          brand. We also keep you up to date with industry trends so that your websites remain
          effective, functional, fresh and relevant. Our project portfolio spans many
          sectors.Welcome to our family.
        </section>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2">Description</th>
                <th className="px-2">Qty</th>
                <th className="px-2">Unit price</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.description}-${index}`} className="border-b border-border">
                  <td className="py-3">{item.description}</td>
                  <td className="px-2">{item.quantity}</td>
                  <td className="px-2">{money(item.unit_price)}</td>
                  <td className="text-right">{money(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td colSpan={3} className="py-4 text-right">
                  Total
                </td>
                <td className="text-right">{money(invoice.total)}</td>
              </tr>
              <tr className="text-muted-foreground">
                <td colSpan={3} className="py-1 text-right">
                  Amount paid
                </td>
                <td className="text-right">{money(invoice.paid_total)}</td>
              </tr>
              <tr className="font-bold text-secondary">
                <td colSpan={3} className="py-1 text-right">
                  Balance due
                </td>
                <td className="text-right">
                  {money(Math.max(invoice.total - invoice.paid_total, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {invoice.notes && (
          <section className="mt-5 border-t border-border pt-4">
            <h2 className="font-semibold text-secondary">Invoice notes</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {invoice.notes}
            </p>
          </section>
        )}
        {payments.length > 0 && (
          <section className="mt-5 border-t border-border pt-4">
            <h2 className="font-semibold text-secondary">Payments received</h2>
            <ul className="mt-2 divide-y divide-border">
              {payments.map((payment) => (
                <li
                  key={payment.receipt_number}
                  className="flex flex-wrap justify-between gap-2 py-2 text-sm"
                >
                  <span>
                    {payment.receipt_number} · {payment.received_at.slice(0, 10)} · {payment.method}
                  </span>
                  <span className="font-semibold">{money(payment.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {(invoice.payment_method || settings.special_notes) && (
          <div className="mt-6 grid grid-cols-1 gap-4 text-left md:grid-cols-2">
            {invoice.payment_method && (
              <section className="border-t border-border pt-4 text-left">
                <h2 className="font-semibold text-secondary">
                  {invoice.payment_method} payment instructions
                </h2>
                {selectedPaymentMethod?.instructions && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {selectedPaymentMethod.instructions}
                  </p>
                )}
              </section>
            )}
            {settings.special_notes && (
              <section className="border-t border-border pt-4 text-left">
                <h2 className="font-semibold text-secondary">Important information</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {settings.special_notes}
                </p>
              </section>
            )}
          </div>
        )}
      </article>
    </main>
  );
}
