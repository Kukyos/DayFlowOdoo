import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type SignInInput = { login_id?: unknown; password?: unknown };

const invalidCredentials = () => Response.json(
  { message: "Those details do not match an account." },
  { status: 400 },
);

export default {
  // This endpoint is intentionally public because it is the credential check.
  // It returns a session only after Supabase Auth verifies the supplied password.
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    if (req.method !== "POST") return invalidCredentials();

    let body: SignInInput;
    try {
      body = await req.json();
    } catch {
      return invalidCredentials();
    }

    const loginId = typeof body.login_id === "string" ? body.login_id.trim().toUpperCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[A-Z0-9]+-\d{6,}$/.test(loginId) || !password) return invalidCredentials();

    const { data: employee, error: employeeError } = await ctx.supabaseAdmin
      .from("employees")
      .select("work_email, is_active")
      .eq("login_id", loginId)
      .maybeSingle();
    if (employeeError || !employee || !employee.is_active) return invalidCredentials();

    const { data, error } = await ctx.supabaseAdmin.auth.signInWithPassword({
      email: employee.work_email,
      password,
    });
    if (error || !data.session) return invalidCredentials();

    return Response.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  }),
};
