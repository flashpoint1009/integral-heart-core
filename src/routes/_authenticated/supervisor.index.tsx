import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Users, TrendingUp, Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/supervisor/")({
  component: SupervisorOverview,
});

function SupervisorOverview() {
  const { t } = useTranslation();

  const { data } = useQuery({
    queryKey: ["supervisor_overview_today"],
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const iso = today.toISOString();
      const dayStr = today.toISOString().slice(0, 10);
      const [ci, visits, invoices, routes] = await Promise.all([
        supabase.from("rep_check_ins").select("employee_id, check_in_at, check_out_at").gte("check_in_at", iso),
        supabase.from("rep_visits").select("id, outcome, employee_id").gte("started_at", iso),
        supabase.from("sales_invoices").select("total, rep_id").gte("invoice_date", iso).not("rep_id", "is", null),
        supabase.from("rep_routes").select("id, status").eq("route_date", dayStr),
      ]);
      const activeReps = new Set((ci.data ?? []).filter((r) => !r.check_out_at).map((r) => r.employee_id)).size;
      const totalSales = (invoices.data ?? []).reduce((s, r) => s + Number(r.total || 0), 0);
      const visitsDone = (visits.data ?? []).filter((v) => v.outcome).length;
      const routesDone = (routes.data ?? []).filter((r) => r.status === "done").length;
      const routesTotal = routes.data?.length ?? 0;
      return { activeReps, totalSales, visitsDone, visitsTotal: visits.data?.length ?? 0, routesDone, routesTotal };
    },
  });

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const cards = [
    { icon: Users, label: t("supervisor.activeReps"), value: data?.activeReps ?? "—", color: "text-emerald-600" },
    { icon: TrendingUp, label: t("supervisor.todaySales"), value: data ? fmt(data.totalSales) : "—", color: "text-primary" },
    { icon: MapPin, label: t("supervisor.visitsToday"), value: data ? `${data.visitsDone}/${data.visitsTotal}` : "—", color: "text-blue-600" },
    { icon: Receipt, label: t("supervisor.routesProgress"), value: data ? `${data.routesDone}/${data.routesTotal}` : "—", color: "text-violet-600" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <Card key={c.label}><CardContent className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{c.label}</span>
            <c.icon className={`h-5 w-5 ${c.color}`} />
          </div>
          <div className="text-2xl font-bold tabular-nums">{c.value}</div>
        </CardContent></Card>
      ))}
    </div>
  );
}