import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200, origin = "https://codemathphp.co.za") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Access-Control-Allow-Origin": origin,
      "Content-Type": "application/json",
    },
  });
}

async function hashIp(ip: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const allowedOrigins = [
    "https://codemathphp-website.vercel.app",
    "https://codemathphp.co.za",
    "http://localhost:3000",
    "http://localhost:5173",
    ...(Deno.env.get("PIN_LOGIN_ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ];
  const allowedOrigin =
    origin && allowedOrigins.includes(origin) ? origin : "https://codemathphp.co.za";
  if (origin && !allowedOrigins.includes(origin))
    return response({ error: "Origin not allowed." }, 403, allowedOrigin);
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: { ...corsHeaders, "Access-Control-Allow-Origin": allowedOrigin },
    });
  }
  if (request.method !== "POST")
    return response({ error: "Method not allowed." }, 405, allowedOrigin);

  let pin: unknown;
  try {
    ({ pin } = await request.json());
  } catch {
    return response({ error: "Invalid request." }, 400, allowedOrigin);
  }
  if (typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
    return response({ error: "Enter your 6-digit PIN." }, 400, allowedOrigin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const rateLimitSecret = Deno.env.get("PIN_RATE_LIMIT_SECRET");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !rateLimitSecret) {
    console.error("PIN login function is missing required environment variables.");
    return response({ error: "Sign-in is temporarily unavailable." }, 500, allowedOrigin);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anonymous = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const ipHash = await hashIp(ip, rateLimitSecret);

  const { data: blocked, error: limitError } = await admin.rpc("is_pin_login_blocked", {
    p_ip_hash: ipHash,
  });
  if (limitError) {
    console.error("Unable to check PIN login rate limit.", limitError);
    return response({ error: "Sign-in is temporarily unavailable." }, 500, allowedOrigin);
  }
  if (blocked)
    return response({ error: "Too many attempts. Try again in 15 minutes." }, 429, allowedOrigin);

  const { data: email, error: lookupError } = await admin.rpc("pin_account_for_login", {
    p_pin: pin,
  });
  if (lookupError) {
    console.error("Unable to look up the PIN account.", lookupError);
    return response({ error: "Sign-in is temporarily unavailable." }, 500, allowedOrigin);
  }
  if (typeof email !== "string") {
    const { error } = await admin.rpc("record_pin_login_failure", { p_ip_hash: ipHash });
    if (error) console.error("Unable to record failed PIN login.", error);
    return response(
      { error: "The PIN is incorrect or the account is unavailable." },
      401,
      allowedOrigin,
    );
  }

  const { data, error: authError } = await anonymous.auth.signInWithPassword({
    email,
    password: pin,
  });
  if (authError || !data.session) {
    const { error } = await admin.rpc("record_pin_login_failure", { p_ip_hash: ipHash });
    if (error) console.error("Unable to record failed PIN login.", error);
    if (authError) console.error("PIN account authentication failed.", authError);
    return response(
      { error: "The PIN is incorrect or the account is unavailable." },
      401,
      allowedOrigin,
    );
  }

  const { error: clearError } = await admin.rpc("clear_pin_login_failures", { p_ip_hash: ipHash });
  if (clearError) console.error("Unable to clear PIN login failures.", clearError);
  return response({ session: data.session }, 200, allowedOrigin);
});
