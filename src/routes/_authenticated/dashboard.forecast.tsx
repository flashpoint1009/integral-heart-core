import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSalesForecast } from "@/lib/api/analytics.functions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Brain } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard/forecast")({
  head: () => ({ meta: [{ title: "توقع المبيعات بالـ AI — ERP" }] }),
  component: Page,
});

function Page() {
  const fn = useServerFn(getSalesForecast);
  const { data, isLoading } = useQuery({
    queryKey: ["sales_forecast"],
    queryFn: () => fn({ data: undefined }),
    staleTime: 5 * 60_000,
  });

  if (isLoading || !data) return <div className="p-6 text-muted-foreground">جاري التحليل بالذكاء الاصطناعي…</div>;

  const combined = [
    ...data.history.map((h) => ({ month: h.month, actual: h.sales, predicted: null as number | null })),
    ...data.forecast.map((f) => ({ month: f.month, actual: null as number | null, predicted: f.predicted })),
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="توقع المبيعات بالذكاء الاصطناعي" description="تحليل اتجاهات المبيعات والتنبؤ بالأشهر القادمة" />

      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="flex flex-row items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <CardTitle>التحليل والتوصيات</CardTitle>
          <Badge variant={data.source === "ai" ? "default" : "secondary"} className="ms-auto">
            {data.source === "ai" ? <><Sparkles className="h-3 w-3 me-1" /> AI</> : "تحليل إحصائي"}
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{data.insights || "—"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>المبيعات الفعلية مقابل التوقعات</CardTitle></CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={combined}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Bar dataKey="actual" fill="hsl(var(--primary))" name="فعلي" radius={[6, 6, 0, 0]} />
              <Line type="monotone" dataKey="predicted" stroke="#f59e0b" strokeWidth={3} strokeDasharray="6 4" name="متوقع" dot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>تفاصيل التوقعات</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-3">
            {data.forecast.map((f) => (
              <div key={f.month} className="rounded-xl border p-4 bg-card">
                <div className="text-xs text-muted-foreground">{f.month}</div>
                <div className="text-2xl font-bold mt-1">{Number(f.predicted).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <Badge variant="outline" className="mt-2 text-xs">
                  ثقة: {f.confidence === "high" ? "عالية" : f.confidence === "low" ? "منخفضة" : "متوسطة"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}