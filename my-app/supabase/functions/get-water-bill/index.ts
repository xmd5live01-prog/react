import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const url = new URL(req.url);
    const customerId = url.searchParams.get("customerId")?.trim() ?? "";
    const prefix = url.searchParams.get("lastNameLetters")?.trim().toUpperCase() ?? "";

    if (!/^\d+$/.test(customerId) || !/^\p{L}{2}$/u.test(prefix)) {
      return jsonResponse({ error: "Enter a valid customer ID and the first two letters of the last name." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase function environment variables are not configured." }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: customer, error: customerError } = await supabase
      .schema("wbs")
      .from("customer")
      .select("*")
      .eq("customer_info_id", customerId)
      .ilike("last_name", `${prefix}%`)
      .maybeSingle();

    if (customerError) {
      return jsonResponse({ error: customerError.message }, 500);
    }
    if (!customer) {
      return jsonResponse(null, 404);
    }

    const customerRef = customer.idcustomer ?? customer.customer_info_id;
    const { data: meterRows, error: meterError } = await supabase
      .schema("wbs")
      .from("meter_reading")
      .select("meter_reading_id, idcustomer, prev_r_date, prev_r_value, pres_r_date, pres_r_value, water_consume, amount, due_date, payment_status")
      .eq("idcustomer", customerRef)
      .order("pres_r_date", { ascending: false })
      .limit(6);

    if (meterError) {
      return jsonResponse({ error: meterError.message }, 500);
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
        const rawStatus = String(row.payment_status ?? "Unpaid").trim().toLowerCase();
        const dueDate = String(row.due_date ?? "").slice(0, 10);
        const isPastDue = Boolean(dueDate) && dueDate < new Date().toISOString().slice(0, 10);
        const status = rawStatus === "paid" || rawStatus === "1"
          ? "Paid"
          : rawStatus === "overdue" || isPastDue
          ? "Overdue"
          : "Unpaid";

        return {
          id: row.meter_reading_id ?? `B-${index + 1}`,
          period: row.pres_r_date ?? `Billing ${index + 1}`,
          previousReading: Number(row.prev_r_value ?? 0),
          currentReading: Number(row.pres_r_value ?? 0),
          consumption: Number(row.water_consume ?? 0),
          amount: Number(row.amount ?? 0),
          dueDate: dueDate || new Date().toISOString().slice(0, 10),
          status,
        };
      }),
    });
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});