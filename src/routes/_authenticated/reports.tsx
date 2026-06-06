import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Receipt, TrendingUp, Wallet, AlertCircle, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToExcel, exportToPdf } from "@/lib/export-utils";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — ERP" }] }),
  component: Page,
});

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthStartISO = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };

function Page() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());

  const range = useMemo(() => {
    const f = new Date(from); f.setHours(0, 0, 0, 0);
    const tt = new Date(to); tt.setHours(23, 59, 59, 999);
    return { fromISO: f.toISOString(), toISO: tt.toISOString() };
  }, [from, to]);

  const { data: invoices = [] } = useQuery({
    queryKey: ["reports_invoices", range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_invoices")
        .select("id, invoice_date, total, paid, customer_id, customers(name)")
        .gte("invoice_date", range.fromISO)
        .lte("invoice_date", range.toISO);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{ id: string; invoice_date: string; total: number; paid: number; customer_id: string | null; customers: { name: string } | null }>;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["reports_items", range],
    queryFn: async () => {
      const ids = invoices.map((i) => i.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("sales_invoice_items")
        .select("product_id, quantity, total, products(name_ar, name_en)")
        .in("invoice_id", ids);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{ product_id: string; quantity: number; total: number; products: { name_ar: string | null; name_en: string | null } | null }>;
    },
    enabled: invoices.length > 0,
  });

  const summary = useMemo(() => {
    const total = invoices.reduce((s, i) => s + Number(i.total || 0), 0);
    const paid = invoices.reduce((s, i) => s + Number(i.paid || 0), 0);
    return { count: invoices.length, total, paid, due: total - paid };
  }, [invoices]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; total: number }>();
    for (const it of items) {
      const name = it.products?.name_ar || it.products?.name_en || it.product_id;
      const cur = map.get(it.product_id) ?? { name, qty: 0, total: 0 };
      cur.qty += Number(it.quantity || 0);
      cur.total += Number(it.total || 0);
      map.set(it.product_id, cur);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  }, [items]);

  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const i of invoices) {
      const key = i.customer_id ?? "walkin";
      const name = i.customers?.name ?? t("sales.walkin");
      const cur = map.get(key) ?? { name, total: 0, count: 0 };
      cur.total += Number(i.total || 0); cur.count += 1;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  }, [invoices, t]);

  const trend = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of invoices) {
      const d = (i.invoice_date || "").slice(0, 10);
      if (!d) continue;
      map.set(d, (map.get(d) ?? 0) + Number(i.total || 0));
    }
    return [...map.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([date, total]) => ({ date, total }));
  }, [invoices]);

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleExcel = () => {
    exportToExcel(`reports_${from}_${to}`, {
      "ملخص": [
        { المعيار: t("reports.invoicesCount"), القيمة: summary.count },
        { المعيار: t("reports.totalSales"), القيمة: summary.total },
        { المعيار: t("reports.totalPaid"), القيمة: summary.paid },
        { المعيار: t("reports.totalDue"), القيمة: summary.due },
      ],
      "اتجاه المبيعات": trend.map((r) => ({ التاريخ: r.date, الإجمالي: r.total })),
      "أعلى المنتجات": topProducts.map((p) => ({ المنتج: p.name, الكمية: p.qty, الإجمالي: p.total })),
      "أعلى العملاء": topCustomers.map((c) => ({ العميل: c.name, "عدد الفواتير": c.count, الإجمالي: c.total })),
    });
  };

  const handlePdf = () => {
    exportToPdf({
      filename: `reports_${from}_${to}`,
      title: t("reports.title"),
      subtitle: `${from} → ${to}`,
      sections: [
        {
          heading: "Summary",
          headers: ["Metric", "Value"],
          rows: [
            [t("reports.invoicesCount"), summary.count],
            [t("reports.totalSales"), fmt(summary.total)],
            [t("reports.totalPaid"), fmt(summary.paid)],
            [t("reports.totalDue"), fmt(summary.due)],
          ],
        },
        {
          heading: "Top Products",
          headers: ["Product", "Qty", "Total"],
          rows: topProducts.map((p) => [p.name, p.qty, fmt(p.total)]),
        },
        {
          heading: "Top Customers",
          headers: ["Customer", "Invoices", "Total"],
          rows: topCustomers.map((c) => [c.name, c.count, fmt(c.total)]),
        },
      ],
    });
  };

  const cards = [
    { label: t("reports.invoicesCount"), value: String(summary.count), icon: Receipt, tint: "from-primary/15 to-primary/0", color: "text-primary" },
    { label: t("reports.totalSales"), value: fmt(summary.total), icon: TrendingUp, tint: "from-emerald-500/15 to-emerald-500/0", color: "text-emerald-600" },
    { label: t("reports.totalPaid"), value: fmt(summary.paid), icon: Wallet, tint: "from-violet-500/15 to-violet-500/0", color: "text-violet-600" },
    { label: t("reports.totalDue"), value: fmt(summary.due), icon: AlertCircle, tint: "from-amber-500/15 to-amber-500/0", color: "text-amber-600" },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader title={t("reports.title")} description={t("reports.description")} />

      <Card className="border-border/60">
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5"><Label className="text-xs text-muted-foreground">{t("reports.from")}</Label><Input type="date" className="rounded-full" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className="text-xs text-muted-foreground">{t("reports.to")}</Label><Input type="date" className="rounded-full" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="ms-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExcel} className="gap-2"><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
            <Button variant="outline" size="sm" onClick={handlePdf} className="gap-2"><FileText className="h-4 w-4" /> PDF</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className={`bg-gradient-to-br ${c.tint} border-border/60`}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
                <div className={`h-9 w-9 rounded-xl bg-background/60 grid place-items-center ${c.color}`}>
                  <c.icon className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-bold mt-2 tabular-nums">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-base">اتجاه المبيعات اليومي</CardTitle></CardHeader>
        <CardContent className="h-72">
          {trend.length === 0 ? (
            <div className="h-full grid place-items-center text-muted-foreground text-sm">{t("reports.noData")}</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-base">{t("reports.topProducts")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>{t("sales.product")}</TableHead><TableHead className="text-end">{t("reports.qty")}</TableHead><TableHead className="text-end">{t("reports.total")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {topProducts.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-sm">{t("reports.noData")}</TableCell></TableRow>
                ) : topProducts.map((p, i) => (
                  <TableRow key={i} className="hover:bg-muted/40"><TableCell className="font-semibold text-primary">{p.name}</TableCell><TableCell className="text-end tabular-nums">{p.qty}</TableCell><TableCell className="text-end tabular-nums">{fmt(p.total)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-base">{t("reports.topCustomers")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>{t("sales.customer")}</TableHead><TableHead className="text-end">{t("reports.invoicesCount")}</TableHead><TableHead className="text-end">{t("reports.total")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {topCustomers.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-sm">{t("reports.noData")}</TableCell></TableRow>
                ) : topCustomers.map((c, i) => (
                  <TableRow key={i} className="hover:bg-muted/40"><TableCell className="font-semibold text-primary">{c.name}</TableCell><TableCell className="text-end tabular-nums">{c.count}</TableCell><TableCell className="text-end tabular-nums">{fmt(c.total)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}