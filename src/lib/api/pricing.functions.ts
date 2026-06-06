import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PricingPlan = {
  id: string;
  name: string;
  tagline: string | null;
  price_egp: number;
  price_label: string | null;
  period: string;
  features: string[];
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  cta_label: string | null;
};

// Public — no auth, returns active plans only
export const getPublicPricingPlans = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("landing_pricing_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { plans: (data ?? []) as PricingPlan[] };
  }
);

async function assertManager(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => r.role === "developer" || r.role === "admin");
  if (!ok) throw new Error("Unauthorized");
}

export const listPricingPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("landing_pricing_plans")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { plans: (data ?? []) as PricingPlan[] };
  });

const PlanSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  tagline: z.string().max(160).nullable().optional(),
  price_egp: z.number().min(0).max(10000000),
  price_label: z.string().max(40).nullable().optional(),
  period: z.string().max(40),
  features: z.array(z.string().min(1).max(200)).max(20),
  is_featured: z.boolean(),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(999),
  cta_label: z.string().max(40).nullable().optional(),
});

export const upsertPricingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PlanSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    const { id, ...rest } = data;
    if (id) {
      const { error } = await context.supabase
        .from("landing_pricing_plans")
        .update(rest)
        .eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: ins, error } = await context.supabase
      .from("landing_pricing_plans")
      .insert(rest)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deletePricingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("landing_pricing_plans")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });