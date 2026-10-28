import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Maximize2,
  MessageCircle,
  MessagesSquare,
  Minimize2,
  Plus,
  ReceiptText,
  Search,
  Share2,
  SlidersHorizontal,
  ShoppingCart,
  Trash2,
  Users,
  UserRound,
  X,
} from "lucide-react";
import logo from "@/assets/codemath-logo.png";
import { ClientChat } from "@/components/ClientChat";
import { NotificationPermissionButton } from "@/components/NotificationPermissionButton";
import {
  browserNotificationsSupported,
  showBrowserNotification,
} from "@/lib/invoicing-notifications";
import {
  api,
  currentSession,
  getCurrentUser,
  loginWithPin,
  logout,
  type Client,
  type Invoice,
  type InvoiceItem,
  type InvoiceSettings,
  type InvoicingUser,
  type Payment,
  type Performance,
  type Project,
  type ProjectUpdate,
  type Service,
  type SharedResource,
} from "@/lib/invoicing-api";

export const Route = createFileRoute("/invoicing")({
  head: () => ({
    meta: [
      { title: "Invoicing & Client Area | CodeMath" },
      { name: "description", content: "Secure CodeMath invoicing and client dashboard." },
    ],
  }),
  component: InvoicingApp,
});

type Tab =
  "overview" | "invoices" | "clients" | "workspace" | "chat" | "profile" | "staff" | "settings";
type InvoiceDraftItem = {
  description: string;
  quantity: string;
  unit_price: string;
  service_id: string;
};

const money = (amount: number, currency = "USD") =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.trim(),
    maximumFractionDigits: 2,
  }).format(amount);

function publicInvoiceUrl(invoice: Invoice) {
  return `${window.location.origin}/invoice/share/${invoice.share_token}`;
}

function recordPaymentMethods(
  configuredMethods: InvoiceSettings["payment_methods"] | undefined,
  preferredMethod: string | null,
) {
  const methods = (configuredMethods ?? [])
    .filter((method) => method.active)
    .map((method) => method.name.trim())
    .filter(Boolean);
  if (preferredMethod?.trim()) methods.push(preferredMethod.trim());
  methods.push("Cash");
  return [...new Map(methods.map((method) => [method.toLowerCase(), method])).values()];
}

function defaultRecordPaymentMethod(methods: string[], preferredMethod: string | null) {
  return (
    methods.find((method) => method.toLowerCase() === preferredMethod?.trim().toLowerCase()) ??
    methods.find((method) => method.toLowerCase() === "cash") ??
    methods[0] ??
    "Cash"
  );
}

async function shareInvoice(invoice: Invoice) {
  const url = publicInvoiceUrl(invoice);
  if (navigator.share) {
    await navigator.share({
      title: `Invoice ${invoice.invoice_number}`,
      text: `Invoice for ${invoice.client_name}`,
      url,
    });
    return "Invoice link shared.";
  }
  try {
    await navigator.clipboard.writeText(url);
    return "Public invoice link copied to clipboard.";
  } catch {
    const copied = window.prompt("Copy this public invoice link:", url);
    if (copied === null) throw new Error("Invoice sharing was cancelled.");
    return "Public invoice link is ready to share.";
  }
}

async function shareReceipt(receipt: Payment, invoice: Invoice) {
  const text = [
    `CodeMath payment receipt ${receipt.receipt_number}`,
    `Received from: ${invoice.client_name}`,
    `Invoice: ${invoice.invoice_number}`,
    `Date: ${receipt.received_at.slice(0, 10)}`,
    `Payment method: ${receipt.method}`,
    `Amount received: ${money(receipt.amount, receipt.currency)}`,
    ...(receipt.reference ? [`Reference: ${receipt.reference}`] : []),
  ].join("\n");
  if (navigator.share) {
    await navigator.share({ title: `Receipt ${receipt.receipt_number}`, text });
    return "Receipt shared.";
  }
  try {
    await navigator.clipboard.writeText(text);
    return "Receipt details copied to clipboard.";
  } catch {
    const copied = window.prompt("Copy these receipt details to share:", text);
    if (copied === null) throw new Error("Receipt sharing was cancelled.");
    return "Receipt details are ready to share.";
  }
}

function currencyTotals<T extends { currency: string }>(rows: T[], getAmount: (row: T) => number) {
  const totals = new Map<string, number>();
  for (const row of rows)
    totals.set(row.currency.trim(), (totals.get(row.currency.trim()) ?? 0) + getAmount(row));
  return (
    [...totals.entries()]
      .filter(([, amount]) => amount !== 0)
      .map(([currency, amount]) => money(amount, currency))
      .join(" · ") || "—"
  );
}

