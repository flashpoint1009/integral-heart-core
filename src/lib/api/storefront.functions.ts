import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001";

/** Convert a bucket path (or pass-through full URL) into a signed URL.
 *  Returns the original string for empty/null/full http(s) URLs. */
async function signIfPath(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage.from("store-images").createSignedUrl(value, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}

async function signAllImages<T extends Record<string, any>>(cfg: T): Promise<T> {
  const copy: any = { ...cfg };
  copy.logo_url = await signIfPath(cfg.logo_url);
  copy.hero_image = await signIfPath(cfg.hero_image);
  if (Array.isArray(cfg.banners)) {
    copy.banners = await Promise.all(
      (cfg.banners as any[]).map(async (b) => ({ ...b, image: await signIfPath(b?.image) })),
    );
  }
  if (Array.isArray(cfg.sections)) {
    copy.sections = await Promise.all(
      (cfg.sections as any[]).map(async (s) => {
        if (!s?.props) return s;
        const p: any = { ...s.props };
        if (p.image) p.image = await signIfPath(p.image);
        if (p.url) p.url = await signIfPath(p.url);
        return { ...s, props: p };
      }),
    );
  }
  return copy;
}

async function signProductImages(products: any[]): Promise<any[]> {
  return Promise.all(products.map(async (p) => ({ ...p, image_url: await signIfPath(p.image_url) })));
}

export const getSiteConfigPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cfg } = await supabaseAdmin
    .from("site_config")
    .select("*")
    .eq("tenant_id", DEFAULT_TENANT)
    .maybeSingle();
  const { data: cats } = await supabaseAdmin
    .from("categories")
    .select("id, name_ar, name_en")
    .order("name_ar");
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, name_ar, name_en, sale_price, image_url, category_id, description")
    .eq("is_active", true)
    .limit(200);
  const signedCfg = cfg ? await signAllImages(cfg) : null;
  const signedProducts = await signProductImages(products ?? []);
  return { config: signedCfg, categories: cats ?? [], products: signedProducts };
});

export const saveSiteConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      site_name: z.string().min(1).max(200),
      logo_url: z.string().max(500).nullable().optional(),
      primary_color: z.string().max(20),
      secondary_color: z.string().max(20).nullable().optional(),
      theme_preset: z.enum(["modern", "elegant", "bold", "minimal", "classic"]).default("modern"),
      card_shape: z.enum(["square", "rounded", "circle"]),
      contact_phone: z.string().max(40).nullable().optional(),
      contact_address: z.string().max(500).nullable().optional(),
      enable_search: z.boolean().default(true),
      enable_menu: z.boolean().default(true),
      nav_items: z.array(z.object({
        id: z.string(),
        label: z.string().max(80),
        url: z.string().max(300),
      })).max(20).default([]),
      banners: z.array(z.object({
        id: z.string(),
        image: z.string().max(500).nullable().optional(),
        title: z.string().max(200).optional(),
        subtitle: z.string().max(300).optional(),
        link: z.string().max(300).optional(),
      })).max(10).default([]),
      hero_image: z.string().max(500).nullable().optional(),
      custom_domain: z.string().max(200).nullable().optional(),
      sections: z.array(z.any()).max(50),
      is_published: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("site_config")
      .upsert({ tenant_id: DEFAULT_TENANT, ...data }, { onConflict: "tenant_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Returns a signed upload URL the client uses to PUT directly to storage. */
export const getUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    folder: z.enum(["banners", "logo", "hero", "sections", "products"]).default("banners"),
    ext: z.string().max(10).default("jpg"),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeExt = (data.ext || "jpg").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6) || "jpg";
    const path = `${data.folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("store-images")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    const { data: preview } = await supabaseAdmin.storage
      .from("store-images")
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    return { path, signedUrl: signed.signedUrl, token: signed.token, previewUrl: preview?.signedUrl ?? null };
  });

export const createOnlineOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      customer_name: z.string().min(1).max(200),
      customer_phone: z.string().min(3).max(40),
      customer_address: z.string().min(1).max(500),
      customer_notes: z.string().max(500).optional(),
      items: z.array(z.object({
        product_id: z.string().uuid(),
        qty: z.number().positive().max(9999),
      })).min(1).max(100),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = data.items.map((i) => i.product_id);
    const { data: prods, error: pe } = await supabaseAdmin
      .from("products")
      .select("id, name_ar, sale_price, is_active")
      .in("id", ids);
    if (pe) throw new Error(pe.message);
    const map = new Map((prods ?? []).map((p) => [p.id, p]));
    let subtotal = 0;
    const items = data.items.map((i) => {
      const p = map.get(i.product_id);
      if (!p || !p.is_active) throw new Error("Invalid product");
      const total = Number(p.sale_price) * i.qty;
      subtotal += total;
      return {
        product_id: i.product_id,
        product_name: p.name_ar,
        qty: i.qty,
        unit_price: Number(p.sale_price),
        total,
      };
    });
    const orderNumber = "ON-" + Date.now().toString(36).toUpperCase();
    const { data: order, error: oe } = await supabaseAdmin
      .from("online_orders")
      .insert({
        tenant_id: DEFAULT_TENANT,
        order_number: orderNumber,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_address: data.customer_address,
        customer_notes: data.customer_notes ?? null,
        subtotal,
        total: subtotal,
        status: "pending",
        payment_method: "cod",
      })
      .select("id, order_number")
      .single();
    if (oe) throw new Error(oe.message);
    const rows = items.map((it) => ({ ...it, order_id: order.id }));
    const { error: ie } = await supabaseAdmin.from("online_order_items").insert(rows);
    if (ie) throw new Error(ie.message);
    return { id: order.id, order_number: order.order_number, total: subtotal };
  });

export const listOnlineOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("online_orders")
      .select("*, online_order_items(*)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { orders: data ?? [] };
  });

export const updateOnlineOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("online_orders")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });