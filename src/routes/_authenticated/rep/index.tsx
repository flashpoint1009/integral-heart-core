import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, MapPin, Receipt, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rep/")({
  component: RepHome,
});

function RepHome() {
  const { t } = useTranslation();

  const { data } = useQuery({
    queryKey: ["rep_dashboard_today"],
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const iso = today.toISOString();
      const [ci, visits, invoices, routes] = await Promise.all([
        supabase.from("rep_check_ins").select("id, check_in_at, check_out_at").gte("check_in_at", iso).order("check_in_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("rep_visits").select("id, outcome", { count: "exact" }).gte("started_at", iso),
        supabase.from("sales_invoices").select("total").gte("invoice_date", iso),
        supabase.from("rep_routes").select("id, status", { count: "exact" }).eq("route_date", today.toISOString().slice(0, 10)),
      ]);
      const sales = (invoices.data ?? []).reduce((s, r) => s + Number(r.total || 0), 0);
      const visitCount = visits.count ?? 0;
      const routeTotal = routes.count ?? 0;
      const routeDone = (routes.data ?? []).filter((r) => r.status === "done").length;
      return { checkIn: ci.data, sales, visitCount, routeTotal, routeDone };
    },
  });

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-3xl p-5 text-white shadow-lg overflow-hidden relative" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute -top-10 -end-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative space-y-1">
          <p className="text-xs text-white/70">{t("rep.greeting")}</p>
          <h1 className="text-xl font-bold">{t("rep.dashboardTitle")}</h1>
          <p className="text-sm text-white/80">
            {data?.checkIn ? (data.checkIn.check_out_at ? t("rep.dayEnded") : t("rep.dayActive")) : t("rep.notCheckedIn")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-4 space-y-1">
          <div className="flex items-center justify-between"><span className="text-[11px] text-muted-foreground uppercase">{t("rep.todaySales")}</span><TrendingUp className="h-4 w-4 text-emerald-600" /></div>
          <div className="text-2xl font-bold tabular-nums">{data ? fmt(data.sales) : "—"}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 space-y-1">
          <div className="flex items-center justify-between"><span className="text-[11px] text-muted-foreground uppercase">{t("rep.visitsCount")}</span><MapPin className="h-4 w-4 text-blue-600" /></div>
          <div className="text-2xl font-bold tabular-nums">{data?.visitCount ?? "—"}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 space-y-1">
          <div className="flex items-center justify-between"><span className="text-[11px] text-muted-foreground uppercase">{t("rep.routeProgress")}</span><Calendar className="h-4 w-4 text-violet-600" /></div>
          <div className="text-2xl font-bold tabular-nums">{data ? `${data.routeDone}/${data.routeTotal}` : "—"}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 space-y-1">
          <div className="flex items-center justify-between"><span className="text-[11px] text-muted-foreground uppercase">{t("rep.checkIn")}</span><Receipt className="h-4 w-4 text-amber-600" /></div>
          <div className="text-sm font-semibold">{data?.checkIn?.check_in_at ? new Date(data.checkIn.check_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/rep/attendance" className="rounded-2xl border bg-card p-4 flex flex-col items-center justify-center gap-2 hover:bg-accent transition-colors">
          <MapPin className="h-6 w-6 text-primary" />
          <span className="text-sm font-semibold">{t("rep.attendance")}</span>
        </Link>
        <Link to="/rep/sale" className="rounded-2xl border bg-card p-4 flex flex-col items-center justify-center gap-2 hover:bg-accent transition-colors">
          <Receipt className="h-6 w-6 text-primary" />
          <span className="text-sm font-semibold">{t("rep.quickSale")}</span>
        </Link>
      </div>
    </div>
  );
}