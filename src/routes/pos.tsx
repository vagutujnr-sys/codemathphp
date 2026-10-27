import { createFileRoute } from "@tanstack/react-router";

import { InvoicingApp } from "./invoicing";

export const Route = createFileRoute("/pos")({
  head: () => ({
    meta: [
      { title: "Point of Sale | CodeMath" },
      { name: "description", content: "CodeMath staff invoicing point of sale." },
    ],
  }),
  component: PointOfSaleRoute,
});

function PointOfSaleRoute() {
  return <InvoicingApp entryMode="pos" />;
}
