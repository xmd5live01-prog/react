import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://xmd5live01-prog.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const allowedOrigins = new Set(
  (Deno.env.get("ALLOWED_ORIGINS") ?? DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
};

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: HeadersInit = {},
  origin?: string,
) {
  const headers = new Headers({
    ...corsHeaders,
    "Content-Type": "application/json",
    ...extraHeaders,
  });
  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return new Response(JSON.stringify(body), { status, headers });
}

function getClientIp(req: Request) {
  const cloudflareIp = req.headers.get("cf-connecting-ip")?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  const forwardedIps = req.headers.get("x-forwarded-for")?.split(",");
  const forwardedIp = forwardedIps?.at(-1)?.trim();
  const ip = cloudflareIp || realIp || forwardedIp;

  if (!ip || ip.length > 64 || !/^[\da-f:.]+$/i.test(ip)) {
    return null;
  }
  return ip.toLowerCase();
}

async function createBucketKey(secret: string, value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? undefined;

  if (!origin || !allowedOrigins.has(origin)) {
    return jsonResponse({ error: "Origin not allowed." }, 403);
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Origin": origin,
      },
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, {}, origin);
  }

  let input: Record<string, unknown>;
  if (req.method === "GET") {
    const params = new URL(req.url).searchParams;
    input = {
      customerId: params.get("customerId"),
      lastNameLetters: params.get("lastNameLetters"),
    };
  } else {
    let bodyText: string;
    try {
      bodyText = await req.text();
    } catch {
      return jsonResponse({ error: "Invalid request." }, 400, {}, origin);
    }
    if (new TextEncoder().encode(bodyText).length > 4096) {
      return jsonResponse({ error: "Invalid request." }, 413, {}, origin);
    }

    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return jsonResponse({ error: "Invalid request." }, 400, {}, origin);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ error: "Invalid request." }, 400, {}, origin);
    }
    input = body as Record<string, unknown>;
  }

  const customerId = typeof input.customerId === "string"
    ? input.customerId.trim()
    : "";
  const prefix = typeof input.lastNameLetters === "string"
    ? input.lastNameLetters.trim().toUpperCase()
    : "";
  const captchaToken = typeof input.captchaToken === "string"
    ? input.captchaToken.trim()
    : "";

  if (
    customerId.length > 32 ||
    !/^\d+$/.test(customerId) ||
    !/^\p{L}{2}$/u.test(prefix) ||
    captchaToken.length > 2048
  ) {
    return jsonResponse({ error: "Invalid account details." }, 400, {}, origin);
  }

  const clientIp = getClientIp(req);
  if (!clientIp) {
    return jsonResponse(
      { error: "Unable to process the request. Please try again later." },
      503,
      {},
      origin,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Bill lookup function is missing Supabase environment variables.");
    return jsonResponse(
      { error: "Unable to process the request. Please try again later." },
      503,
      {},
      origin,
    );
  }

  try {
    const [ipBucketKey, accountBucketKey] = await Promise.all([
      createBucketKey(serviceRoleKey, `ip:${clientIp}`),
      createBucketKey(serviceRoleKey, `account:${clientIp}:${customerId}`),
    ]);
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: limits, error: limitError } = await supabase.rpc(
      "consume_bill_lookup_limits",
      {
        p_ip_bucket_key: ipBucketKey,
        p_account_bucket_key: accountBucketKey,
      },
    );

    if (limitError) {
      console.error("Bill lookup rate limit check failed:", limitError.message);
      return jsonResponse(
        { error: "Unable to process the request. Please try again later." },
        503,
        {},
        origin,
      );
    }

    const limit = limits?.[0];
    if (!limit) {
      console.error("Bill lookup rate limit returned no result.");
      return jsonResponse(
        { error: "Unable to process the request. Please try again later." },
        503,
        {},
        origin,
      );
    }
    if (!limit.allowed) {
      return jsonResponse(
        { error: "Too many lookup attempts. Please wait before trying again." },
        429,
        { "Retry-After": String(limit?.retry_after_seconds ?? 60) },
        origin,
      );
    }

    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (turnstileSecret && !captchaToken) {
      return jsonResponse(
        { error: "Complete the verification challenge and try again." },
        403,
        {},
        origin,
      );
    }

    if (turnstileSecret) {
      const verification = new URLSearchParams({
        secret: turnstileSecret,
        response: captchaToken,
        remoteip: clientIp,
      });
      const verificationResponse = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: verification,
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!verificationResponse.ok) {
        console.error("Turnstile verification service returned an error.");
        return jsonResponse(
          { error: "Unable to verify this request. Please try again." },
          503,
          {},
          origin,
        );
      }
      const verificationResult = await verificationResponse.json();
      if (
        !verificationResult.success ||
        verificationResult.hostname !== new URL(origin).hostname
      ) {
        return jsonResponse(
          { error: "Complete the verification challenge and try again." },
          403,
          {},
          origin,
        );
      }
    }

    const { data: customer, error: customerError } = await supabase
      .schema("wbs")
      .from("customer")
      .select("*")
      .eq("customer_info_id", customerId)
      .ilike("last_name", `${prefix}%`)
      .maybeSingle();

    if (customerError) {
      console.error("Bill lookup customer query failed:", customerError.message);
      return jsonResponse(
        { error: "Unable to process the request. Please try again later." },
        503,
        {},
        origin,
      );
    }
    if (!customer) {
      return jsonResponse(null, 200, {}, origin);
    }

    const customerRef = customer.idcustomer ?? customer.customer_info_id;
    const { data: meterRows, error: meterError } = await supabase
      .schema("wbs")
      .from("meter_reading")
      .select(
        "meter_reading_id, idcustomer, prev_r_date, prev_r_value, pres_r_date, pres_r_value, water_consume, amount, due_date, payment_status",
      )
      .eq("idcustomer", customerRef)
      .order("pres_r_date", { ascending: false })
      .limit(6);

    if (meterError) {
      console.error("Bill lookup meter query failed:", meterError.message);
      return jsonResponse(
        { error: "Unable to process the request. Please try again later." },
        503,
        {},
        origin,
      );
    }

    const lastName = String(customer.last_name ?? "").trim();
    const fullName = [customer.first_name, customer.middle_name, lastName]
      .filter(Boolean)
      .join(" ");

    return jsonResponse({
      customer: {
        customerId: String(customer.customer_info_id ?? customerRef),
        lastName,
        name: fullName || lastName,
        address: customer.address ?? customer.street_address ?? "",
        meterNo: customer.meter_no ?? customer.meter_number ?? "N/A",
        accountType: customer.account_type ?? "Residential",
      },
      bills: (meterRows ?? []).map((row, index) => {
        const rawStatus = String(row.payment_status ?? "Unpaid").trim()
          .toLowerCase();
        const status = rawStatus === "paid" || rawStatus === "1"
          ? "Paid"
          : rawStatus === "overdue"
          ? "Overdue"
          : "Unpaid";

        return {
          id: row.meter_reading_id ?? `B-${index + 1}`,
          period: row.pres_r_date ?? `Billing ${index + 1}`,
          previousReading: Number(row.prev_r_value ?? 0),
          currentReading: Number(row.pres_r_value ?? 0),
          consumption: Number(row.water_consume ?? 0),
          amount: Number(row.amount ?? 0),
          dueDate: row.due_date ?? new Date().toISOString().slice(0, 10),
          status,
        };
      }),
    }, 200, {}, origin);
  } catch (error) {
    console.error(
      "Bill lookup request failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return jsonResponse(
      { error: "Unable to process the request. Please try again later." },
      503,
      {},
      origin,
    );
  }
});
