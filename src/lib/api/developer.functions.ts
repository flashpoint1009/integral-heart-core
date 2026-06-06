import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

const DEMO_USERS = [
  { email: "admin@demo.com", password: "Demo@2026", full_name: "المدير العام", role: "admin" as const },
  { email: "sales@demo.com", password: "Demo@2026", full_name: "مدير المبيعات", role: "sales_manager" as const },
  { email: "accountant@demo.com", password: "Demo@2026", full_name: "المحاسب", role: "accountant" as const },
  { email: "warehouse@demo.com", password: "Demo@2026", full_name: "أمين المخزن", role: "warehouse" as const },
  { email: "cashier@demo.com", password: "Demo@2026", full_name: "الكاشير", role: "cashier" as const },
  { email: "rep@demo.com", password: "Demo@2026", full_name: "المندوب", role: "sales_rep" as const },
  { email: "supervisor@demo.com", password: "Demo@2026", full_name: "المشرف الميداني", role: "supervisor" as const },
  { email: "hr@demo.com", password: "Demo@2026", full_name: "مسؤول الموارد البشرية", role: "hr" as const },
];

// ============================================
// Seed demo users - admin only
// ============================================
export const seedDemoUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    // Verify caller is admin or developer
    const { data: callerRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAuthorized = (callerRoles ?? []).some(
      (r) => r.role === "admin" || r.role === "developer"
    );
    if (!isAuthorized) throw new Error("Unauthorized: admin or developer only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: Array<{ email: string; status: string; error?: string }> = [];

    for (const u of DEMO_USERS) {
      try {
        // Create user
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.full_name },
        });
        if (createErr) {
          // If already exists, fetch the existing user
          if (createErr.message.toLowerCase().includes("already")) {
            const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
            const found = existing?.users.find((x) => x.email === u.email);
            if (!found) throw createErr;
            // Ensure role assigned
            await supabaseAdmin
              .from("user_roles")
              .upsert(
                { user_id: found.id, role: u.role, tenant_id: DEFAULT_TENANT_ID },
                { onConflict: "user_id,role" }
              );
            results.push({ email: u.email, status: "exists" });
            continue;
          }
          throw createErr;
        }
        const uid = created.user!.id;
        // Ensure correct role (handle_new_user trigger gives default 'cashier')
        await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: uid, role: u.role, tenant_id: DEFAULT_TENANT_ID });
        results.push({ email: u.email, status: "created" });
      } catch (e) {
        results.push({ email: u.email, status: "error", error: (e as Error).message });
      }
    }
    return { results };
  });

// ============================================
// Tenants CRUD - developer only
// ============================================
export const listTenants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { tenants: data ?? [] };
  });

export const createTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(1).max(200),
        slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
        contact_email: z.string().email().optional().nullable(),
        contact_phone: z.string().max(50).optional().nullable(),
        plan: z.enum(["basic", "standard", "enterprise"]).default("standard"),
        max_users: z.number().int().min(1).max(10000).default(50),
        modules: z.array(z.string()).default([]),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Check developer
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => r.role === "developer")) {
      throw new Error("Unauthorized: developer only");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tenant, error } = await supabaseAdmin
      .from("tenants")
      .insert({
        name: data.name,
        slug: data.slug ?? null,
        contact_email: data.contact_email ?? null,
        contact_phone: data.contact_phone ?? null,
        plan: data.plan,
        max_users: data.max_users,
      })
      .select()
      .single();
    if (error) throw error;
    // Seed modules
    if (data.modules.length) {
      await supabaseAdmin.from("tenant_modules").insert(
        data.modules.map((m) => ({
          tenant_id: tenant.id,
          module_key: m,
          enabled: true,
        }))
      );
    }
    return { tenant };
  });

export const updateTenantStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        tenant_id: z.string().uuid(),
        status: z.enum(["active", "suspended", "trial"]),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => r.role === "developer")) {
      throw new Error("Unauthorized");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("tenants")
      .update({ status: data.status })
      .eq("id", data.tenant_id);
    if (error) throw error;
    return { ok: true };
  });

// ============================================
// Modules toggle - developer or admin
// ============================================
export const toggleModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        tenant_id: z.string().uuid(),
        module_key: z.string().min(1).max(50),
        enabled: z.boolean(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAuthorized = (roles ?? []).some(
      (r) => r.role === "developer" || r.role === "admin"
    );
    if (!isAuthorized) throw new Error("Unauthorized");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("tenant_modules")
      .upsert(
        {
          tenant_id: data.tenant_id,
          module_key: data.module_key,
          enabled: data.enabled,
        },
        { onConflict: "tenant_id,module_key" }
      );
    if (error) throw error;
    return { ok: true };
  });

export const listTenantModules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tenant_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: modules, error } = await supabase
      .from("tenant_modules")
      .select("*")
      .eq("tenant_id", data.tenant_id);
    if (error) throw error;
    return { modules: modules ?? [] };
  });

// ============================================
// Promote a user to developer - admin only (initial setup)
// ============================================
export const promoteToDeveloper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => r.role === "admin" || r.role === "developer")) {
      throw new Error("Unauthorized");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.users.find((u) => u.email === data.email);
    if (!user) throw new Error("User not found");
    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: user.id, role: "developer", tenant_id: null },
        { onConflict: "user_id,role" }
      );
    return { ok: true };
  });

export const AVAILABLE_MODULES = [
  { key: "sales", label: "المبيعات", icon: "Receipt" },
  { key: "pos", label: "نقطة البيع (POS)", icon: "ShoppingCart" },
  { key: "inventory", label: "المخزون", icon: "Boxes" },
  { key: "purchases", label: "المشتريات", icon: "ShoppingBag" },
  { key: "accounting", label: "الحسابات والقيود", icon: "BookOpen" },
  { key: "finance", label: "الخزينة والبنوك", icon: "Wallet" },
  { key: "hr", label: "الموارد البشرية", icon: "UsersRound" },
  { key: "payroll", label: "الرواتب", icon: "DollarSign" },
  { key: "reps", label: "تطبيق المندوبين", icon: "MapPin" },
  { key: "supervisor", label: "إشراف ميداني", icon: "Map" },
  { key: "reports", label: "التقارير", icon: "BarChart3" },
  { key: "ai_forecast", label: "التوقعات الذكية (AI)", icon: "Sparkles" },
];