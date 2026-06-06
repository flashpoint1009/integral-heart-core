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
import { Receipt, TrendingUp, Wallet, AlertCircle } from "lucide-react";

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
        .select("id, total, paid, customer_id, customers(name)")
        .gte("invoice_date", range.fromISO)
        .lte("invoice_date", range.toISO);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{ id: string; total: number; paid: number; customer_id: string | null; customers: { name: string } | null }>;
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

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const cards = [
    { label: t("reports.invoicesCount"), value: summary.count, icon: Receipt, accent: "text-primary" },
    { label: t("reports.totalSales"), value: fmt(summary.total), icon: TrendingUp, accent: "text-success" },
    { label: t("reports.totalPaid"), value: fmt(summary.paid), icon: Wallet, accent: "text-chart-3" },
    { label: t("reports.totalDue"), value: fmt(summary.due), icon: AlertCircle, accent: "text-warning" },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader title={t("reports.title")} description={t("reports.description")} />

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5"><Label>{t("reports.from")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>{t("reports.to")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-5 w-5 ${c.accent}`} />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{c.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("reports.topProducts")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>{t("sales.product")}</TableHead><TableHead className="text-end">{t("reports.qty")}</TableHead><TableHead className="text-end">{t("reports.total")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {topProducts.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-sm">{t("reports.noData")}</TableCell></TableRow>
                ) : topProducts.map((p, i) => (
                  <TableRow key={i}><TableCell>{p.name}</TableCell><TableCell className="text-end">{p.qty}</TableCell><TableCell className="text-end">{fmt(p.total)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("reports.topCustomers")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>{t("sales.customer")}</TableHead><TableHead className="text-end">{t("reports.invoicesCount")}</TableHead><TableHead className="text-end">{t("reports.total")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {topCustomers.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-sm">{t("reports.noData")}</TableCell></TableRow>
                ) : topCustomers.map((c, i) => (
                  <TableRow key={i}><TableCell>{c.name}</TableCell><TableCell className="text-end">{c.count}</TableCell><TableCell className="text-end">{fmt(c.total)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}