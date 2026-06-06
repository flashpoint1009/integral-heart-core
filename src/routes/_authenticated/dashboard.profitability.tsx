import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getProfitabilityAnalysis } from "@/lib/api/analytics.functions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/dashboard/profitability")({
  head: () => ({ meta: [{ title: "تحليل الربحية — ERP" }] }),
  component: Page,
});

const fmt = (n: number) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

function Page() {
  const fn = useServerFn(getProfitabilityAnalysis);
  const { data, isLoading } = useQuery({
    queryKey: ["profitability"],
    queryFn: () => fn({ data: undefined }),
  });

  if (isLoading || !data) return <div className="p-6 text-muted-foreground">جاري التحميل…</div>;

  const aCount = data.products.filter((p) => p.class === "A").length;
  const bCount = data.products.filter((p) => p.class === "B").length;
  const cCount = data.products.filter((p) => p.class === "C").length;

  const cls = (c: string) =>
    c === "A" ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
    : c === "B" ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
    : "bg-slate-500/15 text-slate-700 border-slate-500/30";

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="تحليل الربحية ABC" description="تصنيف المنتجات حسب المساهمة في الإيرادات والأرباح" />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">إجمالي الإيرادات</div><div className="text-xl font-bold mt-1">{fmt(data.totalRevenue)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">إجمالي الأرباح</div><div className="text-xl font-bold mt-1 text-emerald-600">{fmt(data.totalProfit)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">منتجات A (نجوم)</div><div className="text-xl font-bold mt-1 text-emerald-600">{aCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">منتجات B</div><div className="text-xl font-bold mt-1 text-amber-600">{bCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">منتجات C (ضعيفة)</div><div className="text-xl font-bold mt-1">{cCount}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>المنتجات حسب الربحية</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التصنيف</TableHead>
                  <TableHead>المنتج</TableHead>
                  <TableHead className="text-end">الكمية</TableHead>
                  <TableHead className="text-end">الإيرادات</TableHead>
                  <TableHead className="text-end">التكلفة</TableHead>
                  <TableHead className="text-end">الربح</TableHead>
                  <TableHead className="text-end">الهامش %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.products.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell><Badge variant="outline" className={cls(p.class)}>{p.class}</Badge></TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-end">{fmt(p.qty)}</TableCell>
                    <TableCell className="text-end">{fmt(p.revenue)}</TableCell>
                    <TableCell className="text-end text-muted-foreground">{fmt(p.cost)}</TableCell>
                    <TableCell className={`text-end font-semibold ${p.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(p.profit)}</TableCell>
                    <TableCell className="text-end">{p.margin.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
                {data.products.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}