import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Row = Record<string, unknown>;

// ===== Executive Dashboard =====
export const getExecutiveStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ months: z.number().min(1).max(24).default(12) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const since = new Date();
    since.setMonth(since.getMonth() - (data.months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const { data: invoices } = await supabase
      .from("sales_invoices")
      .select("id, total, paid, invoice_date, customer_id, status")
      .gte("invoice_date", since.toISOString());

    const rows = (invoices ?? []) as Array<{ id: string; total: number; paid: number; invoice_date: string; customer_id: string | null; status: string }>;

    // Group by month
    const monthly = new Map<string, { month: string; sales: number; paid: number; count: number }>();
    for (const r of rows) {
      const key = r.invoice_date.slice(0, 7);
      const cur = monthly.get(key) ?? { month: key, sales: 0, paid: 0, count: 0 };
      cur.sales += Number(r.total || 0);
      cur.paid += Number(r.paid || 0);
      cur.count += 1;
      monthly.set(key, cur);
    }
    const series = [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month));

    const today = new Date().toISOString().slice(0, 10);
    const monthKey = today.slice(0, 7);
    const todaySales = rows.filter((r) => r.invoice_date.slice(0, 10) === today).reduce((s, r) => s + Number(r.total || 0), 0);
    const monthSales = rows.filter((r) => r.invoice_date.slice(0, 7) === monthKey).reduce((s, r) => s + Number(r.total || 0), 0);
    const totalSales = rows.reduce((s, r) => s + Number(r.total || 0), 0);
    const totalPaid = rows.reduce((s, r) => s + Number(r.paid || 0), 0);

    // Growth: this month vs last month
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonthKey = lastMonthDate.toISOString().slice(0, 7);
    const lastMonthSales = rows.filter((r) => r.invoice_date.slice(0, 7) === lastMonthKey).reduce((s, r) => s + Number(r.total || 0), 0);
    const growth = lastMonthSales > 0 ? ((monthSales - lastMonthSales) / lastMonthSales) * 100 : 0;

    // Top customers
    const custMap = new Map<string, number>();
    for (const r of rows) custMap.set(r.customer_id ?? "walkin", (custMap.get(r.customer_id ?? "walkin") ?? 0) + Number(r.total || 0));
    const topCustIds = [...custMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const custIds = topCustIds.map((c) => c[0]).filter((id) => id !== "walkin");
    const { data: custs } = custIds.length
      ? await supabase.from("customers").select("id, name").in("id", custIds)
      : { data: [] };
    const custNames = new Map((custs ?? []).map((c: Row) => [c.id as string, c.name as string]));
    const topCustomers = topCustIds.map(([id, total]) => ({ name: id === "walkin" ? "عميل عابر" : (custNames.get(id) ?? "—"), total }));

    // Top products
    const invIds = rows.map((r) => r.id);
    const { data: items } = invIds.length
      ? await supabase.from("sales_invoice_items").select("product_id, quantity, total, products(name_ar, name_en)").in("invoice_id", invIds)
      : { data: [] };
    const prodMap = new Map<string, { name: string; qty: number; total: number }>();
    for (const it of (items ?? []) as Array<{ product_id: string; quantity: number; total: number; products: { name_ar: string | null; name_en: string | null } | null }>) {
      const name = it.products?.name_ar || it.products?.name_en || it.product_id;
      const cur = prodMap.get(it.product_id) ?? { name, qty: 0, total: 0 };
      cur.qty += Number(it.quantity || 0);
      cur.total += Number(it.total || 0);
      prodMap.set(it.product_id, cur);
    }
    const topProducts = [...prodMap.values()].sort((a, b) => b.total - a.total).slice(0, 8);

    // Health score (0-100): mix of growth + collection rate
    const collectionRate = totalSales > 0 ? (totalPaid / totalSales) * 100 : 0;
    const healthScore = Math.max(0, Math.min(100, Math.round(collectionRate * 0.6 + Math.min(100, Math.max(0, 50 + growth)) * 0.4)));

    return {
      kpis: { todaySales, monthSales, totalSales, totalPaid, totalDue: totalSales - totalPaid, growth, invoiceCount: rows.length, healthScore, collectionRate },
      monthlySeries: series,
      topCustomers,
      topProducts,
    };
  });

