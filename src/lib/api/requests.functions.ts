import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureEmp(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("employees").select("id").eq("user_id", userId).maybeSingle();
  if (data) return data.id;
  const { data: emp, error } = await supabase.rpc("ensure_employee_for_user", { _user_id: userId });
  if (error) throw new Error(error.message);
  return emp as string;
}

function diffDays(from: string, to: string): number {
  const a = new Date(from + "T00:00:00Z").getTime();
  const b = new Date(to + "T00:00:00Z").getTime();
  return Math.max(1, Math.floor((b - a) / 86400000) + 1);
}

// ---------- Employee (rep) side ----------

export const createLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      leave_type: z.enum(["annual", "casual", "sick", "unpaid", "other"]),
      from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reason: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const employee_id = await ensureEmp(context.supabase, context.userId);
    const days = diffDays(data.from_date, data.to_date);
    const { data: row, error } = await context.supabase
      .from("leave_requests")
      .insert({
        employee_id,
        leave_type: data.leave_type,
        from_date: data.from_date,
        to_date: data.to_date,
        days,
        reason: data.reason ?? null,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const createLatePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      request_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      late_minutes: z.number().int().min(1).max(480),
      reason: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const employee_id = await ensureEmp(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("late_permissions")
      .insert({
        employee_id,
        request_date: data.request_date,
        late_minutes: data.late_minutes,
        reason: data.reason ?? null,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const createAdvanceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      amount: z.number().positive().max(1_000_000),
      installments: z.number().int().min(1).max(36),
      reason: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const employee_id = await ensureEmp(context.supabase, context.userId);
    const monthly = Number((data.amount / data.installments).toFixed(2));
    const { data: row, error } = await context.supabase
      .from("salary_advances")
      .insert({
        employee_id,
        amount: data.amount,
        installments: data.installments,
        monthly_deduction: monthly,
        remaining: data.amount,
        reason: data.reason ?? null,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const listMyRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const employee_id = await ensureEmp(context.supabase, context.userId);
    const [leaves, lates, advances] = await Promise.all([
      context.supabase.from("leave_requests").select("*").eq("employee_id", employee_id).order("created_at", { ascending: false }).limit(50),
      context.supabase.from("late_permissions").select("*").eq("employee_id", employee_id).order("created_at", { ascending: false }).limit(50),
      context.supabase.from("salary_advances").select("*").eq("employee_id", employee_id).order("created_at", { ascending: false }).limit(50),
    ]);
    return {
      leaves: leaves.data ?? [],
      lates: lates.data ?? [],
      advances: advances.data ?? [],
    };
  });

// ---------- Supervisor / HR side ----------

export const listPendingRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [leaves, lates, advances] = await Promise.all([
      context.supabase.from("leave_requests").select("*, employees(full_name, employee_code)").order("created_at", { ascending: false }).limit(100),
      context.supabase.from("late_permissions").select("*, employees(full_name, employee_code)").order("created_at", { ascending: false }).limit(100),
      context.supabase.from("salary_advances").select("*, employees(full_name, employee_code)").order("created_at", { ascending: false }).limit(100),
    ]);
    return {
      leaves: leaves.data ?? [],
      lates: lates.data ?? [],
      advances: advances.data ?? [],
    };
  });

export const reviewRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      kind: z.enum(["leave", "late", "advance"]),
      id: z.string().uuid(),
      decision: z.enum(["approved", "rejected"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const table = data.kind === "leave" ? "leave_requests" : data.kind === "late" ? "late_permissions" : "salary_advances";
    const { error } = await context.supabase
      .from(table)
      .update({
        status: data.decision,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });