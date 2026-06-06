import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_cost: z.number().min(0),
});

const InputSchema = z.object({
  supplier_id: z.string().uuid().nullable().optional(),
  warehouse_id: z.string().uuid(),
  notes: z.string().max(1000).nullable().optional(),
  items: z.array(ItemSchema).min(1).max(200),
});

export const createPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    for (const i of data.items) {
      const { error: smErr } = await supabase.from("stock_movements").insert({
        product_id: i.product_id,
        warehouse_id: data.warehouse_id,
        movement_type: "purchase",
        quantity: i.quantity,
        unit_cost: i.unit_cost,
        reference_type: "purchase",
        notes: data.notes ?? null,
        created_by: userId,
      });
      if (smErr) throw new Error(smErr.message);

      const { data: existing } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("product_id", i.product_id)
        .eq("warehouse_id", data.warehouse_id)
        .maybeSingle();
      const newQty = Number(existing?.quantity ?? 0) + i.quantity;
      const { error: invErr } = await supabase.from("inventory").upsert(
        { product_id: i.product_id, warehouse_id: data.warehouse_id, quantity: newQty },
        { onConflict: "product_id,warehouse_id" },
      );
      if (invErr) throw new Error(invErr.message);
    }

    // Increase supplier balance (owed to supplier)
    if (data.supplier_id) {
      const total = data.items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
      const { data: sup } = await supabase.from("suppliers").select("balance").eq("id", data.supplier_id).single();
      await supabase.from("suppliers").update({ balance: Number(sup?.balance ?? 0) + total }).eq("id", data.supplier_id);
    }

    return { ok: true, item_count: data.items.length };
  });