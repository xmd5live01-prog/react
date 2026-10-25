import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://xmd5live01-prog.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
];

const allowedOrigins = new Set(
  (Deno.env.get("ALLOWED_ORIGINS") ?? DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const allowedPermissions = new Set([
  "edit_sections",
  "edit_layout",
  "edit_site_settings",
  "save_draft",
  "publish_content",
  "restore_revisions",
]);

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function jsonResponse(body: unknown, status = 200, origin?: string) {
  const headers = new Headers({
    ...corsHeaders,
    "Content-Type": "application/json",
  });
  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return new Response(JSON.stringify(body), { status, headers });
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

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, origin);
  }

  const authorization = req.headers.get("authorization") ?? "";
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return jsonResponse({ error: "Sign in as an Administrator to continue." }, 401, origin);
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > 8192) {
    return jsonResponse({ error: "Request body is too large." }, 413, origin);
  }

  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    return jsonResponse({ error: "Unable to read request body." }, 400, origin);
  }
  if (new TextEncoder().encode(bodyText).length > 8192) {
    return jsonResponse({ error: "Request body is too large." }, 413, origin);
  }

  let input: unknown;
  try {
    input = JSON.parse(bodyText);
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400, origin);
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return jsonResponse({ error: "Invalid request body." }, 400, origin);
  }

  const body = input as Record<string, unknown>;
  const action = body.action;
  if (action === "set_active") {
    const userId = typeof body.userId === "string" ? body.userId : "";
    const active = body.active;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return jsonResponse({ error: "Choose a valid CMS user." }, 400, origin);
    }
    if (typeof active !== "boolean") {
      return jsonResponse({ error: "Choose whether the CMS user should be active." }, 400, origin);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("CMS user management is missing Supabase environment variables.");
      return jsonResponse({ error: "User management is not configured on the server." }, 503, origin);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: callerResult, error: callerError } = await supabase.auth.getUser(accessToken);
    if (callerError || !callerResult.user) {
      return jsonResponse({ error: "Your sign-in session is invalid or expired." }, 401, origin);
    }

    const { data: updatedUsers, error: updateError } = await supabase.rpc(
      "cms_set_user_active",
      {
        p_actor_id: callerResult.user.id,
        p_user_id: userId,
        p_active: active,
      },
    );
    if (updateError) {
      const status = updateError.code === "42501" ? 403 : 400;
      return jsonResponse({ error: updateError.message }, status, origin);
    }

    const updatedUser = updatedUsers?.[0];
    if (!updatedUser) {
      return jsonResponse({ error: "The CMS user status could not be updated." }, 500, origin);
    }

    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
      userId,
      { ban_duration: active ? "none" : "876000h" },
    );
    if (authUpdateError) {
      const { error: rollbackError } = await supabase.rpc("cms_set_user_active", {
        p_actor_id: callerResult.user.id,
        p_user_id: userId,
        p_active: !active,
      });
      if (rollbackError) {
        console.error("Could not roll back CMS access after Auth status update failed:", rollbackError.message);
      }
      console.error("Supabase Auth status update failed:", authUpdateError.message);
      return jsonResponse({
        error: rollbackError
          ? "The account status could not be synchronized. Contact support before retrying."
          : "The account status was not changed because Supabase Auth could not update the user.",
      }, 500, origin);
    }

    return jsonResponse({ user: updatedUser }, 200, origin);
  }

  if (action === "reset_password") {
    const userId = typeof body.userId === "string" ? body.userId : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return jsonResponse({ error: "Choose a valid CMS user." }, 400, origin);
    }
    if (password.length < 12 || password.length > 72) {
      return jsonResponse({ error: "Temporary passwords must be 12 to 72 characters long." }, 400, origin);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("CMS user management is missing Supabase environment variables.");
      return jsonResponse({ error: "User management is not configured on the server." }, 503, origin);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: callerResult, error: callerError } = await supabase.auth.getUser(accessToken);
    if (callerError || !callerResult.user) {
      return jsonResponse({ error: "Your sign-in session is invalid or expired." }, 401, origin);
    }

    const { data: callerRole, error: roleError } = await supabase
      .from("cms_users")
      .select("role,active")
      .eq("user_id", callerResult.user.id)
      .maybeSingle();
    if (roleError) {
      console.error("CMS administrator authorization check failed:", roleError.message);
      return jsonResponse({ error: "Unable to verify Administrator access." }, 500, origin);
    }
    if (callerRole?.role !== "admin" || !callerRole.active) {
      return jsonResponse({ error: "Administrator access is required to reset passwords." }, 403, origin);
    }
    if (userId === callerResult.user.id) {
      return jsonResponse({ error: "Use the password recovery option to change your own password." }, 400, origin);
    }

    const { data: targetUser, error: targetError } = await supabase
      .from("cms_users")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();
    if (targetError) {
      console.error("CMS user lookup failed during password reset:", targetError.message);
      return jsonResponse({ error: "Unable to find the CMS user." }, 500, origin);
    }
    if (!targetUser) {
      return jsonResponse({ error: "CMS user not found." }, 404, origin);
    }

    const { error: passwordError } = await supabase.auth.admin.updateUserById(
      userId,
      { password },
    );
    if (passwordError) {
      return jsonResponse({ error: passwordError.message }, 400, origin);
    }

    return jsonResponse({ user: { email: targetUser.email } }, 200, origin);
  }

  if (action !== undefined && action !== "create") {
    return jsonResponse({ error: "Choose a supported user-management action." }, 400, origin);
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role;
  const permissions = body.permissions;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return jsonResponse({ error: "Enter a valid email address." }, 400, origin);
  }
  if (password.length < 12 || password.length > 72) {
    return jsonResponse({ error: "Temporary passwords must be 12 to 72 characters long." }, 400, origin);
  }
  if (role !== "admin" && role !== "editor") {
    return jsonResponse({ error: "Choose Administrator or Editor." }, 400, origin);
  }
  if (
    !Array.isArray(permissions)
    || permissions.some((permission) =>
      typeof permission !== "string" || !allowedPermissions.has(permission)
    )
  ) {
    return jsonResponse({ error: "The selected permissions are invalid." }, 400, origin);
  }
  if (role === "admin" && permissions.length > 0) {
    return jsonResponse({ error: "Administrator permissions are assigned automatically." }, 400, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("CMS user management is missing Supabase environment variables.");
    return jsonResponse({ error: "User management is not configured on the server." }, 503, origin);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: callerResult, error: callerError } = await supabase.auth.getUser(accessToken);
  if (callerError || !callerResult.user) {
    return jsonResponse({ error: "Your sign-in session is invalid or expired." }, 401, origin);
  }

  const { data: callerRole, error: roleError } = await supabase
    .from("cms_users")
    .select("role,active")
    .eq("user_id", callerResult.user.id)
    .maybeSingle();
  if (roleError) {
    console.error("CMS administrator authorization check failed:", roleError.message);
    return jsonResponse({ error: "Unable to verify Administrator access." }, 500, origin);
  }
  if (callerRole?.role !== "admin" || !callerRole.active) {
    return jsonResponse({ error: "Administrator access is required to add users." }, 403, origin);
  }

  const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) {
    return jsonResponse({ error: createError.message }, 400, origin);
  }
  if (!createdUser.user) {
    console.error("Supabase Auth created no user for a successful CMS user request.");
    return jsonResponse({ error: "The user account could not be created." }, 500, origin);
  }

  const { error: assignmentError } = await supabase.from("cms_users").insert({
    user_id: createdUser.user.id,
    email,
    role,
    permissions: role === "admin" ? [] : permissions,
    created_by: callerResult.user.id,
  });
  if (assignmentError) {
    const { error: cleanupError } = await supabase.auth.admin.deleteUser(createdUser.user.id);
    if (cleanupError) {
      console.error("Could not remove an unassigned CMS Auth user:", cleanupError.message);
    }
    console.error("CMS role assignment failed:", assignmentError.message);
    return jsonResponse({
      error: cleanupError
        ? "The Auth account exists but its CMS role could not be assigned. Contact support before retrying."
        : "CMS role assignment failed, and the new Auth account was removed. Please retry.",
    }, 500, origin);
  }

  return jsonResponse({ user: { email, role, permissions: role === "admin" ? [] : permissions } }, 201, origin);
});
