import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Client Portal | CodeMath" },
      {
        name: "description",
        content: "Access the CodeMath client workspace with your six-digit PIN.",
      },
    ],
  }),
  component: () => <Navigate to="/invoicing" />,
});