export function InvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  const [account, setAccount] = useState<InvoicingUser | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentTarget, setPaymentTarget] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [receipt, setReceipt] = useState<Payment | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [data, currentUser, invoiceSettings] = await Promise.all([
        api.invoiceDetails(invoiceId),
        getCurrentUser(),
        api.invoiceSettings(),
      ]);
      setInvoice(data.invoice);
      setItems(data.items);
      setPayments(data.payments);
      setAccount(currentUser);
      setSettings(invoiceSettings);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load invoice.");
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!account || !browserNotificationsSupported()) return;
    return api.subscribeToActivity(
      account,
      (activity) => showBrowserNotification(activity.title, activity.body),
      setError,
    );
  }, [account]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading invoice…
      </div>
    );
  }
  if (!invoice || !account) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p
          role="alert"
          className="border-l-4 border-destructive bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error || "Invoice unavailable."}
        </p>
        <a href="/invoicing" className="mt-4 inline-block text-sm font-semibold text-primary">
          Back to workspace
        </a>
      </main>
    );
  }
  const canRecordPayment = account.role === "admin" || account.role === "clerk";
  const isAdministrator = account.role === "admin";
  const backPath = account.role === "clerk" ? "/pos" : "/invoicing";
  const selectedPaymentMethod = settings?.payment_methods.find(
    (method) => method.name.trim().toLowerCase() === invoice.payment_method?.trim().toLowerCase(),
  );
  const paymentMethods = recordPaymentMethods(settings?.payment_methods, invoice.payment_method);

  async function changeInvoiceStatus(status: Invoice["status"]) {
    setError("");
    try {
      await api.updateInvoiceStatus(invoice.id, status);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update invoice status.");
    }
  }

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-6 text-foreground sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-3 print:hidden">
          <a href={backPath} className="text-sm font-semibold text-primary hover:underline">
            ← Back to {account.role === "clerk" ? "point of sale" : "workspace"}
          </a>
          <NotificationPermissionButton iconOnly />
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 border-l-4 border-destructive bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <article className="mt-5 border border-border bg-card p-5 shadow-card sm:p-8">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
            <div>
              <img src={logo} alt="CodeMath" className="mb-4 h-12 w-auto object-contain" />
              <p className="font-display font-bold text-secondary">
                {settings?.business_name ?? "CodeMath"}
              </p>
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
                Invoice
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold text-secondary">
                {invoice.invoice_number}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {invoice.client_name} · Issued {invoice.issue_date}
              </p>
              {invoice.due_date && (
                <p className="text-sm text-muted-foreground">Due {invoice.due_date}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={invoice.status} />
              {canRecordPayment && (
                <button
                  onClick={() =>
                    void shareInvoice(invoice)
                      .then((message) => showBrowserNotification("Invoice link ready", message))
                      .catch((cause: unknown) =>
                        setError(
                          cause instanceof Error ? cause.message : "Unable to share invoice link.",
                        ),
                      )
                  }
                  className="border border-border px-3 py-2 text-sm font-semibold"
                >
                  <span className="inline-flex items-center gap-1">
                    <Share2 className="h-4 w-4" /> Share
                  </span>
                </button>
              )}
              <button
                onClick={() => window.print()}
                className="border border-border px-3 py-2 text-sm font-semibold print:hidden"
              >
                Print / Save PDF
              </button>
              <a
                href={publicInvoiceUrl(invoice)}
                target="_blank"
                rel="noreferrer"
                className="border border-border px-3 py-2 text-sm font-semibold print:hidden"
              >
                Public link
              </a>
            </div>
          </header>
          <section className="mt-4 border-t border-border pt-4 text-sm">
            <h2 className="font-semibold text-secondary">Bill to</h2>
            <p className="text-muted-foreground">{invoice.client_name}</p>
            {invoice.client_email && (
              <p className="text-muted-foreground">{invoice.client_email}</p>
            )}
            {invoice.client_phone && (
              <p className="text-muted-foreground">{invoice.client_phone}</p>
            )}
          </section>
          <section className="mt-4 border-l-4 border-primary bg-accent px-4 py-4 text-sm text-accent-foreground">
            By asking the right questions and getting into the very core of your brands personality,
            we perform the research necessary to establish the design style that best suites your
            brand. We also keep you up to date with industry trends so that your websites remain
            effective, functional, fresh and relevant. Our project portfolio spans many
            sectors.Welcome to our family.
          </section>
          {invoice.notes && (
            <section className="mt-4 border-t border-border pt-4">
              <h2 className="font-semibold text-secondary">Invoice notes</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {invoice.notes}
              </p>
            </section>
          )}
          {settings?.special_notes && (
            <section className="mt-4 border-t border-border pt-4">
              <h2 className="font-semibold text-secondary">Important information</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {settings.special_notes}
              </p>
            </section>
          )}
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2">Description</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="py-3">{item.description}</td>
                    <td>{item.quantity}</td>
                    <td>{money(item.unit_price, invoice.currency)}</td>
                    <td className="text-right">{money(item.line_total, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td colSpan={3} className="py-4 text-right">
                    Total
                  </td>
                  <td className="text-right">{money(invoice.total, invoice.currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Paid {money(invoice.paid_total, invoice.currency)} · Balance{" "}
              {money(Math.max(invoice.total - invoice.paid_total, 0), invoice.currency)}
            </p>
            <div className="flex flex-wrap gap-2">
              {isAdministrator && invoice.status !== "paid" && invoice.status !== "cancelled" && (
                <select
                  aria-label="Change invoice status"
                  value={invoice.status}
                  onChange={(event) =>
                    void changeInvoiceStatus(event.target.value as Invoice["status"])
                  }
                  className="h-9 border border-input bg-background px-3 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="sent">Sent</option>
                  <option value="overdue">Overdue</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              )}
              {canRecordPayment && invoice.status !== "paid" && invoice.status !== "cancelled" && (
                <button
                  onClick={() => {
                    setPaymentAmount(String(Math.max(invoice.total - invoice.paid_total, 0)));
                    setPaymentMethod(
                      defaultRecordPaymentMethod(paymentMethods, invoice.payment_method),
                    );
                    setPaymentTarget(true);
                  }}
                  className="bg-gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                >
                  Record payment
                </button>
              )}
            </div>
          </div>
          {payments.length > 0 && (
            <section className="mt-6 border-t border-border pt-4">
              <h2 className="font-display font-bold text-secondary">Payments & receipts</h2>
              <div className="mt-2 divide-y divide-border">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                  >
                    <div>
                      <p>
                        <strong>{payment.receipt_number}</strong> ·{" "}
                        {payment.received_at.slice(0, 10)} · {payment.method}
                      </p>
                      <p className="font-semibold">{money(payment.amount, payment.currency)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReceipt(payment)}
                      className="self-center border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                    >
                      View receipt
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
          {(invoice.payment_method || settings?.special_notes) && (
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
              {settings?.special_notes && (
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
      </div>
      {paymentTarget && (
        <PaymentDialog
          invoice={invoice}
          amount={paymentAmount}
          method={paymentMethod}
          paymentMethods={paymentMethods}
          reference={paymentReference}
          onAmount={setPaymentAmount}
          onMethod={setPaymentMethod}
          onReference={setPaymentReference}
          onCancel={() => setPaymentTarget(false)}
          onComplete={async (payment) => {
            await refresh();
            setPaymentTarget(false);
            setReceipt(payment);
          }}
          setError={setError}
        />
      )}
      <ReceiptPrint
        receipt={receipt}
        invoice={invoice}
        onClose={() => setReceipt(null)}
        onShare={() => {
          if (!receipt) return;
          void shareReceipt(receipt, invoice)
            .then((message) => showBrowserNotification("Receipt ready", message))
            .catch((cause: unknown) => {
              if (cause instanceof DOMException && cause.name === "AbortError") return;
              setError(cause instanceof Error ? cause.message : "Unable to share receipt.");
            });
        }}
      />
    </main>
  );
}

export function InvoicingApp({ entryMode = "dashboard" }: { entryMode?: "dashboard" | "pos" }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<InvoicingUser | null>(null);
  const [pin, setPin] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [savedSessionNeedsRetry, setSavedSessionNeedsRetry] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setNotice = useCallback((message: string) => {
    showBrowserNotification("CodeMath", message);
  }, []);
  const [tab, setTab] = useState<Tab>("overview");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [invoiceDrawerOpen, setInvoiceDrawerOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [resources, setResources] = useState<SharedResource[]>([]);
  const [performance, setPerformance] = useState<Performance[]>([]);
  const [services, setServices] = useState<Awaited<ReturnType<typeof api.services>>>([]);
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings | null>(null);
  const [newClientPin, setNewClientPin] = useState("");
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentReference, setPaymentReference] = useState("");

  const loadData = useCallback(async (account: InvoicingUser) => {
    setLoading(true);
    setError("");
    try {
      const [clientRows, invoiceRows, projectRows, updateRows, resourceRows, settings] =
        await Promise.all([
          api.clients(),
          api.invoices(),
          api.projects(),
          api.updates(),
          api.resources(),
          api.invoiceSettings(),
        ]);
      setClients(clientRows);
      setInvoices(invoiceRows);
      setProjects(projectRows);
      setUpdates(
        await Promise.all(
          updateRows.map(async (update) => ({
            ...update,
            screenshot_urls: await Promise.all(
              update.screenshot_paths.map((path) => api.projectUpdateImageUrl(path)),
            ),
          })),
        ),
      );
      setResources(resourceRows);
      setInvoiceSettings(settings);
      if (account.role === "admin" || account.role === "clerk") {
        const [performanceRows, serviceRows] = await Promise.all([
          account.role === "admin" ? api.performance() : Promise.resolve([]),
          api.services(),
        ]);
        setPerformance(performanceRows);
        setServices(serviceRows);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load invoicing data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    logout();
    setUser(null);
    setSavedSessionNeedsRetry(false);
    setClients([]);
    setInvoices([]);
    setProjects([]);
    setUpdates([]);
    setResources([]);
    setPerformance([]);
    setTab("overview");
    setError("");
  }, []);

  useEffect(() => {
    if (!user || !browserNotificationsSupported()) return;
    return api.subscribeToActivity(
      user,
      (activity) => showBrowserNotification(activity.title, activity.body),
      setError,
    );
  }, [user]);

  useEffect(() => {
    const session = currentSession();
    if (!session) {
      setCheckingSession(false);
      return;
    }
    setSavedSessionNeedsRetry(true);
    getCurrentUser()
      .then((account) => {
        setUser(account);
        setSavedSessionNeedsRetry(false);
        void loadData(account);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to validate your session.");
      })
      .finally(() => setCheckingSession(false));
  }, [loadData]);

  useEffect(() => {
    const handleSessionEnded = () => signOut();
    window.addEventListener("codemath-session-ended", handleSessionEnded);
    return () => window.removeEventListener("codemath-session-ended", handleSessionEnded);
  }, [signOut]);

  useEffect(() => {
    if (user?.role === "clerk" && entryMode !== "pos") {
      void navigate({ to: "/pos", replace: true });
    } else if (user?.role === "client" && entryMode === "pos") {
      void navigate({ to: "/invoicing", replace: true });
    }
  }, [entryMode, navigate, user]);

  useEffect(() => {
    function updateFullscreenState() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  async function toggleFullscreen() {
    setError("");
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        if (!document.fullscreenEnabled) {
          throw new Error(
            "Fullscreen is unavailable on this connection. Use F11 on this computer or access the POS over HTTPS.",
          );
        }
        await document.documentElement.requestFullscreen();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to change fullscreen mode.");
    }
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginWithPin(pin);
      const account = await getCurrentUser();
      setUser(account);
      setSavedSessionNeedsRetry(false);
      setPin("");
      await loadData(account);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
    } finally {
      setLoading(false);
      setCheckingSession(false);
    }
  }

  async function retrySavedSession() {
    setError("");
    setCheckingSession(true);
    try {
      const account = await getCurrentUser();
      setUser(account);
      setSavedSessionNeedsRetry(false);
      await loadData(account);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to restore your saved session.");
    } finally {
      setCheckingSession(false);
    }
  }

  async function copyInvoiceLink(invoice: Invoice) {
    try {
      setNotice(await shareInvoice(invoice));
      setError("");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Unable to share invoice link.");
    }
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading secure workspace…
      </div>
    );
  }
  if (!user) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-warm opacity-70"
        />
        <section className="relative w-full max-w-md border border-border border-t-4 border-t-primary bg-card p-5 shadow-card sm:p-6">
          <a href="/" className="font-display text-xl font-extrabold tracking-tight text-secondary">
            CodeMath
          </a>
          <p className="mt-5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Secure workspace
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold text-secondary">
            {entryMode === "pos" ? "Staff Point of Sale" : "Invoicing & Client Area"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {entryMode === "pos"
              ? "Sign in with your staff PIN to create invoices."
              : "Administrators manage the business. Clients can view their own workspace, invoices and receipts."}
          </p>
          {savedSessionNeedsRetry ? (
            <div className="mt-5 space-y-3">
              <p className="text-sm text-muted-foreground">
                Your saved sign-in is still on this device, but we couldn’t reconnect to Supabase.
                Check your connection and try again.
              </p>
              {error && (
                <p
                  role="alert"
                  className="border-l-4 border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <button
                type="button"
                disabled={checkingSession}
                onClick={() => void retrySavedSession()}
                className="flex h-10 w-full items-center justify-center rounded-sm bg-gradient-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                Try reconnecting
              </button>
              <button
                type="button"
                onClick={signOut}
                className="w-full text-sm font-semibold text-muted-foreground hover:underline"
              >
                Sign out and use another account
              </button>
            </div>
          ) : !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY ? (
            <div className="mt-6 border-l-4 border-primary bg-accent px-4 py-3 text-sm text-accent-foreground">
              Supabase is not configured yet. Add <code>VITE_SUPABASE_URL</code> and{" "}
              <code>VITE_SUPABASE_ANON_KEY</code>, then apply the invoicing migration and deploy its
              Edge Functions.
            </div>
          ) : (
            <form onSubmit={submitLogin} className="mt-5 space-y-3">
              <label className="block text-sm font-semibold text-secondary" htmlFor="pin">
                {entryMode === "pos" ? "Staff PIN" : "Your six-digit PIN"}
                <input
                  id="pin"
                  aria-label="Six-digit PIN"
                  autoComplete="current-password"
                  className="mt-1.5 h-9 w-full rounded-sm border border-input bg-background px-3 text-center font-mono text-lg tracking-[0.4em] text-secondary outline-none focus:ring-2 focus:ring-ring"
                  inputMode="numeric"
                  maxLength={6}
                  minLength={6}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  pattern="\d{6}"
                  required
                  type="password"
                  value={pin}
                />
              </label>
              {error && (
                <p
                  role="alert"
                  className="border-l-4 border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <button
                disabled={loading}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-sm bg-gradient-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {loading
                  ? "Signing in…"
                  : entryMode === "pos"
                    ? "Open point of sale"
                    : "Access workspace"}{" "}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </button>
              <p className="text-center text-xs text-muted-foreground">
                PINs are permanent, unique six-digit identifiers. Contact your CodeMath
                administrator if you need access.
              </p>
            </form>
          )}
          {error && !import.meta.env.VITE_SUPABASE_URL && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          )}
          <a
            href="/"
            className="mt-6 inline-block text-sm font-semibold text-primary hover:underline"
          >
            ← Back to CodeMath
          </a>
          {entryMode === "pos" ? (
            <a
              href="/invoicing"
              className="mt-3 block text-xs text-muted-foreground hover:underline"
            >
              Administrator sign-in
            </a>
          ) : (
            <a href="/pos" className="mt-3 block text-xs text-muted-foreground hover:underline">
              Staff point-of-sale sign-in
            </a>
          )}
        </section>
      </main>
    );
  }

  const isAdmin = user.role === "admin";
  const isClerk = user.role === "clerk";
  if (entryMode === "dashboard" && isClerk) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Opening point of sale…
      </div>
    );
  }
  if (entryMode === "pos" && (isAdmin || isClerk)) {
    return (
      <main className="fixed inset-0 z-30 flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="CodeMath" className="h-8 w-auto object-contain" />
            <span className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Point of sale
            </span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationPermissionButton iconOnly />
            {entryMode === "pos" && (
              <button
                onClick={() => setInvoiceDrawerOpen(true)}
                className="inline-flex items-center gap-2 border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
              >
                <ReceiptText className="h-4 w-4" />
                <span className="hidden sm:inline">Invoices</span>
                <span className="rounded-full bg-accent px-1.5 text-xs">{invoices.length}</span>
              </button>
            )}
            <button
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              onClick={() => void toggleFullscreen()}
              className="inline-flex items-center gap-1.5 p-1 text-xs font-semibold text-muted-foreground hover:text-secondary"
            >
              {isFullscreen ? (
                <Minimize2 aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Maximize2 aria-hidden="true" className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              </span>
            </button>
            {isAdmin ? (
              <button
                aria-label="Return to dashboard"
                title="Return to dashboard"
                onClick={() => void navigate({ to: "/invoicing" })}
                className="p-1 text-muted-foreground hover:text-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                aria-label="Sign out"
                title="Sign out"
                onClick={signOut}
                className="p-1 text-muted-foreground hover:text-secondary"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-5">
          {error && (
            <p
              role="alert"
              className="mb-3 shrink-0 border-l-4 border-destructive bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <CreateInvoiceForm
            clients={clients}
            services={services}
            paymentMethods={
              invoiceSettings?.payment_methods.filter((method) => method.active) ?? []
            }
            onCreated={() => {
              setNotice("Invoice created.");
              void loadData(user);
            }}
            setError={setError}
          />
        </div>
        {invoiceDrawerOpen && (
          <InvoicesDrawer
            invoices={invoices}
            onClose={() => setInvoiceDrawerOpen(false)}
            onShare={(invoice) => void copyInvoiceLink(invoice)}
            onOpen={(invoice) => {
              setInvoiceDrawerOpen(false);
              void navigate({
                to: "/invoice/$invoiceId",
                params: { invoiceId: invoice.id },
              });
            }}
          />
        )}
      </main>
    );
  }
  if (tab === "chat" && (user.role === "admin" || user.role === "client")) {
    return <ClientChat clients={clients} user={user} onBack={() => setTab("overview")} />;
  }
  const menu: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = isAdmin
    ? [
        { id: "overview", label: "Overview", icon: LayoutDashboard },
        { id: "invoices", label: "Invoices", icon: ReceiptText },
        { id: "clients", label: "Clients & services", icon: Users },
        { id: "workspace", label: "Client dashboards", icon: FolderKanban },
        { id: "chat", label: "Client chat", icon: MessagesSquare },
        { id: "profile", label: "Profile", icon: UserRound },
        { id: "staff", label: "Staff access", icon: Users },
        { id: "settings", label: "Invoice settings", icon: SlidersHorizontal },
      ]
    : [
        { id: "overview", label: "My workspace", icon: LayoutDashboard },
        { id: "invoices", label: "Invoices & receipts", icon: ReceiptText },
        { id: "workspace", label: "Projects & shared files", icon: FolderKanban },
        { id: "chat", label: "Chat", icon: MessageCircle },
        { id: "profile", label: "Profile", icon: UserRound },
      ];

  return (
    <div className="min-h-screen bg-muted/50 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div
          className={`mx-auto flex items-center justify-between gap-4 px-4 py-3 sm:px-6 ${
            user.role === "client" ? "w-full lg:max-w-7xl" : "max-w-7xl"
          }`}
        >
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="CodeMath"
              className={`w-auto object-contain ${user.role === "client" ? "h-12 sm:h-14" : "h-10"}`}
            />
            <div className={user.role === "client" ? "hidden" : ""}>
              <p className="text-xs capitalize text-muted-foreground">{user.role} area</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-semibold text-secondary sm:block">
              {user.display_name}
            </span>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>
      {user.role === "client" && (
        <section
          aria-label="Client account summary"
          className="bg-primary px-4 py-3 text-primary-foreground lg:hidden"
        >
          <p className="mx-auto w-fit rounded-full bg-secondary px-6 py-2 text-center font-display text-lg font-semibold text-secondary-foreground">
            {user.display_name}
          </p>
          <div className="mt-3 flex items-center justify-center gap-3 text-sm font-medium">
            {[
              { label: "Projects", count: projects.length, tab: "workspace" as const },
              { label: "Updates", count: updates.length, tab: "workspace" as const },
              { label: "Invoices", count: invoices.length, tab: "invoices" as const },
            ].map(({ label, count, tab: targetTab }) => (
              <button
                key={label}
                type="button"
                onClick={() => setTab(targetTab)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-secondary px-2 text-xs font-bold text-secondary-foreground">
                  {count}
                </span>
                {label}
              </button>
            ))}
          </div>
        </section>
      )}
      <div
        className={`mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr] ${
          user.role === "client"
            ? "w-full gap-0 px-0 py-0 pb-24 sm:px-0 lg:gap-6 lg:px-6 lg:py-6"
            : ""
        }`}
      >
        <nav
          aria-label="Workspace"
          className={
            user.role === "client"
              ? "hidden gap-2 lg:flex lg:flex-col"
              : "flex gap-2 overflow-x-auto lg:flex-col"
          }
        >
          {menu.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                setError("");
              }}
              className={`flex shrink-0 items-center gap-3 border px-4 py-3 text-left text-sm font-semibold transition-colors lg:w-full ${tab === id ? "border-primary bg-accent text-accent-foreground" : "border-transparent bg-card text-muted-foreground hover:border-border hover:text-secondary"}`}
            >
              <Icon aria-hidden="true" className="h-4 w-4" /> {label}
            </button>
          ))}
          {isAdmin && (
            <button
              onClick={() => void navigate({ to: "/pos" })}
              className="flex shrink-0 items-center gap-3 border border-primary bg-primary px-4 py-3 text-left text-sm font-semibold text-primary-foreground lg:w-full"
            >
              <ShoppingCart aria-hidden="true" className="h-4 w-4" /> Open POS
            </button>
          )}
          <button
            onClick={() => void loadData(user)}
            className="hidden items-center gap-2 border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground hover:text-secondary lg:flex"
          >
            <Activity className="h-4 w-4" /> Refresh data
          </button>
        </nav>
        <main className={`min-w-0 ${user.role === "client" ? "w-full" : ""}`}>
          <div
            className={`mb-5 flex flex-wrap items-end justify-between gap-3 ${
              user.role === "client" ? "hidden lg:flex" : ""
            }`}
          >
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {isAdmin ? "Administration" : "Client portal"}
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold text-secondary">
                {tabTitle(tab, isAdmin)}
              </h1>
            </div>
            {loading && <span className="text-sm text-muted-foreground">Syncing…</span>}
          </div>
          <div className={`mb-4 flex justify-end ${user.role === "client" ? "hidden lg:flex" : ""}`}>
            <NotificationPermissionButton />
          </div>
          {error && (
            <p
              role="alert"
              className="mb-4 border-l-4 border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {tab === "overview" &&
            (isAdmin ? (
              <AdminOverview
                performance={performance}
                clients={clients}
                invoices={invoices}
                projects={projects}
                onNavigate={setTab}
              />
            ) : (
              <ClientOverview
                user={user}
                invoices={invoices}
                projects={projects}
                updates={updates}
                resources={resources}
                onNavigate={setTab}
              />
            ))}
          {tab === "invoices" && (
            <InvoicesPanel
              isAdmin={isAdmin}
              isClerk={isClerk}
              invoices={invoices}
              onSelectInvoice={(invoice) => {
                void navigate({
                  to: "/invoice/$invoiceId",
                  params: { invoiceId: invoice.id },
                });
              }}
              onShare={(invoice) => void copyInvoiceLink(invoice)}
              onDelete={
                isAdmin
                  ? async (invoice) => {
                      const confirmed = window.confirm(
                        `Delete invoice ${invoice.invoice_number} for ${invoice.client_name}? Its line items and payment receipts will also be deleted. This cannot be undone.`,
                      );
                      if (!confirmed) return;
                      setError("");
                      try {
                        await api.deleteInvoice(invoice.id);
                        setNotice(`Invoice ${invoice.invoice_number} deleted.`);
                        await loadData(user);
                      } catch (cause) {
                        setError(
                          cause instanceof Error ? cause.message : "Unable to delete invoice.",
                        );
                      }
                    }
                  : undefined
              }
              onAddPayment={(invoice) => {
                setPaymentInvoice(invoice);
                setPaymentAmount(String(Math.max(invoice.total - invoice.paid_total, 0)));
                setPaymentMethod(
                  defaultRecordPaymentMethod(
                    recordPaymentMethods(invoiceSettings?.payment_methods, invoice.payment_method),
                    invoice.payment_method,
                  ),
                );
              }}
            />
          )}
          {tab === "settings" && isAdmin && invoiceSettings && (
            <InvoiceSettingsPanel
              settings={invoiceSettings}
              onSaved={(updated) => {
                setInvoiceSettings(updated);
                setNotice("Invoice settings saved.");
              }}
              setError={setError}
            />
          )}
          {tab === "clients" && isAdmin && (
            <ClientsPanel
              clients={clients}
              services={services}
              onRefresh={() => void loadData(user)}
              onCreated={(generatedPin) => {
                setNewClientPin(generatedPin);
                void loadData(user);
              }}
              newClientPin={newClientPin}
              onDismissPin={() => setNewClientPin("")}
              setError={setError}
            />
          )}
          {tab === "staff" && isAdmin && (
            <StaffAccessPanel setError={setError} setNotice={setNotice} />
          )}
          {tab === "workspace" &&
            (isAdmin ? (
              <AdminWorkspace
                clients={clients}
                projects={projects}
                updates={updates}
                resources={resources}
                onRefresh={() => void loadData(user)}
                setError={setError}
                setNotice={setNotice}
              />
            ) : (
              <ClientWorkspace projects={projects} updates={updates} resources={resources} />
            ))}
          {tab === "profile" && <ProfilePanel clients={clients} user={user} />}
          {paymentInvoice && (
            <PaymentDialog
              invoice={paymentInvoice}
              amount={paymentAmount}
              method={paymentMethod}
              paymentMethods={recordPaymentMethods(
                invoiceSettings?.payment_methods,
                paymentInvoice.payment_method,
              )}
              reference={paymentReference}
              onAmount={setPaymentAmount}
              onMethod={setPaymentMethod}
              onReference={setPaymentReference}
              onCancel={() => setPaymentInvoice(null)}
              onComplete={async () => {
                await loadData(user);
                setPaymentInvoice(null);
                setNotice("Payment recorded.");
              }}
              setError={setError}
            />
          )}
        </main>
      </div>
      {user.role === "client" && (
        <nav
          aria-label="Client navigation"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden"
        >
          <div className="mx-auto flex w-full max-w-lg items-center justify-around">
            {menu.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-label={label}
                aria-current={tab === id ? "page" : undefined}
                title={label}
                onClick={() => {
                  setTab(id);
                  setError("");
                }}
                className={`flex h-14 w-14 items-center justify-center rounded-xl transition-colors ${
                  tab === id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-secondary"
                }`}
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

function tabTitle(tab: Tab, admin: boolean) {
  if (tab === "overview") return admin ? "Business overview" : "Your workspace";
  if (tab === "invoices") return admin ? "Invoices" : "Invoices & receipts";
  if (tab === "chat") return admin ? "Client chat" : "Chat with CodeMath";
  if (tab === "profile") return "Your profile";
  if (tab === "clients") return "Clients & service catalogue";
  if (tab === "staff") return "Staff access";
  if (tab === "settings") return "Invoice settings";
  return admin ? "Manage client dashboards" : "Projects & shared files";
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="border border-border bg-card p-5 shadow-card">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold text-secondary">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function AdminOverview({
  performance,
  clients,
  invoices,
  projects,
  onNavigate,
}: {
  performance: Performance[];
  clients: Client[];
  invoices: Invoice[];
  projects: Project[];
  onNavigate: (tab: Tab) => void;
}) {
  const pending = invoices.filter((invoice) =>
    ["pending", "sent", "partial", "overdue"].includes(invoice.status),
  );
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const rows = invoices.filter(
      (invoice) => invoice.issue_date.startsWith(key) && invoice.status !== "cancelled",
    );
    return {
      key,
      label: date.toLocaleDateString("en", { month: "short" }),
      billed: rows.length,
      paid: rows.filter((invoice) => invoice.status === "paid").length,
    };
  });
  const monthlyMax = Math.max(...monthly.map((month) => month.billed), 1);
  const totalInvoices = performance.reduce((sum, row) => sum + row.invoice_count, 0);
  const paidInvoices = performance.reduce((sum, row) => sum + row.paid_count, 0);
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Invoices issued"
          value={String(totalInvoices)}
          detail={`${paidInvoices} paid`}
        />
        <StatCard
          label="Billed"
          value={currencyTotals(performance, (row) => row.billed_total)}
          detail="Excludes cancelled invoices"
        />
        <StatCard
          label="Collected"
          value={currencyTotals(performance, (row) => row.collected_total)}
          detail="Payments recorded"
        />
        <StatCard
          label="Outstanding"
          value={currencyTotals(performance, (row) => row.outstanding_total)}
          detail={`${performance.reduce((sum, row) => sum + row.outstanding_count, 0)} invoices awaiting payment`}
        />
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display font-bold text-secondary">Invoice activity</h2>
            <span className="text-xs text-muted-foreground">Last 6 months · invoice count</span>
          </div>
          <div className="grid h-40 grid-cols-6 items-end gap-3 border-b border-border px-2 pb-2">
            {monthly.map((month) => (
              <div key={month.key} className="flex h-full flex-col items-center justify-end gap-2">
                <div className="flex h-28 w-full items-end justify-center gap-1">
                  <div
                    title={`${month.billed} invoices`}
                    className="w-3 rounded-t bg-primary"
                    style={{
                      height: `${Math.max((month.billed / monthlyMax) * 100, month.billed ? 5 : 0)}%`,
                    }}
                  />
                  <div
                    title={`${month.paid} paid`}
                    className="w-3 rounded-t bg-chart-3"
                    style={{
                      height: `${Math.max((month.paid / monthlyMax) * 100, month.paid ? 5 : 0)}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{month.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span>
              <i className="mr-1 inline-block h-2 w-2 bg-primary" />
              Issued
            </span>
            <span>
              <i className="mr-1 inline-block h-2 w-2 bg-chart-3" />
              Paid
            </span>
          </div>
        </div>
        <div className="space-y-6">
          <div className="border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display font-bold text-secondary">Recent invoices</h2>
              <button
                onClick={() => onNavigate("invoices")}
                className="text-sm font-semibold text-primary hover:underline"
              >
                View all
              </button>
            </div>
            {invoices.length ? (
              <div className="space-y-3">
                {invoices.slice(0, 5).map((invoice) => (
                  <button
                    key={invoice.id}
                    onClick={() => onNavigate("invoices")}
                    className="flex w-full items-center justify-between gap-3 border-b border-border pb-2 text-left text-sm last:border-0"
                  >
                    <span>
                      <strong className="text-secondary">{invoice.invoice_number}</strong>
                      <span className="ml-2 text-muted-foreground">{invoice.client_name}</span>
                    </span>
                    <span className="whitespace-nowrap">
                      {money(invoice.total, invoice.currency)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState text="No invoices have been created yet." />
            )}
          </div>
          <div className="border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display font-bold text-secondary">Clients</h2>
              <button
                onClick={() => onNavigate("clients")}
                className="text-sm font-semibold text-primary hover:underline"
              >
                Manage
              </button>
            </div>
            <p className="font-display text-3xl font-bold text-secondary">{clients.length}</p>
            <p className="text-sm text-muted-foreground">Client accounts</p>
            <div className="mt-4 space-y-2">
              {clients.slice(0, 4).map((client) => (
                <div
                  key={client.id}
                  className="flex justify-between gap-3 border-t border-border pt-2 text-sm"
                >
                  <span className="truncate font-medium">{client.name}</span>
                  <span className="text-muted-foreground">
                    {invoices.filter((item) => item.client_id === client.id).length} invoices
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-border bg-card p-5">
            <h2 className="font-display font-bold text-secondary">Active client projects</h2>
            <p className="mt-2 font-display text-3xl font-bold text-secondary">{projects.length}</p>
            <p className="text-sm text-muted-foreground">Projects visible in client dashboards</p>
            {pending.length > 0 && (
              <p className="mt-4 border-l-4 border-primary bg-accent px-3 py-2 text-sm text-accent-foreground">
                {pending.length} invoice{pending.length === 1 ? "" : "s"} awaiting payment.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function ClientOverview({
  user,
  invoices,
  projects,
  updates,
  resources,
  onNavigate,
}: {
  user: InvoicingUser;
  invoices: Invoice[];
  projects: Project[];
  updates: ProjectUpdate[];
  resources: SharedResource[];
  onNavigate: (tab: Tab) => void;
}) {
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const openInvoices = invoices.filter((invoice) =>
    ["pending", "sent", "partial", "overdue"].includes(invoice.status),
  );
  const outstanding = currencyTotals(openInvoices, (invoice) =>
    Math.max(invoice.total - invoice.paid_total, 0),
  );
  return (
    <div>
      <div className="space-y-0 lg:hidden">
        <section className="border-b border-border bg-muted px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-secondary">My Projects</h2>
            <button
              type="button"
              onClick={() => onNavigate("workspace")}
              className="text-sm font-semibold text-primary"
            >
              View all
            </button>
          </div>
        </section>
        {projects.length ? (
          <section aria-label="My projects" className="space-y-0">
            {projects.map((project) => {
              const projectUpdates = updates.filter((update) => update.project_id === project.id);
              const expanded = expandedProject === project.id;
              return (
                <article
                  key={project.id}
                  className="border-b border-border bg-card px-5 py-5"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
                    <h3 className="font-display text-lg font-bold leading-tight text-secondary">
                      {project.name}
                    </h3>
                    <span className="row-span-3 font-display text-4xl font-extrabold tabular-nums text-primary">
                      {project.progress}%
                    </span>
                    <p className="text-sm capitalize text-muted-foreground">
                      {project.status.replaceAll("_", " ")}
                    </p>
                    <div className="col-start-1 mt-1 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.min(Math.max(project.progress, 0), 100)}%` }}
                      />
                    </div>
                    <p className="col-start-1 mt-1 text-sm font-semibold text-secondary">
                      {projectUpdates.length} update{projectUpdates.length === 1 ? "" : "s"} shared
                    </p>
                    <p className="col-start-2 row-start-4 text-right text-xs text-muted-foreground">
                      Updated {project.updated_at.slice(0, 10)}
                    </p>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setExpandedProject(expanded ? null : project.id)}
                      className="col-start-1 mt-3 w-fit rounded-full border border-primary bg-gradient-primary px-5 py-2 text-xs font-semibold text-primary-foreground"
                    >
                      {expanded ? "Show Less" : "Expand To View"}
                    </button>
                  </div>
                  {expanded && (
                    <div className="mt-4 border-t border-border pt-4">
                      {project.summary && (
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {project.summary}
                        </p>
                      )}
                      {projectUpdates.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {projectUpdates.map((update) => (
                            <li key={update.id} className="text-sm">
                              <p className="font-semibold text-secondary">{update.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {update.created_at.slice(0, 10)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        ) : (
          <div className="bg-card px-5 py-8 text-sm text-muted-foreground">
            There are no projects in this workspace yet.
          </div>
        )}
        <section className="bg-muted px-5 pb-24 pt-6">
          <h2 className="font-display text-xl font-bold text-secondary">Completed Milestones</h2>
          <p className="text-sm text-secondary">Project Updates In Pictures</p>
          {updates.some((update) => update.screenshot_urls?.length) ? (
            <div className="mt-5 grid grid-cols-2 gap-3">
              {updates.flatMap((update) =>
                (update.screenshot_urls ?? []).map((url, index) => (
                  <a
                    key={`${update.id}-${index}`}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden border border-border bg-card"
                  >
                    <img
                      src={url}
                      alt={`${update.title} progress update`}
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                    <span className="block truncate px-2 py-2 text-xs font-semibold text-secondary">
                      {update.title}
                    </span>
                  </a>
                )),
              )}
            </div>
          ) : (
            <div className="flex min-h-[300px] items-center justify-center text-center text-sm text-secondary">
              No Visual Updates Available
            </div>
          )}
        </section>
      </div>
      <div className="hidden space-y-6 lg:block">
        <section className="flex flex-wrap items-center gap-x-6 gap-y-2 border border-border bg-card px-4 py-3 text-sm">
          <p className="font-semibold text-secondary">Welcome, {user.display_name}</p>
          <span className="text-muted-foreground">{projects.length} projects</span>
          <span className="text-muted-foreground">
            {invoices.length} invoices ·{" "}
            {invoices.filter((invoice) => invoice.status === "paid").length} paid
          </span>
          <span className="text-muted-foreground">Outstanding: {outstanding}</span>
        </section>
        <section className="grid gap-6 xl:grid-cols-2">
          <div className="border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display font-bold text-secondary">Your projects</h2>
              <button
                onClick={() => onNavigate("workspace")}
                className="text-sm font-semibold text-primary"
              >
                Open workspace
              </button>
            </div>
            <ProjectCards projects={projects.slice(0, 3)} />
          </div>
          <div className="border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display font-bold text-secondary">Latest updates</h2>
              <button
                onClick={() => onNavigate("workspace")}
                className="text-sm font-semibold text-primary"
              >
                View all
              </button>
            </div>
            <UpdateList updates={updates.slice(0, 3)} projects={projects} />
          </div>
        </section>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onNavigate("invoices")}
            className="inline-flex items-center gap-2 bg-gradient-primary px-4 py-3 text-sm font-bold text-primary-foreground"
          >
            <FileText className="h-4 w-4" /> View invoices and receipts
          </button>
          <button
            onClick={() => onNavigate("workspace")}
            className="inline-flex items-center gap-2 border border-border bg-card px-4 py-3 text-sm font-bold text-secondary"
          >
            <ArrowDownToLine className="h-4 w-4" /> {resources.length} shared resource
            {resources.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InvoicesDrawer({
  invoices,
  onClose,
  onOpen,
  onShare,
}: {
  invoices: Invoice[];
  onClose: () => void;
  onOpen: (invoice: Invoice) => void;
  onShare: (invoice: Invoice) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-secondary/40" onMouseDown={onClose}>
      <aside
        aria-label="Generated invoices"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-card shadow-elegant"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="font-display text-lg font-bold text-secondary">Generated invoices</h2>
            <p className="text-xs text-muted-foreground">{invoices.length} invoices</p>
          </div>
          <button
            type="button"
            aria-label="Close invoices"
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {invoices.length ? (
            invoices.map((invoice) => (
              <article key={invoice.id} className="border border-border p-3">
                <button
                  type="button"
                  onClick={() => onOpen(invoice)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <span>
                    <strong className="block text-sm text-secondary">
                      {invoice.invoice_number}
                    </strong>
                    <span className="text-xs text-muted-foreground">{invoice.client_name}</span>
                  </span>
                  <span className="whitespace-nowrap text-sm font-bold text-secondary">
                    {money(invoice.total, invoice.currency)}
                  </span>
                </button>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <StatusBadge status={invoice.status} />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onShare(invoice)}
                      className="inline-flex items-center gap-1 border border-border px-2 py-1.5 text-xs font-semibold"
                    >
                      <Share2 className="h-3.5 w-3.5" /> Share
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpen(invoice)}
                      className="inline-flex items-center gap-1 border border-border px-2 py-1.5 text-xs font-semibold"
                    >
                      <FileText className="h-3.5 w-3.5" /> PDF / print
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <EmptyState text="Invoices created in the POS will appear here." />
          )}
        </div>
      </aside>
    </div>
  );
}

function InvoiceSettingsPanel({
  settings,
  onSaved,
  setError,
}: {
  settings: InvoiceSettings;
  onSaved: (settings: InvoiceSettings) => void;
  setError: (message: string) => void;
}) {
  const [businessName, setBusinessName] = useState(settings.business_name);
  const [paymentMethods, setPaymentMethods] = useState(settings.payment_methods);
  const [specialNotes, setSpecialNotes] = useState(settings.special_notes);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const methodNames = paymentMethods.map((method) => method.name.trim().toLowerCase());
    if (methodNames.some((name) => !name)) {
      setError("Enter a name for every payment method.");
      return;
    }
    if (new Set(methodNames).size !== methodNames.length) {
      setError("Each payment method must have a unique name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const rows = await api.updateInvoiceSettings({
        business_name: businessName.trim(),
        payment_methods: paymentMethods.map((method) => ({
          ...method,
          name: method.name.trim(),
          instructions: method.instructions.trim(),
        })),
        special_notes: specialNotes.trim(),
      });
      if (!rows[0]) throw new Error("Invoice settings were not returned after saving.");
      onSaved(rows[0]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save invoice settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-border bg-card p-5 shadow-card">
      <div className="mb-5">
        <h2 className="font-display text-lg font-bold text-secondary">Invoice details</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These details appear on every invoice, including public share links and printed PDFs.
        </p>
      </div>
      <form onSubmit={submit} className="max-w-3xl space-y-4">
        <Field
          label="Business name"
          name="business_name"
          value={businessName}
          onChange={setBusinessName}
          required
        />
        <fieldset className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <legend className="text-sm font-semibold text-secondary">Payment methods</legend>
            <button
              type="button"
              onClick={() =>
                setPaymentMethods((current) => [
                  ...current,
                  { name: "", instructions: "", active: true },
                ])
              }
              className="inline-flex items-center gap-1 border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" /> Add payment method
            </button>
          </div>
          {paymentMethods.map((method, index) => (
            <div key={index} className="grid gap-3 border border-border p-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-secondary">
                Method name
                <input
                  required
                  value={method.name}
                  onChange={(event) =>
                    setPaymentMethods((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, name: event.target.value } : row,
                      ),
                    )
                  }
                  placeholder="e.g. Bank transfer"
                  className="mt-1.5 h-9 w-full border border-input bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-secondary">
                <input
                  type="checkbox"
                  checked={method.active}
                  onChange={(event) =>
                    setPaymentMethods((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, active: event.target.checked } : row,
                      ),
                    )
                  }
                  className="accent-primary"
                />
                Available in POS
              </label>
              <label className="block text-sm font-semibold text-secondary sm:col-span-2">
                Payment instructions / details
                <textarea
                  value={method.instructions}
                  onChange={(event) =>
                    setPaymentMethods((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, instructions: event.target.value } : row,
                      ),
                    )
                  }
                  rows={3}
                  placeholder="Account details, number, or instructions for this method…"
                  className="mt-1.5 w-full border border-input bg-background p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>
          ))}
          {!paymentMethods.length && (
            <p className="text-sm text-muted-foreground">
              No methods configured. Add a method to make it available in the POS.
            </p>
          )}
        </fieldset>
        <label className="block text-sm font-semibold text-secondary">
          Special notes
          <textarea
            value={specialNotes}
            onChange={(event) => setSpecialNotes(event.target.value)}
            rows={4}
            placeholder="Terms, payment due instructions, or other information for clients…"
            className="mt-1.5 w-full border border-input bg-background p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !businessName.trim()}
          className="bg-gradient-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save invoice details"}
        </button>
      </form>
    </section>
  );
}

function InvoiceTable({
  invoices,
  onSelect,
  onView,
  onShare,
  onAddPayment,
  onDelete,
}: {
  invoices: Invoice[];
  onSelect: (invoice: Invoice) => void;
  onView?: (invoice: Invoice) => void;
  onShare?: (invoice: Invoice) => void;
  onAddPayment?: (invoice: Invoice) => void;
  onDelete?: (invoice: Invoice) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-3 pr-3">Invoice</th>
            <th className="py-3 pr-3">Client</th>
            <th className="py-3 pr-3">Date</th>
            <th className="py-3 pr-3">Amount</th>
            <th className="py-3">Status</th>
            {(onView || onShare || onAddPayment || onDelete) && (
              <th className="py-3 text-right">Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr
              key={invoice.id}
              className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
              onClick={() => onSelect(invoice)}
            >
              <td className="py-3 pr-3 font-semibold text-secondary">{invoice.invoice_number}</td>
              <td className="py-3 pr-3">{invoice.client_name}</td>
              <td className="py-3 pr-3 whitespace-nowrap">{invoice.issue_date}</td>
              <td className="py-3 pr-3 whitespace-nowrap">
                {money(invoice.total, invoice.currency)}
              </td>
              <td className="py-3">
                <StatusBadge status={invoice.status} />
              </td>
              {(onView || onShare || onAddPayment || onDelete) && (
                <td className="py-2 text-right" onClick={(event) => event.stopPropagation()}>
                  <div className="inline-flex flex-wrap justify-end gap-2">
                    {onView && (
                      <button
                        type="button"
                        onClick={() => onView(invoice)}
                        className="border border-border px-2 py-1 text-xs font-semibold hover:bg-muted"
                      >
                        View
                      </button>
                    )}
                    {onAddPayment &&
                      invoice.status !== "paid" &&
                      invoice.status !== "cancelled" && (
                        <button
                          type="button"
                          onClick={() => onAddPayment(invoice)}
                          className="border border-border px-2 py-1 text-xs font-semibold hover:bg-muted"
                        >
                          Add payment
                        </button>
                      )}
                    {onShare && (
                      <button
                        type="button"
                        onClick={() => onShare(invoice)}
                        className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs font-semibold hover:bg-muted"
                      >
                        <Share2 className="h-3.5 w-3.5" /> Share
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(invoice)}
                        aria-label={`Delete invoice ${invoice.invoice_number}`}
                        className="inline-flex items-center gap-1 border border-destructive/40 px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "paid"
      ? "bg-chart-3/15 text-chart-3"
      : status === "overdue"
        ? "bg-destructive/10 text-destructive"
        : "bg-accent text-accent-foreground";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${style}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-secondary/50 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="my-auto max-h-[90vh] w-full max-w-xl overflow-y-auto border border-border bg-card p-5 shadow-elegant"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-secondary">{title}</h2>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ClientsPanel({
  clients,
  services,
  newClientPin,
  onCreated,
  onDismissPin,
  onRefresh,
  setError,
}: {
  clients: Client[];
  services: Service[];
  newClientPin: string;
  onCreated: (pin: string) => void;
  onDismissPin: () => void;
  onRefresh: () => void;
  setError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editingClient, setEditingClient] = useState<string | null>(null);
  const [resettingPinClient, setResettingPinClient] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      const pin = await api.provisionClient(
        {
          name: String(form.get("name") ?? "").trim(),
          email: String(form.get("email") ?? "").trim() || null,
          phone: String(form.get("phone") ?? "").trim() || null,
          company: String(form.get("company") ?? "").trim() || null,
        },
        String(form.get("pin") ?? ""),
      );
      formElement.reset();
      setShowCreate(false);
      onCreated(pin);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create the client account.");
    } finally {
      setBusy(false);
    }
  }
  async function updateClient(event: FormEvent<HTMLFormElement>, clientId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api.updateClient(clientId, {
        name: String(form.get("name") ?? "").trim(),
        email: String(form.get("email") ?? "").trim() || null,
        phone: String(form.get("phone") ?? "").trim() || null,
        company: String(form.get("company") ?? "").trim() || null,
      });
      setEditingClient(null);
      setError("");
      onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update client information.");
    } finally {
      setBusy(false);
    }
  }
  async function resetPin(event: FormEvent<HTMLFormElement>, clientId: string) {
    event.preventDefault();
    if (
      !window.confirm("Replace this client's current PIN? The old PIN stops working immediately.")
    )
      return;
    const form = new FormData(event.currentTarget);
    const pin = String(form.get("pin") ?? "");
    setBusy(true);
    setError("");
    try {
      const updatedPin = await api.resetClientPin(clientId, pin);
      setResettingPinClient(null);
      onCreated(updatedPin);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to reset client PIN.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
      <section className="border border-border bg-card p-4">
        <h2 className="font-display text-lg font-bold text-secondary">
          Client directory{" "}
          <span className="font-sans text-sm font-medium text-muted-foreground">
            ({clients.length})
          </span>
        </h2>
        <div className="mt-4 divide-y divide-border">
          {clients.map((client) => (
            <article key={client.id} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-secondary">{client.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {client.company || "Individual client"}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    {client.email}
                    {client.phone && ` · ${client.phone}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingClient(client.id)}
                    className="border border-border px-3 py-2 text-xs font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setResettingPinClient(client.id)}
                    className="border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    Reset PIN
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!clients.length && <EmptyState text="No clients yet." />}
      </section>
      <section className="border border-border bg-card p-4">
        <h2 className="font-display text-lg font-bold text-secondary">Create client login</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Set a unique six-digit PIN to share securely with the client after creating their account.
        </p>
        {newClientPin && (
          <div className="my-4 border border-primary/30 bg-accent p-4">
            <p className="text-sm font-semibold">Share this PIN securely with the client:</p>
            <p className="my-2 font-mono text-3xl font-bold tracking-[0.3em] text-secondary">
              {newClientPin}
            </p>
            <p className="text-xs text-muted-foreground">
              It cannot be retrieved later. The admin can issue a replacement PIN if needed.
            </p>
            <button
              onClick={onDismissPin}
              className="mt-2 text-xs font-bold text-primary underline"
            >
              I have saved the PIN
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 bg-gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Create client
        </button>
      </section>
      <Modal open={showCreate} title="Create client login" onClose={() => setShowCreate(false)}>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Client name *" name="name" required />
          <Field label="Email" name="email" type="email" />
          <Field label="Phone" name="phone" type="tel" />
          <Field label="Company" name="company" />
          <label className="block text-sm font-semibold text-secondary">
            Client PIN *
            <input
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              autoComplete="new-password"
              required
              className="mt-1.5 h-9 w-full rounded-sm border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 bg-gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            <Plus className="h-4 w-4" /> {busy ? "Creating account…" : "Create client and PIN"}
          </button>
        </form>
      </Modal>
      {editingClient && (
        <Modal open title="Edit client" onClose={() => setEditingClient(null)}>
          {(() => {
            const client = clients.find((row) => row.id === editingClient);
            if (!client) return null;
            return (
              <form
                onSubmit={(event) => void updateClient(event, client.id)}
                className="grid gap-3 sm:grid-cols-2"
              >
                <Field label="Name" name="name" required value={client.name} />
                <Field label="Company" name="company" value={client.company ?? ""} />
                <Field label="Email" name="email" type="email" value={client.email ?? ""} />
                <Field label="Phone" name="phone" type="tel" value={client.phone ?? ""} />
                <div className="flex justify-end gap-2 sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => setEditingClient(null)}
                    className="border border-border px-3 py-2 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={busy}
                    className="bg-secondary px-3 py-2 text-sm font-bold text-secondary-foreground"
                  >
                    Save client
                  </button>
                </div>
              </form>
            );
          })()}
        </Modal>
      )}
      {resettingPinClient && (
        <Modal open title="Set client PIN" onClose={() => setResettingPinClient(null)}>
          <form
            onSubmit={(event) => void resetPin(event, resettingPinClient)}
            className="space-y-3"
          >
            <label className="block text-sm font-semibold text-secondary">
              New six-digit PIN
              <input
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                autoComplete="new-password"
                required
                className="mt-1.5 h-9 w-full rounded-sm border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResettingPinClient(null)}
                className="border border-border px-3 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                className="bg-secondary px-3 py-2 text-sm font-bold text-secondary-foreground"
              >
                Set PIN
              </button>
            </div>
          </form>
        </Modal>
      )}
      <div className="xl:col-span-2">
        <ServiceManager services={services} onRefresh={onRefresh} setError={setError} />
      </div>
    </div>
  );
}

function ServiceManager({
  services,
  onRefresh,
  setError,
}: {
  services: Service[];
  onRefresh: () => void;
  setError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  async function addService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      await api.createService({
        name: String(form.get("name") ?? "").trim(),
        description: String(form.get("description") ?? "").trim(),
        category: String(form.get("category") ?? "").trim(),
        unit_price: Number(form.get("unit_price")),
        currency: String(form.get("currency") ?? "USD"),
      });
      formElement.reset();
      setShowAdd(false);
      onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add service.");
    } finally {
      setBusy(false);
    }
  }
  async function toggleService(service: Service) {
    setBusy(true);
    setError("");
    try {
      await api.updateService(service.id, { active: !service.active });
      onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update service.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="border border-border bg-card p-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-secondary">Service catalogue</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="bg-secondary px-4 py-2 text-sm font-bold text-secondary-foreground"
          >
            Add service
          </button>
        </div>
        <div className="mt-3 divide-y divide-border">
          {services.map((service) => (
            <div
              key={service.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
            >
              <div>
                <p className="font-semibold text-secondary">
                  {service.name}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {money(service.unit_price, service.currency)}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {service.category || "Service"}
                  {service.description && ` · ${service.description}`}
                </p>
              </div>
              <button
                disabled={busy}
                onClick={() => void toggleService(service)}
                className="border border-border px-3 py-2 text-xs font-semibold"
              >
                {service.active ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
        </div>
        {!services.length && <EmptyState text="Add your services to make invoicing faster." />}
      </div>
      <Modal open={showAdd} title="Add service" onClose={() => setShowAdd(false)}>
        <form onSubmit={(event) => void addService(event)} className="space-y-3">
          <Field label="Name" name="name" required />
          <Field label="Description" name="description" />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Category" name="category" />
            <Field label="Price" name="unit_price" type="number" required />
          </div>
          <label className="block text-sm font-semibold">
            Currency
            <select
              name="currency"
              className="mt-1.5 h-9 w-full border border-input bg-background px-3 font-normal"
            >
              <option>USD</option>
              <option>ZAR</option>
              <option>EUR</option>
              <option>GBP</option>
            </select>
          </label>
          <button
            disabled={busy}
            className="w-full bg-secondary px-4 py-2 text-sm font-bold text-secondary-foreground"
          >
            Add service
          </button>
        </form>
      </Modal>
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-semibold text-secondary">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        value={onChange ? value : undefined}
        defaultValue={onChange ? undefined : value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        placeholder={placeholder}
        className="mt-1.5 h-9 w-full rounded-sm border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function InvoicesPanel(props: {
  isAdmin: boolean;
  isClerk: boolean;
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onShare: (invoice: Invoice) => void;
  onAddPayment: (invoice: Invoice) => void;
  onDelete?: (invoice: Invoice) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = props.invoices.filter((invoice) =>
    `${invoice.invoice_number} ${invoice.client_name} ${invoice.status}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-6">
      <section className="border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-secondary">
            {props.isAdmin || props.isClerk ? "All invoices" : "Your invoices"}
          </h2>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {(props.isAdmin || props.isClerk) && (
              <a
                href="/pos"
                className="inline-flex items-center gap-2 bg-gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              >
                <ShoppingCart className="h-4 w-4" /> Open POS
              </a>
            )}
            <input
              aria-label="Search invoices"
              placeholder="Search invoices…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 w-full max-w-xs border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        {filtered.length ? (
          <InvoiceTable
            invoices={filtered}
            onSelect={props.onSelectInvoice}
            onView={props.onSelectInvoice}
            onShare={props.isAdmin || props.isClerk ? props.onShare : undefined}
            onAddPayment={props.isAdmin || props.isClerk ? props.onAddPayment : undefined}
            onDelete={props.isAdmin ? props.onDelete : undefined}
            onDelete={props.isAdmin ? props.onDelete : undefined}
          />
        ) : (
          <EmptyState text="No matching invoices." />
        )}
      </section>
    </div>
  );
}

function CreateInvoiceForm({
  clients,
  services,
  paymentMethods,
  onCreated,
  setError,
}: {
  clients: Client[];
  services: Awaited<ReturnType<typeof api.services>>;
  paymentMethods: InvoiceSettings["payment_methods"];
  onCreated: () => void;
  setError: (message: string) => void;
}) {
  const [items, setItems] = useState<InvoiceDraftItem[]>([
    { description: "", quantity: "1", unit_price: "", service_id: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const activeServices = services.filter((service) => service.active);
  const categories = [
    "All",
    ...new Set(
      activeServices
        .map((service) => service.category)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const visibleServices = activeServices.filter((service) => {
    const matchesCategory = category === "All" || service.category === category;
    const matchesSearch = `${service.name} ${service.description ?? ""} ${service.category ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
        0,
      ),
    [items],
  );
  const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  function updateItem(index: number, key: keyof InvoiceDraftItem, value: string) {
    setItems((current) =>
      current.map((item, row) => (row === index ? { ...item, [key]: value } : item)),
    );
  }
  function addService(service: Service) {
    if (
      items.some((item) => item.description || item.unit_price) &&
      service.currency !== currency
    ) {
      setError(
        `This invoice uses ${currency}. Start a new invoice to add ${service.currency} services.`,
      );
      return;
    }
    setError("");
    setCurrency(service.currency);
    const description = service.description
      ? `${service.name} - ${service.description}`
      : service.name;
    setItems((current) => {
      const existingIndex = current.findIndex((item) => item.service_id === service.id);
      if (existingIndex !== -1) {
        return current.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: String(Number(item.quantity || 0) + 1) }
            : item,
        );
      }
      const next = [...current];
      const emptyIndex = next.findIndex((item) => !item.description && !item.unit_price);
      const newItem = {
        description,
        quantity: "1",
        unit_price: String(service.unit_price),
        service_id: service.id,
      };
      if (emptyIndex !== -1) next[emptyIndex] = newItem;
      else next.push(newItem);
      return next;
    });
  }
  function addCustomItem() {
    setItems((current) => [
      ...current,
      { description: "", quantity: "1", unit_price: "", service_id: "" },
    ]);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      const date = String(form.get("issue_date"));
      const exchangeRate = Number(form.get("exchange_rate"));
      if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
        throw new Error("Exchange rate must be greater than zero.");
      }
      await api.createInvoice({
        client_id: String(form.get("client_id")),
        issue_date: date,
        due_date: String(form.get("due_date") ?? "") || null,
        currency: String(form.get("currency")),
        exchange_rate: exchangeRate,
        payment_method: String(form.get("payment_method") ?? ""),
        notes: String(form.get("notes") ?? ""),
        items: items.map(({ description, quantity, unit_price }) => ({
          description: description.trim(),
          quantity: Number(quantity),
          unit_price: Number(unit_price),
        })),
      });
      formElement.reset();
      setItems([{ description: "", quantity: "1", unit_price: "", service_id: "" }]);
      setCurrency("USD");
      setSearch("");
      setCategory("All");
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create invoice.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden border border-border bg-card shadow-card">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            Service counter
          </p>
          <h2 className="font-display text-lg font-bold text-secondary">Create an invoice</h2>
        </div>
        <p className="text-xs text-muted-foreground">Choose a service to add it to the order</p>
      </header>
      {!clients.length ? (
        <p className="p-4 text-sm text-muted-foreground">
          Create a client account before creating an invoice.
        </p>
      ) : (
        <form
          onSubmit={submit}
          className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(17rem,21rem)] overflow-hidden"
        >
          <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto border-r border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-secondary">Services</h3>
                <p className="text-xs text-muted-foreground">
                  {visibleServices.length} {visibleServices.length === 1 ? "service" : "services"}
                </p>
              </div>
              <label className="relative block w-full sm:max-w-xs">
                <Search
                  aria-hidden="true"
                  className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                />
                <input
                  aria-label="Search services"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search services…"
                  className="h-9 w-full border border-input bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {categories.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setCategory(entry)}
                  className={`shrink-0 border px-3 py-1.5 text-xs font-semibold ${
                    category === entry
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-secondary"
                  }`}
                >
                  {entry}
                </button>
              ))}
            </div>
            {visibleServices.length ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {visibleServices.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => addService(service)}
                    className="group flex min-h-32 flex-col items-start justify-between border border-border bg-background p-3 text-left transition hover:border-primary hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span>
                      <span className="block line-clamp-2 font-semibold text-secondary">
                        {service.name}
                      </span>
                      {service.category && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {service.category}
                        </span>
                      )}
                    </span>
                    <span className="mt-3 flex w-full items-center justify-between gap-2">
                      <span className="text-sm font-bold text-secondary">
                        {money(service.unit_price, service.currency)}
                      </span>
                      <Plus aria-hidden="true" className="h-4 w-4 text-primary" />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                {activeServices.length
                  ? "No services match this search."
                  : "No active services. Add a custom line item from the order panel."}
              </div>
            )}
          </div>
          <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-muted/20">
            <div className="shrink-0 border-b border-border p-4">
              <div className="flex items-center justify-between">
                <h3 className="inline-flex items-center gap-2 font-display font-bold text-secondary">
                  <ShoppingCart aria-hidden="true" className="h-4 w-4 text-primary" />
                  Current order
                </h3>
                <span className="border border-primary/30 bg-accent px-2 py-1 text-xs font-semibold text-accent-foreground">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </span>
              </div>
              <label className="mt-3 block text-xs font-semibold text-secondary">
                Client
                <select
                  required
                  name="client_id"
                  className="mt-1 h-9 w-full border border-input bg-background px-2 text-sm font-normal"
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Field
                  label="Issue date"
                  name="issue_date"
                  type="date"
                  required
                  value={new Date().toISOString().slice(0, 10)}
                />
                <Field label="Due date" name="due_date" type="date" />
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Order items
                </span>
                <button
                  type="button"
                  onClick={addCustomItem}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  + Custom item
                </button>
              </div>
              {items.map((item, index) => (
                <div key={index} className="border border-border bg-card p-2.5">
                  <div className="flex items-start gap-2">
                    <input
                      aria-label="Item description"
                      required
                      value={item.description}
                      onChange={(event) => updateItem(index, "description", event.target.value)}
                      placeholder="Item description"
                      className="h-8 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm font-semibold outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      type="button"
                      aria-label="Remove item"
                      disabled={items.length === 1}
                      onClick={() =>
                        setItems((current) => current.filter((_, row) => row !== index))
                      }
                      className="px-1 text-lg leading-6 text-muted-foreground hover:text-destructive disabled:opacity-30"
                    >
                      ×
                    </button>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <label className="flex items-center border border-input">
                      <span className="sr-only">Quantity</span>
                      <input
                        aria-label="Quantity"
                        required
                        min="0.01"
                        step="0.01"
                        type="number"
                        value={item.quantity}
                        onChange={(event) => updateItem(index, "quantity", event.target.value)}
                        className="h-8 w-14 border-0 bg-background px-1 text-center text-xs outline-none focus:ring-1 focus:ring-ring"
                      />
                    </label>
                    <label className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                      <span>{currency}</span>
                      <input
                        aria-label="Unit price"
                        required
                        min="0"
                        step="0.01"
                        type="number"
                        value={item.unit_price}
                        onChange={(event) => updateItem(index, "unit_price", event.target.value)}
                        placeholder="Price"
                        className="h-8 w-24 border border-input bg-background px-2 text-right text-sm text-secondary outline-none focus:ring-1 focus:ring-ring"
                      />
                    </label>
                  </div>
                  <p className="mt-1 text-right text-xs font-semibold text-secondary">
                    {money(Number(item.quantity || 0) * Number(item.unit_price || 0), currency)}
                  </p>
                </div>
              ))}
              <details>
                <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                  More invoice details
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-2 pb-1">
                  <label className="block text-xs font-semibold">
                    Currency
                    <select
                      name="currency"
                      value={currency}
                      onChange={(event) => setCurrency(event.target.value)}
                      className="mt-1 h-9 w-full border border-input bg-background px-2 text-sm font-normal"
                    >
                      <option>USD</option>
                      <option>ZAR</option>
                      <option>EUR</option>
                      <option>GBP</option>
                      <option>ZWG</option>
                    </select>
                  </label>
                  <Field label="Exchange rate" name="exchange_rate" type="number" value="1" />
                  <label className="col-span-2 block text-xs font-semibold">
                    Payment method
                    <select
                      name="payment_method"
                      className="mt-1 h-9 w-full border border-input bg-background px-2 text-sm font-normal"
                    >
                      <option value="">Choose method</option>
                      {paymentMethods.map((method) => (
                        <option key={method.name} value={method.name}>
                          {method.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="col-span-2 block text-xs font-semibold">
                    Invoice notes
                    <textarea
                      name="notes"
                      rows={2}
                      className="mt-1 w-full border border-input bg-background p-2 text-sm font-normal"
                    />
                  </label>
                </div>
              </details>
            </div>
            <div className="shrink-0 border-t border-border bg-card p-3 sm:p-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-sm font-semibold text-muted-foreground">Invoice total</span>
                <span className="font-display text-lg font-bold text-secondary">
                  {money(subtotal, currency)}
                </span>
              </div>
              <button
                disabled={
                  busy ||
                  !items.some((item) => item.description.trim() && Number(item.unit_price) >= 0)
                }
                className="mt-2 w-full bg-gradient-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create invoice"}
              </button>
            </div>
          </aside>
        </form>
      )}
    </section>
  );
}

function PaymentDialog({
  invoice,
  amount,
  method,
  paymentMethods,
  reference,
  onAmount,
  onMethod,
  onReference,
  onCancel,
  onComplete,
  setError,
}: {
  invoice: Invoice;
  amount: string;
  method: string;
  paymentMethods: string[];
  reference: string;
  onAmount: (value: string) => void;
  onMethod: (value: string) => void;
  onReference: (value: string) => void;
  onCancel: () => void;
  onComplete: (payment: Payment) => void | Promise<void>;
  setError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const paymentAmount = Number(amount);
      const outstanding = Math.max(invoice.total - invoice.paid_total, 0);
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        throw new Error("Enter a payment amount greater than zero.");
      }
      if (paymentAmount > outstanding) {
        throw new Error("Payment cannot exceed the outstanding balance.");
      }
      const payment = await api.recordPayment({
        invoice_id: invoice.id,
        amount: paymentAmount,
        method,
        reference,
      });
      await onComplete(payment);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to record payment.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-secondary/50 p-4"
      role="presentation"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-3 border border-border bg-card p-5 shadow-elegant"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-title"
      >
        <div>
          <h2 id="payment-title" className="font-display text-xl font-bold text-secondary">
            Record payment
          </h2>
          <p className="text-sm text-muted-foreground">
            {invoice.invoice_number} · Balance{" "}
            {money(Math.max(invoice.total - invoice.paid_total, 0), invoice.currency)}
          </p>
        </div>
        <Field
          label={`Amount (${invoice.currency})`}
          name="amount"
          type="number"
          required
          min="0.01"
          max={String(Math.max(invoice.total - invoice.paid_total, 0))}
          step="0.01"
          value={amount}
          onChange={onAmount}
        />
        <label className="block text-sm font-semibold text-secondary">
          Payment method
          <select
            name="method"
            value={method}
            onChange={(event) => onMethod(event.target.value)}
            required
            className="mt-1.5 h-9 w-full rounded-sm border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
          >
            {paymentMethods.map((paymentMethod) => (
              <option key={paymentMethod} value={paymentMethod}>
                {paymentMethod}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Reference (optional)"
          name="reference"
          value={reference}
          onChange={onReference}
        />
        <p className="text-xs text-muted-foreground">
          A numbered receipt will be created automatically. Partial payments are supported.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="border border-border px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            className="bg-gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            {busy ? "Saving…" : "Record payment"}
          </button>
        </div>
      </form>
    </div>
  );
}

function StaffAccessPanel({
  setError,
  setNotice,
}: {
  setError: (message: string) => void;
  setNotice: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createdPin, setCreatedPin] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const pin = await api.provisionClerk(
        String(form.get("display_name") ?? ""),
        String(form.get("pin") ?? ""),
      );
      setCreatedPin(pin);
      setOpen(false);
      setNotice("Clerk access created. Save the PIN and share it securely.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create clerk access.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="max-w-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-bold text-secondary">Clerk access</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Clerks sign in at the separate point-of-sale screen. They can create and view invoices and
        record payments, but cannot access administration, client settings or project dashboards.
      </p>
      {createdPin ? (
        <div className="mt-4 border border-primary/30 bg-accent p-4">
          <p className="text-sm font-semibold">Share this clerk PIN securely:</p>
          <p className="my-2 font-mono text-3xl font-bold tracking-[0.3em] text-secondary">
            {createdPin}
          </p>
          <button
            onClick={() => setCreatedPin("")}
            className="text-xs font-bold text-primary underline"
          >
            I have saved the PIN
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 bg-gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          Create clerk access
        </button>
      )}
      <Modal open={open} title="Create clerk access" onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Staff name" name="display_name" required />
          <label className="block text-sm font-semibold text-secondary">
            Clerk PIN *
            <input
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              autoComplete="new-password"
              required
              className="mt-1.5 h-9 w-full rounded-sm border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border border-border px-3 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              disabled={busy}
              className="bg-secondary px-3 py-2 text-sm font-bold text-secondary-foreground"
            >
              {busy ? "Creating…" : "Create clerk"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

function AdminWorkspace({
  clients,
  projects,
  updates,
  resources,
  onRefresh,
  setError,
  setNotice,
}: {
  clients: Client[];
  projects: Project[];
  updates: ProjectUpdate[];
  resources: SharedResource[];
  onRefresh: () => void;
  setError: (message: string) => void;
  setNotice: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [resourceClient, setResourceClient] = useState(clients[0]?.id ?? "");
  const [updateProject, setUpdateProject] = useState(projects[0]?.id ?? "");
  const [showProject, setShowProject] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [showResource, setShowResource] = useState(false);
  async function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      await api.createProject({
        client_id: String(form.get("client_id")),
        name: String(form.get("name")).trim(),
        status: String(form.get("status")),
        progress: Number(form.get("progress")),
        summary: String(form.get("summary") ?? "").trim(),
      });
      formElement.reset();
      setShowProject(false);
      setNotice("Project added to the client's dashboard.");
      onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create project.");
    } finally {
      setBusy(false);
    }
  }
  async function addUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const project = projects.find((candidate) => candidate.id === updateProject);
    if (!project) {
      setError("Choose a project for this update.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    const screenshots = form
      .getAll("screenshots")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (screenshots.length > 5) {
      setError("Upload up to five screenshots per project update.");
      return;
    }
    if (
      screenshots.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) ||
          file.size > 10 * 1024 * 1024,
      )
    ) {
      setError("Screenshots must be JPG, PNG, WebP or GIF files smaller than 10 MB each.");
      return;
    }
    setBusy(true);
    setError("");
    const updateId = crypto.randomUUID();
    const uploadedPaths: string[] = [];
    try {
      for (const screenshot of screenshots) {
        uploadedPaths.push(
          await api.uploadProjectUpdateImage(project.client_id, updateId, screenshot),
        );
      }
      await api.createProjectUpdate({
        id: updateId,
        project_id: project.id,
        client_id: project.client_id,
        title: String(form.get("title")).trim(),
        content: String(form.get("content")).trim(),
        screenshot_paths: uploadedPaths,
      });
      formElement.reset();
      setShowUpdate(false);
      setNotice("Project update shared with the client.");
      onRefresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to publish project update.";
      if (uploadedPaths.length) {
        try {
          await api.deleteProjectUpdateImages(uploadedPaths);
        } catch (cleanupCause) {
          const cleanupMessage =
            cleanupCause instanceof Error
              ? cleanupCause.message
              : "Unable to clean up uploaded screenshots.";
          setError(`${message} ${cleanupMessage}`);
          return;
        }
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }
  async function addResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      await api.createResource({
        client_id: resourceClient,
        title: String(form.get("title")).trim(),
        content: String(form.get("content") ?? "").trim(),
        url: String(form.get("url") ?? "").trim(),
      });
      formElement.reset();
      setShowResource(false);
      setNotice("Resource added to the client's dashboard.");
      onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to share resource.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-3">
        <div>
          <button
            type="button"
            onClick={() => setShowProject(true)}
            className="w-full border border-border bg-card p-4 text-left font-display font-bold text-secondary"
          >
            Add client project
          </button>
          <Modal
            open={showProject}
            title="Add client project"
            onClose={() => setShowProject(false)}
          >
            <form onSubmit={addProject} className="space-y-3">
              <ClientSelect clients={clients} name="client_id" />
              <Field label="Project name" name="name" required />
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm font-semibold">
                  Status
                  <select
                    name="status"
                    className="mt-1.5 h-9 w-full border border-input bg-background px-2 font-normal"
                  >
                    <option value="in_progress">In progress</option>
                    <option value="planning">Planning</option>
                    <option value="review">In review</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On hold</option>
                  </select>
                </label>
                <Field label="Progress %" name="progress" type="number" value="0" />
              </div>
              <label className="block text-sm font-semibold">
                Summary
                <textarea
                  name="summary"
                  rows={2}
                  className="mt-1.5 w-full border border-input bg-background p-2 font-normal"
                />
              </label>
              <button
                disabled={busy || !clients.length}
                className="w-full bg-gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              >
                Add project
              </button>
            </form>
          </Modal>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setShowUpdate(true)}
            className="w-full border border-border bg-card p-4 text-left font-display font-bold text-secondary"
          >
            Publish project update
          </button>
          <Modal
            open={showUpdate}
            title="Publish project update"
            onClose={() => setShowUpdate(false)}
          >
            <form onSubmit={addUpdate} className="space-y-3">
              <label className="block text-sm font-semibold">
                Project
                <select
                  required
                  value={updateProject}
                  onChange={(event) => setUpdateProject(event.target.value)}
                  className="mt-1.5 h-9 w-full border border-input bg-background px-3 font-normal"
                >
                  <option value="">Choose project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Update title" name="title" required />
              <label className="block text-sm font-semibold">
                Message
                <textarea
                  name="content"
                  required
                  rows={3}
                  className="mt-1.5 w-full border border-input bg-background p-2 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold">
                Progress screenshots (optional, up to 5)
                <input
                  type="file"
                  name="screenshots"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="mt-1.5 block w-full text-sm font-normal file:mr-3 file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-accent-foreground"
                />
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  JPG, PNG, WebP or GIF · 10 MB maximum per image
                </span>
              </label>
              <button
                disabled={busy || !projects.length}
                className="w-full bg-gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              >
                Share update
              </button>
            </form>
          </Modal>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setShowResource(true)}
            className="w-full border border-border bg-card p-4 text-left font-display font-bold text-secondary"
          >
            Share a resource
          </button>
          <Modal
            open={showResource}
            title="Share a resource"
            onClose={() => setShowResource(false)}
          >
            <form onSubmit={addResource} className="space-y-3">
              <ClientSelect
                clients={clients}
                name="client_id"
                value={resourceClient}
                onChange={setResourceClient}
              />
              <Field label="Resource title" name="title" required />
              <Field label="Link (optional)" name="url" type="url" placeholder="https://" />
              <label className="block text-sm font-semibold">
                Description
                <textarea
                  name="content"
                  rows={2}
                  className="mt-1.5 w-full border border-input bg-background p-2 font-normal"
                />
              </label>
              <button
                disabled={busy || !clients.length}
                className="w-full bg-gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              >
                Share with client
              </button>
            </form>
          </Modal>
        </div>
      </section>
      <section className="grid gap-5 xl:grid-cols-3">
        <div className="border border-border bg-card p-5">
          <h2 className="mb-3 font-display font-bold text-secondary">
            Projects ({projects.length})
          </h2>
          <AdminProjectCards
            clients={clients}
            projects={projects}
            onRefresh={onRefresh}
            setError={setError}
          />
        </div>
        <div className="border border-border bg-card p-5">
          <h2 className="mb-3 font-display font-bold text-secondary">
            Recent updates ({updates.length})
          </h2>
          <UpdateList updates={updates.slice(0, 8)} projects={projects} />
        </div>
        <div className="border border-border bg-card p-5">
          <h2 className="mb-3 font-display font-bold text-secondary">
            Shared resources ({resources.length})
          </h2>
          <ResourceList resources={resources} />
        </div>
      </section>
    </div>
  );
}

function ProfilePanel({ clients, user }: { clients: Client[]; user: InvoicingUser }) {
  const client = clients.find((candidate) => candidate.id === user.client_id);
  const values = [
    { label: "Name", value: user.display_name },
    { label: "Account type", value: user.role === "client" ? "Client" : "Administrator" },
    ...(user.role === "client"
      ? [
          { label: "Company", value: client?.company || "—" },
          { label: "Email", value: client?.email || "—" },
          { label: "Phone", value: client?.phone || "—" },
        ]
      : []),
  ];
  return (
    <section className="max-w-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <UserRound aria-hidden="true" className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-secondary">{user.display_name}</h2>
          <p className="text-sm capitalize text-muted-foreground">{user.role} account</p>
        </div>
      </div>
      <dl className="mt-4 divide-y divide-border">
        {values.map(({ label, value }) => (
          <div key={label} className="grid gap-1 py-3 sm:grid-cols-[140px_1fr]">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-sm font-semibold text-secondary">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">
        To update your account information, contact the CodeMath administrator.
      </p>
    </section>
  );
}

function ClientSelect({
  clients,
  name,
  value,
  onChange,
}: {
  clients: Client[];
  name: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold">
      Client
      <select
        required
        name={name}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="mt-1.5 h-9 w-full border border-input bg-background px-3 font-normal"
      >
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ClientWorkspace({
  projects,
  updates,
  resources,
}: {
  projects: Project[];
  updates: ProjectUpdate[];
  resources: SharedResource[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="border border-border bg-card p-5">
        <h2 className="mb-4 font-display font-bold text-secondary">Project progress</h2>
        <ProjectCards projects={projects} />
      </section>
      <section className="border border-border bg-card p-5">
        <h2 className="mb-4 font-display font-bold text-secondary">Updates from CodeMath</h2>
        <UpdateList updates={updates} projects={projects} />
      </section>
      <section className="border border-border bg-card p-5 xl:col-span-2">
        <h2 className="mb-4 font-display font-bold text-secondary">Shared files and resources</h2>
        <ResourceList resources={resources} />
      </section>
    </div>
  );
}

function AdminProjectCards({
  clients,
  projects,
  onRefresh,
  setError,
}: {
  clients: Client[];
  projects: Project[];
  onRefresh: () => void;
  setError: (message: string) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  async function saveProject(event: FormEvent<HTMLFormElement>, project: Project) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusyId(project.id);
    setError("");
    try {
      await api.setProjectProgress(
        project.id,
        Number(form.get("progress")),
        String(form.get("status")),
      );
      setEditingProject(null);
      onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update project.");
    } finally {
      setBusyId(null);
    }
  }
  if (!projects.length) return <EmptyState text="No client projects yet." />;
  return (
    <div className="space-y-3">
      {projects.map((project) => (
        <div
          key={`${project.id}-${project.status}-${project.progress}`}
          className="border border-border p-3"
        >
          <p className="font-semibold text-secondary">{project.name}</p>
          <p className="mb-2 text-xs text-muted-foreground">
            {clients.find((client) => client.id === project.client_id)?.name ?? "Client"}
          </p>
          <button
            type="button"
            onClick={() => setEditingProject(project)}
            className="border border-border px-3 py-2 text-xs font-semibold"
          >
            Update project
          </button>
        </div>
      ))}
      {editingProject && (
        <Modal open title="Update project" onClose={() => setEditingProject(null)}>
          <form onSubmit={(event) => void saveProject(event, editingProject)} className="space-y-3">
            <p className="font-semibold text-secondary">{editingProject.name}</p>
            <label className="block text-sm font-semibold">
              Status
              <select
                name="status"
                defaultValue={editingProject.status}
                className="mt-1.5 h-9 w-full border border-input bg-background px-2 font-normal"
              >
                <option value="planning">Planning</option>
                <option value="in_progress">In progress</option>
                <option value="review">In review</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On hold</option>
              </select>
            </label>
            <Field
              label="Progress %"
              name="progress"
              type="number"
              value={String(editingProject.progress)}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                className="border border-border px-3 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={busyId === editingProject.id}
                className="bg-secondary px-3 py-2 text-sm font-bold text-secondary-foreground"
              >
                {busyId === editingProject.id ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function ProjectCards({ projects }: { projects: Project[] }) {
  if (!projects.length) return <EmptyState text="There are no projects in this workspace yet." />;
  return (
    <div className="space-y-3">
      {projects.map((project) => (
        <article key={project.id} className="border border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-secondary">{project.name}</h3>
              <p className="mt-1 text-xs capitalize text-muted-foreground">
                {project.status.replaceAll("_", " ")}
              </p>
            </div>
            <span className="font-mono text-sm font-bold text-primary">{project.progress}%</span>
          </div>
          {project.summary && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{project.summary}</p>
          )}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${project.progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Updated {project.updated_at.slice(0, 10)}
          </p>
        </article>
      ))}
    </div>
  );
}

function UpdateList({ updates, projects }: { updates: ProjectUpdate[]; projects: Project[] }) {
  if (!updates.length) return <EmptyState text="No project updates have been shared yet." />;
  return (
    <div className="space-y-3">
      {updates.map((update) => (
        <article key={update.id} className="border-l-2 border-primary pl-3">
          <p className="text-xs text-muted-foreground">
            {projects.find((project) => project.id === update.project_id)?.name ?? "Project"} ·{" "}
            {update.created_at.slice(0, 10)}
          </p>
          <h3 className="mt-1 font-semibold text-secondary">{update.title}</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {update.content}
          </p>
          {!!update.screenshot_urls?.length && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {update.screenshot_urls.map((url, index) => (
                <a
                  key={`${update.id}-${index}`}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden border border-border"
                >
                  <img
                    src={url}
                    alt={`${update.title} progress screenshot ${index + 1}`}
                    loading="lazy"
                    className="max-h-80 w-full object-contain"
                  />
                </a>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function ResourceList({ resources }: { resources: SharedResource[] }) {
  if (!resources.length) return <EmptyState text="No files or resources have been shared yet." />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {resources.map((resource) => (
        <article key={resource.id} className="border border-border p-4">
          <h3 className="font-semibold text-secondary">{resource.title}</h3>
          {resource.content && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {resource.content}
            </p>
          )}
          {resource.url && (
            <a
              href={resource.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
            >
              Open resource <ArrowRight className="h-3.5 w-3.5" />
            </a>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Shared {resource.created_at.slice(0, 10)}
          </p>
        </article>
      ))}
    </div>
  );
}

function ReceiptPrint({
  receipt,
  invoice,
  onClose,
  onShare,
}: {
  receipt: Payment | null;
  invoice: Invoice | null;
  onClose: () => void;
  onShare: () => void;
}) {
  if (!receipt) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary/60 p-4">
      <section className="receipt-print w-full max-w-lg border border-border bg-card p-8 shadow-elegant">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
          <div>
            <img src={logo} alt="CodeMath" className="mb-4 h-10 w-auto object-contain" />
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-primary">
              Payment receipt
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold text-secondary">
              {receipt.receipt_number}
            </h2>
          </div>
          <ReceiptText className="h-8 w-8 text-primary" />
        </div>
        <dl className="mt-5 grid grid-cols-[130px_1fr] gap-y-3 text-sm">
          <dt className="text-muted-foreground">Received from</dt>
          <dd className="font-semibold">{invoice?.client_name ?? "Client"}</dd>
          <dt className="text-muted-foreground">Invoice</dt>
          <dd className="font-semibold">{invoice?.invoice_number ?? "—"}</dd>
          <dt className="text-muted-foreground">Payment date</dt>
          <dd>{receipt.received_at.slice(0, 10)}</dd>
          <dt className="text-muted-foreground">Payment method</dt>
          <dd className="capitalize">{receipt.method.replaceAll("_", " ")}</dd>
          {receipt.reference && (
            <>
              <dt className="text-muted-foreground">Reference</dt>
              <dd>{receipt.reference}</dd>
            </>
          )}
        </dl>
        <div className="mt-6 border-y border-border py-4">
          <div className="flex justify-between text-lg font-bold text-secondary">
            <span>Amount received</span>
            <span>{money(receipt.amount, receipt.currency)}</span>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          This receipt confirms the payment received for the invoice shown above. Thank you for your
          business.
        </p>
        <div className="mt-6 flex justify-end gap-2 print:hidden">
          <button
            onClick={onClose}
            className="border border-border px-4 py-2 text-sm font-semibold"
          >
            Close
          </button>
          <button
            onClick={onShare}
            className="inline-flex items-center gap-2 border border-border px-4 py-2 text-sm font-semibold"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
          <button
            onClick={() => window.print()}
            className="bg-gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Save / print PDF
          </button>
        </div>
      </section>
      <style>{`@media print { body * { visibility: hidden !important; } .receipt-print, .receipt-print * { visibility: visible !important; } .receipt-print { position: absolute; inset: 0; max-width: none; box-shadow: none; border: 0; } }`}</style>
    </div>
  );
}
