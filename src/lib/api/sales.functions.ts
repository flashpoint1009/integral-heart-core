import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
  discount: z.number().min(0).default(0),
  tax_rate: z.number().min(0).default(0),
});

const InputSchema = z.object({
  customer_id: z.string().uuid().nullable().optional(),
  warehouse_id: z.string().uuid(),
  invoice_date: z.string().optional(),
  notes: z.string().max(1000).nullable().optional(),
  paid: z.number().min(0).default(0),
  rep_id: z.string().uuid().nullable().optional(),
  visit_id: z.string().uuid().nullable().optional(),
  items: z.array(ItemSchema).min(1).max(200),
});

export const createSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Totals
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    const itemRows = data.items.map((i) => {
      const gross = i.quantity * i.unit_price;
      const net = gross - i.discount;
      const tax = (net * i.tax_rate) / 100;
      const total = net + tax;
      subtotal += gross;
      discountTotal += i.discount;
      taxTotal += tax;
      return { ...i, total };
    });
    const total = subtotal - discountTotal + taxTotal;
    const paid = Math.min(data.paid, total);
    const status =
      paid >= total ? ("paid" as const) :
      paid > 0 ? ("partial" as const) :
      ("confirmed" as const);

    // Invoice number: INV-YYYYMM-NNNN
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const { count } = await supabase
      .from("sales_invoices")
      .select("id", { count: "exact", head: true })
      .gte("invoice_date", new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
    const invoice_number = `INV-${ym}-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const { data: inv, error: invErr } = await supabase
      .from("sales_invoices")
      .insert({
        invoice_number,
        customer_id: data.customer_id ?? null,
        warehouse_id: data.warehouse_id,
        invoice_date: data.invoice_date ?? now.toISOString(),
        notes: data.notes ?? null,
        subtotal,
        discount: discountTotal,
        tax_total: taxTotal,
        total,
        paid,
        status,
        rep_id: data.rep_id ?? null,
        visit_id: data.visit_id ?? null,
        created_by: userId,
      })
      .select("id, invoice_number")
      .single();
    if (invErr || !inv) throw new Error(invErr?.message ?? "invoice insert failed");

    const { error: iiErr } = await supabase.from("sales_invoice_items").insert(
      itemRows.map((i) => ({
        invoice_id: inv.id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount,
        tax_rate: i.tax_rate,
        total: i.total,
      })),
    );
    if (iiErr) throw new Error(iiErr.message);

    // Stock movements + inventory decrement
    for (const i of itemRows) {
      await supabase.from("stock_movements").insert({
        product_id: i.product_id,
        warehouse_id: data.warehouse_id,
        movement_type: "sale",
        quantity: -i.quantity,
        reference_id: inv.id,
        reference_type: "sales_invoice",
        unit_cost: i.unit_price,
        created_by: userId,
      });
      const { data: existing } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("product_id", i.product_id)
        .eq("warehouse_id", data.warehouse_id)
        .maybeSingle();
      const newQty = Number(existing?.quantity ?? 0) - i.quantity;
      await supabase.from("inventory").upsert(
        { product_id: i.product_id, warehouse_id: data.warehouse_id, quantity: newQty },
        { onConflict: "product_id,warehouse_id" },
      );
    }

    // Update customer balance if credit
    if (data.customer_id && total - paid > 0) {
      const { data: c } = await supabase.from("customers").select("balance").eq("id", data.customer_id).single();
      await supabase.from("customers").update({ balance: Number(c?.balance ?? 0) + (total - paid) }).eq("id", data.customer_id);
    }

    return { id: inv.id, invoice_number: inv.invoice_number, total, paid, status };
  });