// ===== ABC Profitability =====
export const getProfitabilityAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: items } = await supabase
      .from("sales_invoice_items")
      .select("product_id, quantity, total, unit_price, products(name_ar, name_en, cost_price, sale_price)");

    const prodMap = new Map<string, { name: string; revenue: number; qty: number; cost: number; profit: number; margin: number }>();
    for (const it of (items ?? []) as Array<{ product_id: string; quantity: number; total: number; unit_price: number; products: { name_ar: string | null; name_en: string | null; cost_price: number | null } | null }>) {
      const name = it.products?.name_ar || it.products?.name_en || it.product_id;
      const cost = Number(it.products?.cost_price ?? 0) * Number(it.quantity || 0);
      const rev = Number(it.total || 0);
      const cur = prodMap.get(it.product_id) ?? { name, revenue: 0, qty: 0, cost: 0, profit: 0, margin: 0 };
      cur.revenue += rev;
      cur.qty += Number(it.quantity || 0);
      cur.cost += cost;
      prodMap.set(it.product_id, cur);
    }
    const products = [...prodMap.values()].map((p) => ({
      ...p,
      profit: p.revenue - p.cost,
      margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    // ABC classification by cumulative revenue
    const totalRev = products.reduce((s, p) => s + p.revenue, 0);
    let cum = 0;
    const classified = products.map((p) => {
      cum += p.revenue;
      const pct = totalRev > 0 ? (cum / totalRev) * 100 : 0;
      const cls = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
      return { ...p, cumulativePct: pct, class: cls };
    });

    return { products: classified, totalRevenue: totalRev, totalProfit: classified.reduce((s, p) => s + p.profit, 0) };
  });

// ===== Rep Performance =====
export const getRepPerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data: visits } = await supabase
      .from("rep_visits")
      .select("id, employee_id, status, created_at, employees(full_name)")
      .gte("created_at", since.toISOString());
    const { data: invoices } = await supabase
      .from("sales_invoices")
      .select("id, total, rep_id, invoice_date")
      .gte("invoice_date", since.toISOString())
      .not("rep_id", "is", null);

    const repMap = new Map<string, { name: string; visits: number; completed: number; sales: number; invoices: number }>();
    for (const v of (visits ?? []) as Array<{ employee_id: string; status: string; employees: { full_name: string } | null }>) {
      const cur = repMap.get(v.employee_id) ?? { name: v.employees?.full_name ?? "—", visits: 0, completed: 0, sales: 0, invoices: 0 };
      cur.visits += 1;
      if (v.status === "completed" || v.status === "done") cur.completed += 1;
      repMap.set(v.employee_id, cur);
    }
    for (const inv of (invoices ?? []) as Array<{ rep_id: string; total: number }>) {
      const cur = repMap.get(inv.rep_id);
      if (cur) {
        cur.sales += Number(inv.total || 0);
        cur.invoices += 1;
      }
    }
    const leaderboard = [...repMap.values()].map((r) => ({
      ...r,
      conversionRate: r.visits > 0 ? (r.invoices / r.visits) * 100 : 0,
      avgInvoice: r.invoices > 0 ? r.sales / r.invoices : 0,
    })).sort((a, b) => b.sales - a.sales);

    return { leaderboard, period: "30d" };
  });

// ===== AI Sales Forecast =====
export const getSalesForecast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    since.setDate(1);

    const { data: invoices } = await supabase
      .from("sales_invoices")
      .select("total, invoice_date")
      .gte("invoice_date", since.toISOString());

    const rows = (invoices ?? []) as Array<{ total: number; invoice_date: string }>;
    const monthly = new Map<string, number>();
    for (const r of rows) {
      const k = r.invoice_date.slice(0, 7);
      monthly.set(k, (monthly.get(k) ?? 0) + Number(r.total || 0));
    }
    const history = [...monthly.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, sales]) => ({ month, sales }));

    if (history.length < 2) {
      return { history, forecast: [], insights: "البيانات قليلة — تحتاج فواتير لشهرين على الأقل للتنبؤ.", source: "rule" as const };
    }

    // Try AI forecast via Lovable AI Gateway
    const apiKey = process.env.LOVABLE_API_KEY;
    if (apiKey) {
      try {
        const prompt = `أنت محلل مبيعات خبير. حلل بيانات المبيعات الشهرية التالية وتنبأ بالـ 3 شهور القادمة. أعد JSON فقط بدون أي نص آخر بالتنسيق:
{"forecast":[{"month":"YYYY-MM","predicted":number,"confidence":"high|medium|low"}],"insights":"تحليل قصير بالعربية في 2-3 جمل مع توصيات عملية"}

البيانات:
${JSON.stringify(history)}`;

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const content = json.choices?.[0]?.message?.content ?? "";
          const cleaned = content.replace(/```json\s*/g, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleaned);
          return { history, forecast: parsed.forecast ?? [], insights: parsed.insights ?? "", source: "ai" as const };
        }
      } catch (e) {
        console.error("AI forecast failed:", e);
      }
    }

    // Fallback: simple moving average + trend
    const last3 = history.slice(-3).map((h) => h.sales);
    const avg = last3.reduce((s, n) => s + n, 0) / last3.length;
    const trend = last3.length >= 2 ? (last3[last3.length - 1] - last3[0]) / last3.length : 0;
    const lastMonth = new Date(history[history.length - 1].month + "-01");
    const forecast = [1, 2, 3].map((i) => {
      const d = new Date(lastMonth);
      d.setMonth(d.getMonth() + i);
      return { month: d.toISOString().slice(0, 7), predicted: Math.max(0, avg + trend * i), confidence: "medium" as const };
    });
    return { history, forecast, insights: "تنبؤ بناءً على متوسط آخر 3 شهور والاتجاه العام.", source: "rule" as const };
  });