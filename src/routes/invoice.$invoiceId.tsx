import { createFileRoute } from "@tanstack/react-router";

import { InvoiceDetailPage } from "./invoicing";

export const Route = createFileRoute("/invoice/$invoiceId")({
  head: () => ({
    meta: [{ title: "Invoice | CodeMath" }],
  }),
  component: InvoiceRoute,
});

function InvoiceRoute() {
  const { invoiceId } = Route.useParams();
  return <InvoiceDetailPage invoiceId={invoiceId} />;
}
