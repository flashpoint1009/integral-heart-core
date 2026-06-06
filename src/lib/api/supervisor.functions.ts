import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const upsertRouteStops = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      employee_id: z.string().uuid(),
      route_date: z.string(),
      customer_ids: z.array(z.string().uuid()).max(100),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Wipe existing pending stops for the day, then insert fresh order
    const { error: delErr } = await context.supabase
      .from("rep_routes")
      .delete()
      .eq("employee_id", data.employee_id)
      .eq("route_date", data.route_date)
      .eq("status", "pending");
    if (delErr) throw new Error(delErr.message);
    if (data.customer_ids.length === 0) return { ok: true, count: 0 };
    const rows = data.customer_ids.map((cid, i) => ({
      employee_id: data.employee_id,
      customer_id: cid,
      route_date: data.route_date,
      sequence: i + 1,
      status: "pending" as const,
    }));
    const { error } = await context.supabase.from("rep_routes").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });