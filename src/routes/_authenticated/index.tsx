import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Users, Receipt, TrendingUp, AlertTriangle } from "lucide-react";

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

function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);

      const [tSales, mSales, prods, custs] = await Promise.all([
        supabase.from("sales_invoices").select("total").gte("invoice_date", today.toISOString()),
        supabase.from("sales_invoices").select("total").gte("invoice_date", month.toISOString()),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("customers").select("id", { count: "exact", head: true }),
      ]);

      setStats({
        todaySales: (tSales.data ?? []).reduce((s, r) => s + Number(r.total || 0), 0),
        monthSales: (mSales.data ?? []).reduce((s, r) => s + Number(r.total || 0), 0),
        products: prods.count ?? 0,
        customers: custs.count ?? 0,
        lowStock: 0,
      });
    };
    load();
  }, []);

  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const cards = [
    { label: t("dashboard.todaySales"), value: stats ? fmt(stats.todaySales) : "—", icon: TrendingUp, accent: "text-success" },
    { label: t("dashboard.monthSales"), value: stats ? fmt(stats.monthSales) : "—", icon: Receipt, accent: "text-primary" },
    { label: t("dashboard.totalProducts"), value: stats?.products ?? "—", icon: Package, accent: "text-chart-3" },
    { label: t("dashboard.totalCustomers"), value: stats?.customers ?? "—", icon: Users, accent: "text-chart-5" },
  ];

  return (
    <div className="p-6">
      <PageHeader title={t("dashboard.title")} description={t("dashboard.welcomeUser", { name })} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-5 w-5 ${c.accent}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 mt-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              {t("dashboard.lowStock")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground py-8 text-center">{t("dashboard.noData")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.recentInvoices")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground py-8 text-center">{t("dashboard.noData")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}