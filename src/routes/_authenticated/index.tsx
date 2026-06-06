import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Users, Receipt, TrendingUp, AlertTriangle, ArrowUpRight, ShoppingCart } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — ERP" }] }),
  component: Dashboard,
});

interface Stats {
  todaySales: number;
  monthSales: number;
  products: number;
  customers: number;
  lowStock: number;
}

type RecentInvoice = { id: string; invoice_number: string; total: number; paid: number; status: string; invoice_date: string; customers: { name: string } | null };
type LowProduct = { id: string; name_ar: string; name_en: string | null; min_stock: number; inventory: Array<{ quantity: number }> };

function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentInvoice[]>([]);
  const [lowProducts, setLowProducts] = useState<LowProduct[]>([]);

  useEffect(() => {
    const load = async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);

      const [tSales, mSales, prods, custs, invList, lowList] = await Promise.all([
        supabase.from("sales_invoices").select("total").gte("invoice_date", today.toISOString()),
        supabase.from("sales_invoices").select("total").gte("invoice_date", month.toISOString()),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase.from("sales_invoices").select("id, invoice_number, total, paid, status, invoice_date, customers(name)").order("invoice_date", { ascending: false }).limit(5),
        supabase.from("products").select("id, name_ar, name_en, min_stock, inventory(quantity)").gt("min_stock", 0),
      ]);

      const lows = ((lowList.data ?? []) as unknown as LowProduct[])
        .filter((p) => (p.inventory ?? []).reduce((s, i) => s + Number(i.quantity || 0), 0) <= Number(p.min_stock || 0));

      setStats({
        todaySales: (tSales.data ?? []).reduce((s, r) => s + Number(r.total || 0), 0),
        monthSales: (mSales.data ?? []).reduce((s, r) => s + Number(r.total || 0), 0),
        products: prods.count ?? 0,
        customers: custs.count ?? 0,
        lowStock: lows.length,
      });
      setRecent((invList.data ?? []) as unknown as RecentInvoice[]);
      setLowProducts(lows.slice(0, 5));
    };
    load();
  }, []);

  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const cards = [
    {
      label: t("dashboard.todaySales"),
      value: stats ? fmt(stats.todaySales) : "—",
      icon: TrendingUp,
      gradient: "from-emerald-500/15 to-emerald-500/0",
      iconBg: "bg-emerald-500/10 text-emerald-600",
    },
    {
      label: t("dashboard.monthSales"),
      value: stats ? fmt(stats.monthSales) : "—",
      icon: Receipt,
      gradient: "from-primary/15 to-primary/0",
      iconBg: "bg-primary/10 text-primary",
    },
    {
      label: t("dashboard.totalProducts"),
      value: stats?.products ?? "—",
      icon: Package,
      gradient: "from-amber-500/15 to-amber-500/0",
      iconBg: "bg-amber-500/10 text-amber-600",
    },
    {
      label: t("dashboard.totalCustomers"),
      value: stats?.customers ?? "—",
      icon: Users,
      gradient: "from-violet-500/15 to-violet-500/0",
      iconBg: "bg-violet-500/10 text-violet-600",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Hero welcome banner */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 md:p-8 text-white shadow-lg"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute -top-20 -end-20 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 start-0 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <p className="text-white/70 text-sm">{t("dashboard.welcomeUser", { name })}</p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t("dashboard.title")}</h1>
            <p className="text-white/75 text-sm max-w-md">{t("dashboard.heroSubtitle", "نظرة سريعة على أداء متجرك اليوم")}</p>
          </div>
          <div className="flex gap-2">
            <Button asChild size="lg" className="rounded-full bg-white text-primary hover:bg-white/90 shadow-md">
              <Link to="/pos"><ShoppingCart className="h-4 w-4 me-2" />{t("nav.pos")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white">
              <Link to="/reports">{t("nav.reports")}<ArrowUpRight className="h-4 w-4 ms-2" /></Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className={`relative overflow-hidden border-border/60 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br ${c.gradient}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{c.label}</p>
                  <p className="text-3xl font-bold tracking-tight tabular-nums">{c.value}</p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${c.iconBg}`}>
                  <c.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity panels */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">{t("dashboard.recentInvoices")}</CardTitle>
            <Button asChild variant="ghost" size="sm" className="rounded-full text-xs h-8">
              <Link to="/sales">{t("common.viewAll", "عرض الكل")}<ArrowUpRight className="h-3.5 w-3.5 ms-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">{t("dashboard.noData")}</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {recent.map((inv) => (
                  <li key={inv.id} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                        <Receipt className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-semibold truncate">{inv.invoice_number}</div>
                        <div className="text-xs text-muted-foreground truncate">{inv.customers?.name ?? t("sales.walkin")}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={inv.status === "paid" ? "default" : inv.status === "partial" ? "secondary" : "outline"} className="rounded-full text-[10px] font-medium capitalize">
                        {t(`sales.status.${inv.status}`, inv.status)}
                      </Badge>
                      <span className="font-semibold tabular-nums text-sm">{fmt(Number(inv.total))}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
              </span>
              {t("dashboard.lowStock")}
            </CardTitle>
            {stats && stats.lowStock > 0 && (
              <Badge variant="outline" className="rounded-full border-amber-500/30 bg-amber-500/10 text-amber-700 text-[10px]">
                {stats.lowStock}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {lowProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">{t("dashboard.noData")}</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {lowProducts.map((p) => {
                  const qty = (p.inventory ?? []).reduce((s, i) => s + Number(i.quantity || 0), 0);
                  return (
                    <li key={p.id} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
                      <span className="font-medium text-sm truncate">{p.name_ar}</span>
                      <span className="text-amber-700 tabular-nums text-xs font-semibold bg-amber-500/10 rounded-full px-2 py-0.5">
                        {qty} / {p.min_stock}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}