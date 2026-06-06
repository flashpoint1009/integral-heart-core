import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BACKUP_TABLES = [
  "tenants", "tenant_modules", "profiles", "user_roles", "user_screen_permissions",
  "company_settings", "site_config",
  "categories", "products", "warehouses", "inventory", "stock_movements",
  "customers", "suppliers",
  "sales_invoices", "sales_invoice_items", "customer_payments",
  "supplier_payments",
  "online_orders", "online_order_items",
  "expenses", "expense_categories", "accounts", "account_transfers",
  "payment_methods", "payments",
  "chart_accounts", "journal_entries", "journal_entry_lines",
  "employees", "attendance", "leave_requests", "late_permissions",
  "salary_advances", "penalties", "bonuses", "payroll_runs", "payroll_items",
  "rep_check_ins", "rep_routes", "rep_visits",
] as const;

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => r.role === "admin" || r.role === "developer");
  if (!ok) throw new Error("Unauthorized: admin or developer only");
}

export const listBackupTables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return { tables: BACKUP_TABLES as readonly string[] };
  });

export const exportFullBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: Record<string, any[]> = {};
    const counts: Record<string, number> = {};
    for (const t of BACKUP_TABLES) {
      const { data, error } = await (supabaseAdmin as any).from(t).select("*");
      if (error) { out[t] = []; counts[t] = 0; continue; }
      out[t] = data ?? [];
      counts[t] = (data ?? []).length;
    }
    return {
      version: 1,
      exported_at: new Date().toISOString(),
      exported_by: context.userId,
      counts,
      data: out,
    };
  });

export const exportTableCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { table: string }) =>
    z.object({ table: z.string().min(1).max(64) }).parse(d)
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (!(BACKUP_TABLES as readonly string[]).includes(data.table)) {
      throw new Error("Unknown table");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any).from(data.table).select("*");
    if (error) throw new Error(error.message);
    const list: any[] = (rows as any[]) ?? [];
    if (list.length === 0) return { csv: "", count: 0 };
    const headerSet = new Set<string>();
    list.forEach((r) => Object.keys(r).forEach((k) => headerSet.add(k)));
    const headers: string[] = Array.from(headerSet);
    const esc = (v: any) => {
      if (v === null || v === undefined) return "";
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.join(","),
      ...list.map((r: any) => headers.map((h) => esc(r[h])).join(",")),
    ].join("\n");
    return { csv, count: list.length };
  });

export const restoreFromJson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { payload: any; mode: "merge" | "replace" }) =>
    z.object({
      payload: z.object({ version: z.number(), data: z.record(z.string(), z.array(z.any())) }),
      mode: z.enum(["merge", "replace"]),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: Array<{ table: string; inserted: number; error?: string }> = [];
    for (const t of BACKUP_TABLES) {
      const rows = data.payload.data[t];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      try {
        if (data.mode === "replace") {
          await (supabaseAdmin as any).from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        }
        const { error } = await (supabaseAdmin as any).from(t).upsert(rows, { onConflict: "id" });
        if (error) results.push({ table: t, inserted: 0, error: error.message });
        else results.push({ table: t, inserted: rows.length });
      } catch (e: any) {
        results.push({ table: t, inserted: 0, error: e.message });
      }
    }
    return { results };
  });