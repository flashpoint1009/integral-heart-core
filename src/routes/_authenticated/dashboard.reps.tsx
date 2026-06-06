import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getRepPerformance } from "@/lib/api/analytics.functions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Award } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard/reps")({
  head: () => ({ meta: [{ title: "أداء المندوبين — ERP" }] }),
  component: Page,
});

const fmt = (n: number) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

function Page() {
  const fn = useServerFn(getRepPerformance);
  const { data, isLoading } = useQuery({
    queryKey: ["rep_performance"],
    queryFn: () => fn({ data: undefined }),
  });

  if (isLoading || !data) return <div className="p-6 text-muted-foreground">جاري التحميل…</div>;
  const lb = data.leaderboard;

  const rankIcon = (i: number) =>
    i === 0 ? <Trophy className="h-5 w-5 text-amber-500" /> :
    i === 1 ? <Medal className="h-5 w-5 text-slate-400" /> :
    i === 2 ? <Award className="h-5 w-5 text-amber-700" /> :
    <span className="text-muted-foreground font-mono">#{i + 1}</span>;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="أداء المندوبين" description="ترتيب الأداء آخر 30 يوم" />

      <Card>
        <CardHeader><CardTitle>مقارنة المبيعات</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={lb}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="المبيعات" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>لوحة الصدارة</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {lb.map((r, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-sm transition">
                <div className="w-10 flex justify-center">{rankIcon(i)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex gap-4 flex-wrap">
                    <span>زيارات: {r.visits}</span>
                    <span>فواتير: {r.invoices}</span>
                    <span>تحويل: {r.conversionRate.toFixed(1)}%</span>
                    <span>متوسط الفاتورة: {fmt(r.avgInvoice)}</span>
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-xs text-muted-foreground">إجمالي المبيعات</div>
                  <div className="text-lg font-bold text-primary">{fmt(r.sales)}</div>
                </div>
              </div>
            ))}
            {lb.length === 0 && <div className="text-center text-muted-foreground py-8">لا توجد بيانات مندوبين</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}