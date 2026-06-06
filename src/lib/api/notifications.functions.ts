import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ============ Branding (auth screen) ============
export const getAuthBranding = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("auth_branding").select("*").eq("id", 1).maybeSingle();
  return { branding: data };
});

export const updateAuthBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    logo_url?: string | null;
    hero_image_url?: string | null;
    title?: string;
    subtitle?: string;
    show_animation?: boolean;
    primary_gradient?: string;
  }) => z.object({
    logo_url: z.string().nullable().optional(),
    hero_image_url: z.string().nullable().optional(),
    title: z.string().max(120).optional(),
    subtitle: z.string().max(240).optional(),
    show_animation: z.boolean().optional(),
    primary_gradient: z.string().max(120).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const ok = (roles ?? []).some((r: any) => r.role === "developer" || r.role === "admin");
    if (!ok) throw new Error("Unauthorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("auth_branding").update({ ...data, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) throw error;
    return { ok: true };
  });

// ============ Push subscriptions ============
export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("app_secrets").select("value").eq("key", "vapid_public_key").maybeSingle();
  return { publicKey: data?.value ?? "" };
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { endpoint: string; p256dh: string; auth: string; user_agent?: string }) =>
    z.object({
      endpoint: z.string().url().max(2000),
      p256dh: z.string().min(1).max(500),
      auth: z.string().min(1).max(500),
      user_agent: z.string().max(500).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert({ user_id: context.userId, ...data }, { onConflict: "endpoint" });
    if (error) throw error;
    return { ok: true };
  });

export const deletePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { endpoint: string }) => z.object({ endpoint: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("push_subscriptions").delete().eq("user_id", context.userId).eq("endpoint", data.endpoint);
    return { ok: true };
  });

// ============ Send notification to user ============
async function sendWebPush(userId: string, payload: { title: string; body?: string; link?: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("*").eq("user_id", userId);
  if (!subs?.length) return { sent: 0 };

  const { data: vapPub } = await supabaseAdmin.from("app_secrets").select("value").eq("key", "vapid_public_key").maybeSingle();
  const { data: vapPriv } = await supabaseAdmin.from("app_secrets").select("value").eq("key", "vapid_private_key").maybeSingle();
  const { data: vapSub } = await supabaseAdmin.from("app_secrets").select("value").eq("key", "vapid_subject").maybeSingle();
  if (!vapPub?.value || !vapPriv?.value) return { sent: 0 };

  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(vapSub?.value ?? "mailto:admin@example.com", vapPub.value, vapPriv.value);

  let sent = 0;
  await Promise.all(
    subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 410 || e?.statusCode === 404) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }),
  );
  return { sent };
}

export const sendNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    user_id?: string;
    user_ids?: string[];
    role?: string;
    type: string;
    title: string;
    body?: string;
    link?: string;
  }) => z.object({
    user_id: z.string().uuid().optional(),
    user_ids: z.array(z.string().uuid()).optional(),
    role: z.string().optional(),
    type: z.string().min(1).max(60),
    title: z.string().min(1).max(200),
    body: z.string().max(1000).optional(),
    link: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let userIds: string[] = [];
    if (data.user_id) userIds = [data.user_id];
    if (data.user_ids?.length) userIds = [...userIds, ...data.user_ids];
    if (data.role) {
      const { data: rs } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", data.role);
      userIds = [...userIds, ...(rs ?? []).map((r: any) => r.user_id)];
    }
    userIds = Array.from(new Set(userIds));
    if (!userIds.length) return { created: 0, pushed: 0 };

    const rows = userIds.map((uid) => ({
      user_id: uid,
      sender_id: context.userId,
      type: data.type,
      title: data.title,
      body: data.body,
      link: data.link,
    }));
    await supabaseAdmin.from("notifications").insert(rows);

    let pushed = 0;
    for (const uid of userIds) {
      const r = await sendWebPush(uid, { title: data.title, body: data.body, link: data.link });
      pushed += r.sent;
    }
    return { created: userIds.length, pushed };
  });

// ============ List recipients (for the picker UI) ============
export const listRecipients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const allowed = (roles ?? []).some((r: any) => ["admin", "manager", "supervisor", "hr"].includes(r.role));
    if (!allowed) throw new Error("Unauthorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("profiles").select("id, full_name, email").order("full_name");
    return { users: data ?? [] };
  });

// ============ User notifications inbox ============
export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notifications")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { items: data ?? [] };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; all?: boolean }) => z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.all) {
      await context.supabase.from("notifications").update({ is_read: true }).eq("user_id", context.userId).eq("is_read", false);
    } else if (data.id) {
      await context.supabase.from("notifications").update({ is_read: true }).eq("id", data.id).eq("user_id", context.userId);
    }
    return { ok: true };
  });