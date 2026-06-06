import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getEmployeeId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No employee record linked to this user");
  return data.id;
}

export const repCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ lat: z.number().nullable(), lng: z.number().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const employee_id = await getEmployeeId(context.supabase, context.userId);
    // Reuse open check-in if exists today
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data: open } = await context.supabase
      .from("rep_check_ins")
      .select("id")
      .eq("employee_id", employee_id)
      .is("check_out_at", null)
      .gte("check_in_at", today.toISOString())
      .maybeSingle();
    if (open) return { id: open.id, reused: true };
    const { data: row, error } = await context.supabase
      .from("rep_check_ins")
      .insert({ employee_id, check_in_lat: data.lat, check_in_lng: data.lng })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, reused: false };
  });

export const repCheckOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ lat: z.number().nullable(), lng: z.number().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const employee_id = await getEmployeeId(context.supabase, context.userId);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data: open } = await context.supabase
      .from("rep_check_ins")
      .select("id")
      .eq("employee_id", employee_id)
      .is("check_out_at", null)
      .gte("check_in_at", today.toISOString())
      .order("check_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!open) throw new Error("No open check-in");
    const { error } = await context.supabase
      .from("rep_check_ins")
      .update({ check_out_at: new Date().toISOString(), check_out_lat: data.lat, check_out_lng: data.lng })
      .eq("id", open.id);
    if (error) throw new Error(error.message);
    return { id: open.id };
  });

export const startVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ customer_id: z.string().uuid(), lat: z.number().nullable(), lng: z.number().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const employee_id = await getEmployeeId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("rep_visits")
      .insert({ employee_id, customer_id: data.customer_id, lat: data.lat, lng: data.lng })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const endVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      visit_id: z.string().uuid(),
      outcome: z.enum(["sold","collected","no_sale","not_found","rescheduled"]),
      notes: z.string().max(500).nullable().optional(),
      invoice_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("rep_visits")
      .update({
        ended_at: new Date().toISOString(),
        outcome: data.outcome,
        notes: data.notes ?? null,
        invoice_id: data.invoice_id ?? null,
      })
      .eq("id", data.visit_id);
    if (error) throw new Error(error.message);
    // Update route status to done if it exists
    return { ok: true };
  });

export const createRepCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().min(1).max(200),
      phone: z.string().max(40).nullable().optional(),
      address: z.string().max(500).nullable().optional(),
      address_notes: z.string().max(500).nullable().optional(),
      lat: z.number().nullable().optional(),
      lng: z.number().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const employee_id = await getEmployeeId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("customers")
      .insert({
        name: data.name,
        phone: data.phone ?? null,
        address: data.address ?? null,
        address_notes: data.address_notes ?? null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        assigned_rep_id: employee_id,
        is_active: true,
      })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, name: row.name };
  });