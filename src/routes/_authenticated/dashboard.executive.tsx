import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getExecutiveStats } from "@/lib/api/analytics.functions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Receipt, Wallet, Activity, Crown } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard/executive")({
  head: () => ({ meta: [{ title: "الداشبورد التنفيذي — ERP" }] }),
  component: Page,
});

const fmt = (n: number) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const COLORS = ["hsl(var(--primary))", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

function Page() {
  const fn = useServerFn(getExecutiveStats);
  const { data, isLoading } = useQuery({
    queryKey: ["executive_stats"],
    queryFn: () => fn({ data: { months: 12 } }),
  });

  if (isLoading || !data) return <div className="p-6 text-muted-foreground">جاري التحميل…</div>;
  const { kpis, monthlySeries, topCustomers, topProducts } = data;

  const kpiCards = [
    { label: "مبيعات اليوم", value: fmt(kpis.todaySales), icon: Activity, color: "text-primary" },
    { label: "مبيعات الشهر", value: fmt(kpis.monthSales), icon: TrendingUp, color: "text-emerald-600" },
    { label: "النمو الشهري", value: `${kpis.growth.toFixed(1)}%`, icon: kpis.growth >= 0 ? TrendingUp : TrendingDown, color: kpis.growth >= 0 ? "text-emerald-600" : "text-red-600" },
    { label: "إجمالي مستحق", value: fmt(kpis.totalDue), icon: Wallet, color: "text-amber-600" },
    { label: "عدد الفواتير", value: fmt(kpis.invoiceCount), icon: Receipt, color: "text-violet-600" },
    { label: "مؤشر صحة الأعمال", value: `${kpis.healthScore}/100`, icon: Crown, color: kpis.healthScore >= 70 ? "text-emerald-600" : kpis.healthScore >= 40 ? "text-amber-600" : "text-red-600" },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="الداشبورد التنفيذي" description="نظرة شاملة على أداء الأعمال" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className="text-xl font-bold mt-1">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>تطور المبيعات الشهري</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySeries}>
                <defs>
                  <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#s)" name="المبيعات" />
                <Area type="monotone" dataKey="paid" stroke="#10b981" strokeWidth={2} fillOpacity={0} name="المحصّل" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>توزيع أعلى المنتجات</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={topProducts.slice(0, 6)} dataKey="total" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {topProducts.slice(0, 6).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>أعلى 5 عملاء</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCustomers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>أعلى المنتجات مبيعاً</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}