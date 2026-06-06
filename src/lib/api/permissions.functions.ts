import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// List users in the same tenant with their roles and permission overrides
export const listTenantUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role, tenant_id");
    const userIds = [...new Set((roles ?? []).map((r) => r.user_id as string))];
    if (userIds.length === 0) return { users: [] };

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);
    const { data: perms } = await supabase
      .from("user_screen_permissions")
      .select("user_id, screen_key, allowed")
      .in("user_id", userIds);

    const users = userIds.map((id) => {
      const p = profiles?.find((x) => x.id === id);
      const rs = (roles ?? []).filter((r) => r.user_id === id).map((r) => r.role as string);
      const tid = (roles ?? []).find((r) => r.user_id === id && r.tenant_id)?.tenant_id as string | null;
      const overrides = (perms ?? [])
        .filter((x) => x.user_id === id)
        .map((x) => ({ screen_key: x.screen_key as string, allowed: x.allowed as boolean }));
      return {
        id,
        email: p?.email ?? "—",
        full_name: p?.full_name ?? p?.email ?? "—",
        roles: rs,
        tenant_id: tid,
        overrides,
      };
    });
    return { users };
  });

const SetPermInput = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  screen_key: z.string().min(1).max(100),
  allowed: z.boolean(),
});

export const setScreenPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SetPermInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_screen_permissions")
      .upsert(
        { user_id: data.user_id, tenant_id: data.tenant_id, screen_key: data.screen_key, allowed: data.allowed, created_by: userId },
        { onConflict: "user_id,screen_key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetScreenPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), screen_key: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_screen_permissions")
      .delete()
      .eq("user_id", data.user_id)
      .eq("screen_key", data.screen_key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });