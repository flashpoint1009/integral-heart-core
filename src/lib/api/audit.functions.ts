import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertDeveloper(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => r.role === "developer");
  if (!ok) throw new Error("Unauthorized: developer only");
}

export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { table?: string; user_id?: string; action?: string; from?: string; to?: string; limit?: number }) =>
    z.object({
      table: z.string().optional(),
      user_id: z.string().optional(),
      action: z.enum(["INSERT", "UPDATE", "DELETE"]).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertDeveloper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("audit_log").select("*").order("created_at", { ascending: false }).limit(data.limit);
    if (data.table) q = q.eq("table_name", data.table);
    if (data.user_id) q = q.eq("user_id", data.user_id);
    if (data.action) q = q.eq("action", data.action);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw error;
    return { rows: rows ?? [] };
  });

export const listAuditTables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertDeveloper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("audit_log").select("table_name").limit(5000);
    const tables = Array.from(new Set((data ?? []).map((r: any) => r.table_name))).sort();
    return { tables };
  });

export const deleteAuditEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertDeveloper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("audit_log").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const clearAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { before?: string }) => z.object({ before: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertDeveloper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("audit_log").delete();
    if (data.before) q = q.lt("created_at", data.before);
    else q = q.gt("created_at", "1900-01-01");
    const { error } = await q;
    if (error) throw error;
    return { ok: true };
  });