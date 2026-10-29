import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-bootstrap-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200, origin = "https://www.codemathphp.co.za") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Access-Control-Allow-Origin": origin,
      "Content-Type": "application/json",
    },
  });
}

function environment() {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey)
    throw new Error("Account provisioning is not configured.");
  return { url, anonKey, serviceRoleKey };
}

async function pinFingerprint(pin: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(pin));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function pinIsAssigned(
  admin: ReturnType<typeof createClient>,
  pin: string,
  fingerprintSecret: string,
  exceptUserId?: string,
) {
  const fingerprint = await pinFingerprint(pin, fingerprintSecret);
  const { data, error } = await admin
    .from("pin_credentials")
    .select("user_id")
    .eq("pin_fingerprint", fingerprint)
    .maybeSingle();
  if (error) throw new Error("Unable to verify PIN availability.");
  return Boolean(data && data.user_id !== exceptUserId);
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const allowedOrigins = [
    "https://codemathphp-website.vercel.app",
    "https://codemathphp.co.za",
    "https://www.codemathphp.co.za",
    "http://localhost:3000",
    "http://localhost:5173",
    ...(Deno.env.get("PIN_LOGIN_ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ];
  const allowedOrigin =
    origin && (allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin))
      ? origin
      : "https://www.codemathphp.co.za";
  if (origin && !allowedOrigins.includes(origin) && !/^http:\/\/localhost:\d+$/.test(origin))
    return response({ error: "Origin not allowed." }, 403, allowedOrigin);
  if (request.method === "OPTIONS")
    return new Response("ok", {
      headers: { ...corsHeaders, "Access-Control-Allow-Origin": allowedOrigin },
    });
  if (request.method !== "POST")
    return response({ error: "Method not allowed." }, 405, allowedOrigin);

  try {
    const { url, anonKey, serviceRoleKey } = environment();
    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const body = (await request.json()) as {
      action?: string;
      client_id?: string;
      client?: { name?: string; email?: string; phone?: string; company?: string };
      display_name?: string;
      pin?: string;
    };

    if (body.action === "bootstrap_admin") {
      const bootstrapSecret = Deno.env.get("PIN_ADMIN_BOOTSTRAP_SECRET");
      if (!bootstrapSecret || request.headers.get("x-bootstrap-key") !== bootstrapSecret) {
        return response(
          { error: "Administrator bootstrap is not authorized." },
          403,
          allowedOrigin,
        );
      }
      if (typeof body.pin !== "string" || !/^\d{6}$/.test(body.pin)) {
        return response({ error: "PIN must be exactly six digits." }, 400, allowedOrigin);
      }
      const { data: existingAdmins, error: adminCheckError } = await admin
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .limit(1);
      if (adminCheckError) throw new Error("Unable to verify the administrator account.");
      if (existingAdmins?.length)
        return response({ error: "An administrator is already configured." }, 409, allowedOrigin);

      const fingerprintSecret = Deno.env.get("PIN_FINGERPRINT_SECRET");
      if (!fingerprintSecret) throw new Error("PIN fingerprinting is not configured.");
      const pin = body.pin;
      const fingerprint = await pinFingerprint(pin, fingerprintSecret);
      if (await pinIsAssigned(admin, pin, fingerprintSecret)) {
        return response(
          { error: "This PIN is already assigned to an account." },
          409,
          allowedOrigin,
        );
      }
      const email = `${crypto.randomUUID()}@pin.codemathphp.co.za`;
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: pin,
        email_confirm: true,
        user_metadata: { display_name: body.display_name?.trim() || "System Administrator" },
      });
      if (createError || !created?.user)
        throw new Error("Unable to create the administrator account.");
      const userId = created.user.id;
      const { error: provisionError } = await admin.rpc("provision_pin_account", {
        p_user_id: userId,
        p_display_name: body.display_name?.trim() || "System Administrator",
        p_role: "admin",
        p_auth_email: email,
        p_pin: pin,
        p_pin_fingerprint: fingerprint,
        p_client_id: null,
        p_client: null,
      });
      if (provisionError) {
        await admin.auth.admin.deleteUser(userId);
        throw new Error("Unable to finish administrator setup.");
      }
      return response({ pin }, 200, allowedOrigin);
    }

    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer "))
      return response({ error: "Sign in as an administrator." }, 401, allowedOrigin);
    const accessToken = authorization.slice("Bearer ".length);
    const caller = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: userData, error: userError } = await caller.auth.getUser(accessToken);
    if (userError || !userData.user)
      return response({ error: "Your session is invalid. Sign in again." }, 401, allowedOrigin);
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role,active")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profileError) throw new Error("Unable to verify administrator access.");
    if (profile?.role !== "admin" || !profile.active)
      return response({ error: "Administrator access required." }, 403, allowedOrigin);
    if (body.action === "reset_client_pin") {
      if (!body.client_id)
        return response({ error: "Choose a client account." }, 400, allowedOrigin);
      if (typeof body.pin !== "string" || !/^\d{6}$/.test(body.pin))
        return response({ error: "Enter a new six-digit PIN." }, 400, allowedOrigin);
      const { data: clientProfile, error: clientError } = await admin
        .from("profiles")
        .select("id")
        .eq("client_id", body.client_id)
        .eq("role", "client")
        .eq("active", true)
        .maybeSingle();
      if (clientError) throw new Error("Unable to find the client account.");
      if (!clientProfile)
        return response({ error: "This client has no active PIN login." }, 404, allowedOrigin);

      const fingerprintSecret = Deno.env.get("PIN_FINGERPRINT_SECRET");
      if (!fingerprintSecret) throw new Error("PIN fingerprinting is not configured.");
      const pin = body.pin;
      if (await pinIsAssigned(admin, pin, fingerprintSecret, clientProfile.id)) {
        return response(
          { error: "This PIN is already assigned to another account." },
          409,
          allowedOrigin,
        );
      }
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(clientProfile.id, {
        password: pin,
      });
      if (authUpdateError) throw new Error("Unable to update the client's sign-in code.");
      const { error: pinUpdateError } = await admin.rpc("change_pin", {
        p_user_id: clientProfile.id,
        p_pin: pin,
        p_pin_fingerprint: await pinFingerprint(pin, fingerprintSecret),
      });
      if (pinUpdateError) {
        console.error(
          "The client PIN changed in Auth but its PIN record could not be updated.",
          pinUpdateError,
        );
        throw new Error(
          "The PIN update could not be completed. Contact support before sharing a new code.",
        );
      }
      return response({ pin }, 200, allowedOrigin);
    }
    if (body.action !== "create_client" || !body.client?.name?.trim()) {
      if (body.action !== "create_clerk" || !body.display_name?.trim()) {
        return response({ error: "Enter a client or staff name." }, 400, allowedOrigin);
      }
    }
    if (typeof body.pin !== "string" || !/^\d{6}$/.test(body.pin))
      return response({ error: "Enter a six-digit PIN for this account." }, 400, allowedOrigin);

    const fingerprintSecret = Deno.env.get("PIN_FINGERPRINT_SECRET");
    if (!fingerprintSecret) throw new Error("PIN fingerprinting is not configured.");
    const pin = body.pin;
    if (await pinIsAssigned(admin, pin, fingerprintSecret)) {
      return response(
        { error: "This PIN is already assigned to another account." },
        409,
        allowedOrigin,
      );
    }
    const email = `${crypto.randomUUID()}@pin.codemathphp.co.za`;
    const isClerk = body.action === "create_clerk";
    const displayName = isClerk ? body.display_name!.trim() : body.client!.name!.trim();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (createError || !created?.user) throw new Error("Unable to create the client login.");
    const userId = created.user.id;

    const { error: provisionError } = await admin.rpc("provision_pin_account", {
      p_user_id: userId,
      p_display_name: displayName,
      p_role: isClerk ? "clerk" : "client",
      p_auth_email: email,
      p_pin: pin,
      p_pin_fingerprint: await pinFingerprint(pin, fingerprintSecret),
      p_client_id: null,
      p_client: isClerk
        ? null
        : {
            name: displayName,
            email: body.client!.email?.trim() || null,
            phone: body.client!.phone?.trim() || null,
            company: body.client!.company?.trim() || null,
          },
    });
    if (provisionError) {
      await admin.auth.admin.deleteUser(userId);
      throw new Error("Unable to finish client account setup.");
    }
    return response({ pin }, 200, allowedOrigin);
  } catch (error) {
    console.error("Unable to manage PIN account.", error);
    return response(
      {
        error: error instanceof Error ? error.message : "Unable to complete the account operation.",
      },
      500,
      allowedOrigin,
    );
  }
});
