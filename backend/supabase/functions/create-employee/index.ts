import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type Role = "admin" | "hr" | "employee";

type CreateEmployeeInput = {
  first_name?: unknown;
  last_name?: unknown;
  work_email?: unknown;
  job_position?: unknown;
  department?: unknown;
  location?: unknown;
  date_of_joining?: unknown;
  monthly_wage?: unknown;
  manager_id?: unknown;
  role?: unknown;
};

const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const optionalText = (value: unknown): string | null => text(value) || null;
const validRole = (value: unknown): value is Role =>
  value === "admin" || value === "hr" || value === "employee";

function randomPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  return `Df!7${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}

const fail = (message: string, status = 400) => Response.json({ message }, { status });

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return fail("Method not allowed.", 405);

    let body: CreateEmployeeInput;
    try {
      body = await req.json();
    } catch {
      return fail("Enter the employee details.");
    }

    const firstName = text(body.first_name);
    const lastName = text(body.last_name);
    const email = text(body.work_email).toLowerCase();
    const joiningDate = text(body.date_of_joining);
    const wage = typeof body.monthly_wage === "number" ? body.monthly_wage : Number.NaN;
    if (!firstName || !lastName) return fail("Enter the employee's full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid work email.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(joiningDate)) return fail("Enter a valid joining date.");
    if (!Number.isFinite(wage) || wage < 0) return fail("Enter a valid monthly wage.");
    if (!validRole(body.role)) return fail("Choose a valid access level.");

    const { data: authData, error: authError } = await ctx.supabase.auth.getUser();
    if (authError || !authData.user) return fail("Authentication is required.", 401);

    const { data: caller, error: callerError } = await ctx.supabase
      .from("employees")
      .select("id, company_id, role, is_active")
      .eq("id", authData.user.id)
      .single();
    if (callerError || !caller || !caller.is_active || !["admin", "hr"].includes(caller.role)) {
      return fail("Only an active Admin or HR employee can create accounts.", 403);
    }

    const managerId = optionalText(body.manager_id);
    if (managerId) {
      const { data: manager } = await ctx.supabaseAdmin
        .from("employees")
        .select("id")
        .eq("id", managerId)
        .eq("company_id", caller.company_id)
        .eq("is_active", true)
        .maybeSingle();
      if (!manager) return fail("Choose an active manager from your company.");
    }

    const temporaryPassword = randomPassword();

    const { data: createdAuth, error: createAuthError } = await ctx.supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { registration_type: "employee" },
    });
    if (createAuthError || !createdAuth.user) {
      return fail("Could not create that account. The work email may already be in use.", 409);
    }

    const profile = {
      id: createdAuth.user.id,
      company_id: caller.company_id,
      role: body.role,
      first_name: firstName,
      last_name: lastName,
      work_email: email,
      job_position: optionalText(body.job_position),
      department: optionalText(body.department),
      location: optionalText(body.location),
      manager_id: managerId,
      date_of_joining: joiningDate,
      monthly_wage: wage,
      must_change_password: true,
    };

    const { data: employee, error: insertError } = await ctx.supabaseAdmin
      .from("employees")
      .insert(profile)
      .select("*")
      .single();

    if (insertError || !employee) {
      await ctx.supabaseAdmin.auth.admin.deleteUser(createdAuth.user.id);
      return fail("The account could not be linked to an employee profile.", 500);
    }

    return Response.json({
      employee,
      temporaryPassword,
    });
  }),
};
