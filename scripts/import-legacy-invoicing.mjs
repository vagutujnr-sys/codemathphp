import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const legacyDir = path.join(projectRoot, "invoicing");
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the local environment before importing.",
  );
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(legacyDir, relativePath), "utf8"));
}

async function rest(table, query = "", options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Supabase ${options.method ?? "GET"} ${table} failed (${response.status}): ${detail}`,
    );
  }
  if (response.status === 204) return null;
  return response.json();
}

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toLocaleLowerCase();
const safeNumber = (value, fallback = 0) => {
  const result = Number(value);
  if (!Number.isFinite(result)) return fallback;
  return Math.round((result + Number.EPSILON) * 100) / 100;
};
const legacyClients = (await readJson("clients.json")).clients ?? [];
const legacyServices = (await readJson("services.json")).services ?? [];
const invoiceFiles = (await readdir(path.join(legacyDir, "data")))
  .filter((file) => /^invoice_.*\.json$/i.test(file))
  .sort();
const legacyInvoices = await Promise.all(
  invoiceFiles.map(async (file) => ({
    source: file,
    data: await readJson(path.join("data", file)),
  })),
);

const existingClients = await rest("clients", "select=id,name,email,legacy_import_key");
const clientByLegacyKey = new Map(
  existingClients.filter((row) => row.legacy_import_key).map((row) => [row.legacy_import_key, row]),
);
const clientByEmail = new Map(
  existingClients.filter((row) => row.email).map((row) => [normalize(row.email), row]),
);
const clientByName = new Map(existingClients.map((row) => [normalize(row.name), row]));

async function getOrCreateClient(data, legacyKey) {
  const byKey = clientByLegacyKey.get(legacyKey);
  const match =
    byKey ??
    (data.email && clientByEmail.get(normalize(data.email))) ??
    clientByName.get(normalize(data.name));
  if (match) {
    if (!match.legacy_import_key) {
      const updated = await rest("clients", `id=eq.${encodeURIComponent(match.id)}`, {
        method: "PATCH",
        prefer: "return=representation",
        body: { legacy_import_key: legacyKey },
      });
      Object.assign(match, updated?.[0] ?? { legacy_import_key: legacyKey });
    }
    clientByLegacyKey.set(legacyKey, match);
    return match.id;
  }

  const inserted = await rest("clients", "on_conflict=legacy_import_key", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: { ...data, legacy_import_key: legacyKey },
  });
  const row = inserted?.[0];
  if (!row?.id) throw new Error(`Client import did not return an ID for ${legacyKey}.`);
  existingClients.push(row);
  clientByLegacyKey.set(legacyKey, row);
  if (row.email) clientByEmail.set(normalize(row.email), row);
  clientByName.set(normalize(row.name), row);
  return row.id;
}

for (const client of legacyClients) {
  await getOrCreateClient(
    {
      name: client.name,
      email: client.email || null,
      phone: client.phone || null,
      company: client.company || null,
      notes: client.notes || null,
    },
    `legacy-client-${client.id}`,
  );
}

for (const service of legacyServices) {
  await rest("services", "on_conflict=legacy_import_key", {
    method: "POST",
    prefer: "resolution=ignore-duplicates,return=minimal",
    body: {
      name: service.name,
      description: service.description || null,
      category: service.category || null,
      unit_price: safeNumber(service.price),
      currency: "USD",
      active: true,
      legacy_import_key: `legacy-service-${service.id}`,
    },
  });
}

for (const { source, data } of legacyInvoices) {
  const invoiceClientId = await getOrCreateClient(
    {
      name: data.client_name || "Legacy client",
      email: data.client_email || null,
      phone: data.client_phone || null,
      company: null,
      notes: null,
    },
    `legacy-invoice-client-${normalize(data.client_email || data.client_name).replace(/[^a-z0-9]+/g, "-")}`,
  );
  const currency =
    String(data.currency_code || "USD")
      .trim()
      .toUpperCase()
      .slice(0, 3) || "USD";
  const items = Array.isArray(data.items) ? data.items : [];
  const subtotal = safeNumber(
    data.subtotal ??
      items.reduce((sum, item) => sum + safeNumber(item.quantity, 1) * safeNumber(item.price), 0),
  );
  const total = safeNumber(data.total ?? subtotal);
  const legacyInvoiceKey = `legacy-invoice-${source}`;
  const invoiceRows = await rest("invoices", "on_conflict=legacy_import_key", {
    method: "POST",
    prefer: "resolution=ignore-duplicates,return=representation",
    body: {
      client_id: invoiceClientId,
      invoice_number: data.invoice_number,
      client_name: data.client_name || "Legacy client",
      client_email: data.client_email || null,
      client_phone: data.client_phone || null,
      issue_date: data.date || new Date().toISOString().slice(0, 10),
      status: data.paid ? "paid" : "sent",
      currency,
      exchange_rate: Number(data.exchange_rate) > 0 ? Number(data.exchange_rate) : 1,
      subtotal,
      total,
      base_currency: data.base_currency || null,
      base_currency_total: data.total_zar == null ? null : safeNumber(data.total_zar),
      notes: data.notes || null,
      payment_method: data.payment_method || null,
      payment_details: data.payment_details || null,
      legacy_import_key: legacyInvoiceKey,
    },
  });
  const existingInvoice =
    invoiceRows?.[0] ??
    (
      await rest(
        "invoices",
        `legacy_import_key=eq.${encodeURIComponent(legacyInvoiceKey)}&select=id`,
      )
    )?.[0];
  const invoiceId = existingInvoice?.id;
  if (!invoiceId) throw new Error(`Invoice import did not return an ID for ${source}.`);

  if (items.length) {
    await rest("invoice_items", "on_conflict=legacy_import_key", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=minimal",
      body: items.map((item, index) => ({
        invoice_id: invoiceId,
        description: String(item.description || "Invoice item").trim(),
        quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
        unit_price: safeNumber(item.price),
        legacy_import_key: `legacy-invoice-item-${source}-${index + 1}`,
      })),
    });
  }

  if (data.paid) {
    await rest("payments", "on_conflict=legacy_import_key", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=minimal",
      body: {
        invoice_id: invoiceId,
        receipt_number: `LEGACY-${String(data.invoice_number).replace(/[^a-zA-Z0-9-]/g, "-")}`,
        amount: total,
        currency,
        method: data.payment_method || "legacy_record",
        reference: "Imported from the previous invoicing system",
        received_at: data.paid_date || data.created_at || `${data.date || "2026-01-01"}T12:00:00Z`,
        legacy_import_key: `legacy-payment-${source}`,
      },
    });
  }
}

console.log(
  `Imported ${legacyClients.length} configured clients, ${legacyServices.length} services and ${legacyInvoices.length} invoices.`,
);
