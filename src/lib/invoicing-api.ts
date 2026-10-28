import { createClient } from "@supabase/supabase-js";

export type UserRole = "admin" | "clerk" | "client";

export type InvoicingUser = {
  id: string;
  display_name: string;
  role: UserRole;
  client_id: string | null;
};

export type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
};

export type Invoice = {
  id: string;
  invoice_number: string;
  client_id: string;
  client_name: string;
  issue_date: string;
  due_date: string | null;
  status: "draft" | "pending" | "sent" | "partial" | "paid" | "overdue" | "cancelled";
  currency: string;
  total: number;
  paid_total: number;
  share_token: string;
  client_email: string | null;
  client_phone: string | null;
  notes: string | null;
  payment_method: string | null;
};

export type InvoiceSettings = {
  id: boolean;
  business_name: string;
  payment_methods: InvoicePaymentMethod[];
  special_notes: string;
  updated_at: string;
};

export type InvoicePaymentMethod = {
  name: string;
  instructions: string;
  active: boolean;
};

export type PublicInvoiceData = {
  invoice: {
    invoice_number: string;
    client_name: string;
    client_email: string | null;
    client_phone: string | null;
    issue_date: string;
    due_date: string | null;
    status: Invoice["status"];
    currency: string;
    total: number;
    paid_total: number;
    notes: string | null;
    payment_method: string | null;
  };
  items: Omit<InvoiceItem, "id">[];
  payments: Omit<Payment, "id" | "invoice_id" | "reference">[];
  settings: Pick<InvoiceSettings, "business_name" | "payment_methods" | "special_notes">;
};

export type Project = {
  id: string;
  client_id: string;
  name: string;
  status: string;
  progress: number;
  summary: string | null;
  updated_at: string;
};

export type ProjectUpdate = {
  id: string;
  project_id: string;
  client_id: string;
  title: string;
  content: string;
  screenshot_paths: string[];
  screenshot_urls?: string[];
  created_at: string;
};

export type ClientMessage = {
  id: string;
  client_id: string;
  sender_id: string;
  content: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  attachment_url?: string | undefined;
  reply_to_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type ChatCallSignal = {
  type: "offer" | "answer" | "ice-candidate" | "hangup";
  call_id: string;
  sender_id: string;
  payload?: RTCSessionDescriptionInit | RTCIceCandidateInit;
};

export type RealtimeActivity = {
  title: string;
  body: string;
};

export type SharedResource = {
  id: string;
  client_id: string;
  title: string;
  content: string | null;
  url: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  invoice_id: string;
  receipt_number: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  received_at: string;
};

export type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type Service = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit_price: number;
  currency: string;
  active: boolean;
};

export type Performance = {
  currency: string;
  invoice_count: number;
  paid_count: number;
  outstanding_count: number;
  billed_total: number;
  collected_total: number;
  outstanding_total: number;
};

type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string };
};

type StoredSession = SupabaseSession & {
  acquired_at: number;
};

const SESSION_KEY = "codemath-invoicing-session";
const REFRESH_LOCK_NAME = "codemath-invoicing-session-refresh";
const REFRESH_EARLY_MS = 60_000;
let refreshPromise: Promise<StoredSession> | undefined;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let realtimeClientInstance: ReturnType<typeof createClient> | undefined;

function configuration() {
  const url = import.meta.env["VITE_SUPABASE_URL"]?.replace(/\/$/, "");
  const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }
  return { url, anonKey };
}

function storedSession(): StoredSession | null {
  const value = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
  if (!value) return null;
  try {
    const session = JSON.parse(value) as Partial<StoredSession>;
    if (
      typeof session.access_token !== "string" ||
      typeof session.refresh_token !== "string" ||
      typeof session.expires_in !== "number" ||
      typeof session.acquired_at !== "number" ||
      typeof session.user?.id !== "string"
    ) {
      throw new Error("Stored session data is incomplete.");
    }
    const stored = session as StoredSession;
    if (!localStorage.getItem(SESSION_KEY)) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
      sessionStorage.removeItem(SESSION_KEY);
    }
    return stored;
  } catch (error) {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    console.error("Unable to read the invoicing session.", error);
    return null;
  }
}

