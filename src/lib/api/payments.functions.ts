import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  invoice_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_method_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: inv, error: invErr } = await supabase
      .from("sales_invoices")
      .select("id, total, paid, customer_id, status")
      .eq("id", data.invoice_id)
      .single();
    if (invErr || !inv) throw new Error(invErr?.message ?? "invoice not found");
    if (inv.status === "cancelled") throw new Error("cannot pay cancelled invoice");

    const due = Number(inv.total) - Number(inv.paid);
    if (data.amount > due + 0.001) throw new Error(`amount exceeds due (${due.toFixed(2)})`);

    const { error: payErr } = await supabase.from("payments").insert({
      invoice_id: data.invoice_id,
      payment_method_id: data.payment_method_id ?? null,
      amount: data.amount,
      notes: data.notes ?? null,
      created_by: userId,
    });
    if (payErr) throw new Error(payErr.message);

    const newPaid = Number(inv.paid) + data.amount;
    const newStatus = newPaid >= Number(inv.total) - 0.001 ? "paid" : "partial";
    await supabase.from("sales_invoices").update({ paid: newPaid, status: newStatus }).eq("id", inv.id);

    if (inv.customer_id) {
      const { data: c } = await supabase.from("customers").select("balance").eq("id", inv.customer_id).single();
      await supabase.from("customers").update({ balance: Math.max(0, Number(c?.balance ?? 0) - data.amount) }).eq("id", inv.customer_id);
    }

    return { ok: true, paid: newPaid, status: newStatus };
  });