function saveSession(session: SupabaseSession): StoredSession {
  const stored = { ...session, acquired_at: Date.now() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
  sessionStorage.removeItem(SESSION_KEY);
  scheduleSessionRefresh(stored);
  return stored;
}

function clearSession(notify = false) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = undefined;
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  if (notify) window.dispatchEvent(new Event("codemath-session-ended"));
}

function scheduleSessionRefresh(session: StoredSession) {
  if (typeof window === "undefined") return;
  if (refreshTimer) clearTimeout(refreshTimer);
  const refreshIn = Math.max(
    1_000,
    session.acquired_at + session.expires_in * 1000 - Date.now() - REFRESH_EARLY_MS,
  );
  refreshTimer = setTimeout(() => {
    void validSession().catch((error: unknown) => {
      console.error("Unable to refresh the invoicing session in the background.", error);
      retrySessionRefresh();
    });
  }, refreshIn);
}

function retrySessionRefresh() {
  const session = storedSession();
  if (!session) return;
  refreshTimer = setTimeout(() => {
    void validSession().catch((error: unknown) => {
      console.error("Unable to refresh the invoicing session in the background.", error);
      retrySessionRefresh();
    });
  }, 30_000);
}

async function refreshStoredSession(): Promise<StoredSession> {
  const session = storedSession();
  if (!session) throw new Error("Your session has ended. Sign in again.");
  if (Date.now() < session.acquired_at + session.expires_in * 1000 - REFRESH_EARLY_MS) {
    return session;
  }

  const { url, anonKey } = configuration();
  const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as {
      error?: string;
      error_description?: string;
      msg?: string;
      message?: string;
    } | null;
    if (response.status === 400 || response.status === 401) {
      clearSession(true);
      throw new Error("Your session has expired. Sign in again.");
    }
    throw new Error(
      detail?.error_description ??
        detail?.msg ??
        detail?.error ??
        detail?.message ??
        "Unable to refresh your session. Check your connection and try again.",
    );
  }

  const refreshed = (await response.json()) as SupabaseSession;
  if (
    typeof refreshed.access_token !== "string" ||
    typeof refreshed.refresh_token !== "string" ||
    typeof refreshed.expires_in !== "number" ||
    typeof refreshed.user?.id !== "string"
  ) {
    throw new Error("Supabase returned an invalid refreshed session.");
  }
  const latest = storedSession();
  if (!latest) throw new Error("Your session has ended. Sign in again.");
  if (latest.user.id !== session.user.id) {
    throw new Error("The signed-in account changed. Please try your request again.");
  }
  if (latest.refresh_token !== session.refresh_token) {
    if (realtimeClientInstance) {
      await realtimeClientInstance.realtime.setAuth(latest.access_token);
    }
    return latest;
  }
  const saved = saveSession(refreshed);
  if (realtimeClientInstance) {
    await realtimeClientInstance.realtime.setAuth(saved.access_token);
  }
  return saved;
}

async function validSession(): Promise<StoredSession> {
  const session = storedSession();
  if (!session) throw new Error("Your session has ended. Sign in again.");
  if (Date.now() < session.acquired_at + session.expires_in * 1000 - REFRESH_EARLY_MS) {
    scheduleSessionRefresh(session);
    return session;
  }
  if (!refreshPromise) {
    const refresh = () => refreshStoredSession();
    refreshPromise =
      typeof navigator !== "undefined" && navigator.locks
        ? navigator.locks.request(REFRESH_LOCK_NAME, refresh)
        : refresh();
    void refreshPromise.then(
      () => {
        refreshPromise = undefined;
      },
      () => {
        refreshPromise = undefined;
      },
    );
  }
  return refreshPromise.then((refreshed) => {
    scheduleSessionRefresh(refreshed);
    return refreshed;
  });
}

export function currentSession() {
  const session = storedSession();
  if (session) scheduleSessionRefresh(session);
  return session;
}

export async function loginWithPin(pin: string): Promise<void> {
  if (!/^\d{6}$/.test(pin)) throw new Error("Enter your 6-digit PIN.");
  const { url, anonKey } = configuration();
  const response = await fetch(`${url}/functions/v1/pin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ pin }),
  });
  const result = (await response.json()) as { session?: SupabaseSession; error?: string };
  if (!response.ok || !result.session) {
    throw new Error(result.error ?? "Unable to sign in. Check the PIN and try again.");
  }
  saveSession(result.session);
}

export function logout() {
  clearSession();
}

function realtimeClient() {
  if (realtimeClientInstance) return realtimeClientInstance;
  const { url, anonKey } = configuration();
  realtimeClientInstance = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    accessToken: async () => {
      const session = await validSession();
      return session.access_token;
    },
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== SESSION_KEY) return;
    if (!event.newValue) {
      window.dispatchEvent(new Event("codemath-session-ended"));
      return;
    }
    const updated = JSON.parse(event.newValue) as Partial<StoredSession>;
    const previous = event.oldValue ? (JSON.parse(event.oldValue) as Partial<StoredSession>) : null;
    if (previous?.user?.id && updated.user?.id && previous.user.id !== updated.user.id) {
      window.dispatchEvent(new Event("codemath-session-ended"));
      return;
    }
    if (typeof updated.access_token === "string") {
      void realtimeClientInstance?.realtime.setAuth(updated.access_token);
    }
  });
  return realtimeClientInstance;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, anonKey } = configuration();
  const session = await validSession();

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Supabase request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function getCurrentUser(): Promise<InvoicingUser> {
  const { url, anonKey } = configuration();
  const session = await validSession();
  const response = await fetch(
    `${url}/rest/v1/profiles?id=eq.${session.user.id}&select=id,display_name,role,client_id`,
    {
      headers: { apikey: anonKey, Authorization: `Bearer ${session.access_token}` },
    },
  );
  if (!response.ok) throw new Error("Unable to load your account profile.");
  const users = (await response.json()) as InvoicingUser[];
  if (!users[0]) throw new Error("This account is not configured for the invoicing platform.");
  return users[0];
}

export const api = {
  clients: () => request<Client[]>("clients?select=id,name,email,phone,company&order=name"),
  invoices: () =>
    request<Invoice[]>(
      "invoice_summary?select=id,invoice_number,client_id,client_name,issue_date,due_date,status,currency,total,paid_total,share_token,client_email,client_phone,notes,payment_method&order=issue_date.desc",
    ),
  invoiceSettings: async () => {
    const settings = await request<InvoiceSettings[]>(
      "invoice_settings?select=id,business_name,payment_methods,special_notes,updated_at&id=eq.true",
    );
    if (!settings[0]) throw new Error("Invoice settings are not configured.");
    return settings[0];
  },
  updateInvoiceSettings: (
    settings: Pick<InvoiceSettings, "business_name" | "payment_methods" | "special_notes">,
  ) =>
    request<InvoiceSettings[]>("invoice_settings?id=eq.true", {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...settings, updated_at: new Date().toISOString() }),
    }),
  publicInvoice: async (shareToken: string) => {
    const { url, anonKey } = configuration();
    const response = await fetch(`${url}/rest/v1/rpc/get_public_invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ p_share_token: shareToken }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || "Unable to load the public invoice.");
    }
    const data = (await response.json()) as PublicInvoiceData | null;
    if (!data) throw new Error("Invoice not found or the shared link is invalid.");
    return data;
  },
  projects: () =>
    request<Project[]>(
      "projects?select=id,client_id,name,status,progress,summary,updated_at&order=updated_at.desc",
    ),
  updates: () =>
    request<ProjectUpdate[]>(
      "project_updates?select=id,project_id,client_id,title,content,screenshot_paths,created_at&order=created_at.desc",
    ),
  chatMessages: async (clientId: string) => {
    const messages = await request<ClientMessage[]>(
      `client_messages?client_id=eq.${encodeURIComponent(clientId)}&select=id,client_id,sender_id,content,attachment_path,attachment_name,attachment_mime,reply_to_id,read_at,created_at&order=created_at.asc`,
    );
    return Promise.all(
      messages.map(async (message) => ({
        ...message,
        attachment_url: message.attachment_path
          ? await api.chatAttachmentUrl(message.attachment_path)
          : undefined,
      })),
    );
  },
  sendChatMessage: async (clientId: string, content: string, replyToId: string | null = null) => {
    const session = await validSession();
    return request<ClientMessage[]>("client_messages", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        client_id: clientId,
        sender_id: session.user.id,
        content: content.trim(),
        reply_to_id: replyToId,
      }),
    });
  },
  sendChatAttachment: async (
    clientId: string,
    file: File,
    content = "",
    replyToId: string | null = null,
  ) => {
    const session = await validSession();
    if (!/^(image|audio|video)\//.test(file.type)) {
      throw new Error("Choose an image, audio recording, or video file.");
    }
    if (file.size > 50 * 1024 * 1024) {
      throw new Error("Chat attachments must be 50 MB or smaller.");
    }

    const { url, anonKey } = configuration();
    const safeName = file.name.replace(/[^\w.-]/g, "_");
    const path = `${clientId}/${crypto.randomUUID()}-${safeName}`;
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const mimeType = file.type.split(";")[0] ?? file.type;
    const headers = {
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": mimeType,
    };
    const response = await fetch(`${url}/storage/v1/object/client-chat-media/${encodedPath}`, {
      method: "POST",
      headers: { ...headers, "x-upsert": "false" },
      body: file,
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || "Unable to upload the chat attachment.");
    }

    try {
      const attachmentUrl = await api.chatAttachmentUrl(path);
      const rows = await request<ClientMessage[]>("client_messages", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          client_id: clientId,
          sender_id: session.user.id,
          content: content.trim() || null,
          attachment_path: path,
          attachment_name: file.name,
          attachment_mime: mimeType,
          reply_to_id: replyToId,
        }),
      });
      if (!rows[0]) throw new Error("The chat attachment message was not returned after sending.");
      return { ...rows[0], attachment_url: attachmentUrl };
    } catch (cause) {
      const cleanup = await fetch(`${url}/storage/v1/object/client-chat-media`, {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [path] }),
      });
      if (!cleanup.ok) {
        console.error("Unable to clean up an unsent chat attachment.", await cleanup.text());
      }
      throw cause;
    }
  },
  chatAttachmentUrl: async (path: string) => {
    const { url, anonKey } = configuration();
    const session = await validSession();
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(`${url}/storage/v1/object/sign/client-chat-media/${encodedPath}`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 3600 }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || "Unable to load the chat attachment.");
    }
    const result = (await response.json()) as { signedURL: string };
    return result.signedURL.startsWith("http")
      ? result.signedURL
      : `${url}/storage/v1${result.signedURL}`;
  },
  subscribeToChat: (
    clientId: string,
    onMessage: (message: ClientMessage) => void,
    onUpdate: (message: ClientMessage) => void,
    onError: (message: string) => void,
  ) => {
    const client = realtimeClient();
    const channel = client
      .channel(`client-chat-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "client_messages",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => onMessage(payload.new as ClientMessage),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "client_messages",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => onUpdate(payload.new as ClientMessage),
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          onError(error?.message ?? "Live chat disconnected. Refresh to reconnect.");
        }
      });
    return () => {
      void client.removeChannel(channel);
    };
  },
  markChatMessagesRead: async (clientId: string) => {
    const session = await validSession();
    const query = new URLSearchParams({
      client_id: `eq.${clientId}`,
      sender_id: `neq.${session.user.id}`,
      read_at: "is.null",
      select: "id,read_at",
    });
    const readAt = new Date().toISOString();
    const updated = await request<Array<{ id: string; read_at: string }>>(
      `client_messages?${query.toString()}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ read_at: readAt }),
      },
    );
    return updated;
  },
  subscribeToActivity: (
    user: InvoicingUser,
    onActivity: (activity: RealtimeActivity) => void,
    onError: (message: string) => void,
  ) => {
    const client = realtimeClient();
    const channel = client.channel(`invoicing-activity-${user.id}`);
    const notifyMessage = (record: Record<string, unknown>) => {
      if (record["sender_id"] === user.id) return;
      const attachmentType = String(record["attachment_mime"] ?? "").split("/")[0];
      const content = String(record["content"] ?? "").trim();
      const body =
        content ||
        (attachmentType === "image"
          ? "Sent you a photo."
          : attachmentType === "video"
            ? "Sent you a video."
            : attachmentType === "audio"
              ? "Sent you an audio message."
              : "Sent you a message.");
      onActivity({
        title: user.role === "admin" ? "New client message" : "New message from CodeMath",
        body,
      });
    };

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "client_messages",
        ...(user.role === "admin" ? { filter: `sender_id=neq.${user.id}` } : {}),
      },
      (payload) => notifyMessage(payload.new as Record<string, unknown>),
    );

    if (user.role === "client" && user.client_id) {
      channel
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "invoices",
            filter: `client_id=eq.${user.client_id}`,
          },
          (payload) => {
            const invoice = payload.new as Record<string, unknown>;
            onActivity({
              title: "New invoice",
              body: `Invoice ${String(invoice["invoice_number"] ?? "")} is available.`,
            });
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "invoices",
            filter: `client_id=eq.${user.client_id}`,
          },
          (payload) => {
            const invoice = payload.new as Record<string, unknown>;
            onActivity({
              title: "Invoice updated",
              body: `Invoice ${String(invoice["invoice_number"] ?? "")} is now ${String(invoice["status"] ?? "updated")}.`,
            });
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "payments" },
          (payload) => {
            const payment = payload.new as Record<string, unknown>;
            onActivity({
              title: "Payment recorded",
              body: `${String(payment["currency"] ?? "")} ${Number(payment["amount"] ?? 0).toFixed(2)} payment received.`,
            });
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "project_updates",
            filter: `client_id=eq.${user.client_id}`,
          },
          (payload) => {
            const update = payload.new as Record<string, unknown>;
            onActivity({
              title: "New project update",
              body: String(update["title"] ?? "A project update is available."),
            });
          },
        );
    }

    channel.subscribe((status, error) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onError(error?.message ?? "Activity notifications could not connect.");
      }
    });
    return () => {
      void client.removeChannel(channel);
    };
  },
  subscribeToChatCalls: (
    clientId: string,
    onSignal: (signal: ChatCallSignal) => void,
    onError: (message: string) => void,
  ) => {
    const client = realtimeClient();
    let markReady: (() => void) | undefined;
    let readyError: Error | null = null;
    const ready = new Promise<void>((resolve) => {
      markReady = resolve;
    });
    const channel = client
      .channel(`client-call:${clientId}`, { config: { private: true } })
      .on("broadcast", { event: "signal" }, (event) => {
        onSignal(event["payload"] as ChatCallSignal);
      })
      .subscribe((status, error) => {
        if (status === "SUBSCRIBED") markReady?.();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          const message = error?.message ?? "Voice call connection is unavailable.";
          readyError = new Error(message);
          markReady?.();
          onError(message);
        }
      });
    return {
      send: async (signal: ChatCallSignal) => {
        await ready;
        if (readyError) throw readyError;
        const result = await channel.send({
          type: "broadcast",
          event: "signal",
          payload: signal,
        });
        if (result !== "ok") throw new Error("Unable to send voice call signaling.");
      },
      unsubscribe: () => {
        void client.removeChannel(channel);
      },
    };
  },
  uploadProjectUpdateImage: async (clientId: string, updateId: string, file: File) => {
    const { url, anonKey } = configuration();
    const session = await validSession();
    const filename = `${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const path = `${clientId}/${updateId}/${filename}`;
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(`${url}/storage/v1/object/project-progress/${encodedPath}`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": file.type,
        "x-upsert": "false",
      },
      body: file,
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || "Unable to upload project screenshot.");
    }
    return path;
  },
  projectUpdateImageUrl: async (path: string) => {
    const { url, anonKey } = configuration();
    const session = await validSession();
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(`${url}/storage/v1/object/sign/project-progress/${encodedPath}`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 3600 }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || "Unable to load project screenshot.");
    }
    const result = (await response.json()) as { signedURL: string };
    return result.signedURL.startsWith("http")
      ? result.signedURL
      : `${url}/storage/v1${result.signedURL}`;
  },
  deleteProjectUpdateImages: async (paths: string[]) => {
    if (!paths.length) return;
    const { url, anonKey } = configuration();
    const session = await validSession();
    const response = await fetch(`${url}/storage/v1/object/project-progress`, {
      method: "DELETE",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: paths }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || "Unable to remove uploaded project screenshots.");
    }
  },
  resources: () =>
    request<SharedResource[]>(
      "shared_resources?select=id,client_id,title,content,url,created_at&order=created_at.desc",
    ),
  payments: () =>
    request<Payment[]>(
      "payments?select=id,invoice_id,receipt_number,amount,currency,method,reference,received_at&order=received_at.desc",
    ),
  invoiceItems: (id: string) =>
    request<InvoiceItem[]>(
      `invoice_items?invoice_id=eq.${encodeURIComponent(id)}&select=id,description,quantity,unit_price,line_total`,
    ),
  invoiceDetails: async (id: string) => {
    const filter = `id=eq.${encodeURIComponent(id)}`;
    const [invoices, items, payments] = await Promise.all([
      request<Invoice[]>(
        `invoice_summary?${filter}&select=id,invoice_number,client_id,client_name,issue_date,due_date,status,currency,total,paid_total,share_token,client_email,client_phone,notes,payment_method`,
      ),
      request<InvoiceItem[]>(
        `invoice_items?invoice_id=eq.${encodeURIComponent(id)}&select=id,description,quantity,unit_price,line_total`,
      ),
      request<Payment[]>(
        `payments?invoice_id=eq.${encodeURIComponent(id)}&select=id,invoice_id,receipt_number,amount,currency,method,reference,received_at&order=received_at.desc`,
      ),
    ]);
    if (!invoices[0]) throw new Error("Invoice not found or you do not have access to it.");
    return { invoice: invoices[0], items, payments };
  },
  deleteInvoice: (invoiceId: string) =>
    request<void>("rpc/delete_invoice", {
      method: "POST",
      body: JSON.stringify({ p_invoice_id: invoiceId }),
    }),
  services: () =>
    request<Service[]>(
      "services?select=id,name,description,category,unit_price,currency,active&order=name",
    ),
  performance: () =>
    request<Performance[]>(
      "invoice_performance?select=currency,invoice_count,paid_count,outstanding_count,billed_total,collected_total,outstanding_total&order=currency",
    ),
  provisionClient: async (
    client: Pick<Client, "name" | "email" | "phone" | "company">,
    pin: string,
  ) => {
    if (!/^\d{6}$/.test(pin)) throw new Error("Enter a six-digit PIN for this client.");
    const { url, anonKey } = configuration();
    const session = await validSession();
    const response = await fetch(`${url}/functions/v1/manage-pin-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: "create_client", client, pin }),
    });
    const result = (await response.json()) as { pin?: string; error?: string };
    if (!response.ok || !result.pin) {
      throw new Error(result.error ?? "Unable to create the client account.");
    }
    return result.pin;
  },
  provisionClerk: async (displayName: string, pin: string) => {
    if (!/^\d{6}$/.test(pin)) throw new Error("Enter a six-digit PIN for this staff account.");
    if (!displayName.trim()) throw new Error("Enter a staff name.");
    const { url, anonKey } = configuration();
    const session = await validSession();
    const response = await fetch(`${url}/functions/v1/manage-pin-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: "create_clerk", display_name: displayName.trim(), pin }),
    });
    const result = (await response.json()) as { pin?: string; error?: string };
    if (!response.ok || !result.pin) {
      throw new Error(result.error ?? "Unable to create staff access.");
    }
    return result.pin;
  },
  resetClientPin: async (clientId: string, pin: string) => {
    if (!/^\d{6}$/.test(pin)) throw new Error("Enter a new six-digit PIN.");
    const { url, anonKey } = configuration();
    const session = await validSession();
    const response = await fetch(`${url}/functions/v1/manage-pin-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: "reset_client_pin", client_id: clientId, pin }),
    });
    const result = (await response.json()) as { pin?: string; error?: string };
    if (!response.ok || !result.pin) {
      throw new Error(result.error ?? "Unable to reset the client PIN.");
    }
    return result.pin;
  },
  createInvoice: (invoice: {
    client_id: string;
    issue_date: string;
    due_date: string | null;
    currency: string;
    exchange_rate: number;
    notes: string;
    payment_method: string;
    items: { description: string; quantity: number; unit_price: number }[];
  }) =>
    request<string>("rpc/create_invoice", {
      method: "POST",
      body: JSON.stringify({
        p_client_id: invoice.client_id,
        p_issue_date: invoice.issue_date,
        p_due_date: invoice.due_date,
        p_currency: invoice.currency,
        p_exchange_rate: invoice.exchange_rate,
        p_notes: invoice.notes,
        p_payment_method: invoice.payment_method,
        p_items: invoice.items,
      }),
    }),
  recordPayment: (payment: {
    invoice_id: string;
    amount: number;
    method: string;
    reference: string;
  }) =>
    request<Payment>("rpc/record_payment", {
      method: "POST",
      body: JSON.stringify({
        p_invoice_id: payment.invoice_id,
        p_amount: payment.amount,
        p_method: payment.method,
        p_reference: payment.reference,
      }),
    }),
  createProject: (project: {
    client_id: string;
    name: string;
    status: string;
    progress: number;
    summary: string;
  }) =>
    request<string>("rpc/create_project", {
      method: "POST",
      body: JSON.stringify({
        p_client_id: project.client_id,
        p_name: project.name,
        p_status: project.status,
        p_progress: project.progress,
        p_summary: project.summary,
      }),
    }),
  updateInvoiceStatus: (id: string, status: Invoice["status"]) =>
    request<undefined>(`invoices?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status }),
    }),
  createProjectUpdate: (update: {
    id: string;
    project_id: string;
    client_id: string;
    title: string;
    content: string;
    screenshot_paths: string[];
  }) =>
    request<ProjectUpdate[]>("project_updates", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...update, created_by: storedSession()?.user.id }),
    }),
  createResource: (resource: { client_id: string; title: string; content: string; url: string }) =>
    request<SharedResource[]>("shared_resources", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...resource, created_by: storedSession()?.user.id }),
    }),
  createService: (service: {
    name: string;
    description: string;
    category: string;
    unit_price: number;
    currency: string;
  }) =>
    request("services", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(service),
    }),
  updateClient: (id: string, client: Pick<Client, "name" | "email" | "phone" | "company">) =>
    request<undefined>(`clients?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(client),
    }),
  updateService: (
    id: string,
    service: Partial<
      Pick<Service, "name" | "description" | "category" | "unit_price" | "currency" | "active">
    >,
  ) =>
    request<undefined>(`services?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(service),
    }),
  setProjectProgress: (id: string, progress: number, status: string) =>
    request<undefined>(`projects?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ progress, status, updated_at: new Date().toISOString() }),
    }),
  login: loginWithPin,
};
