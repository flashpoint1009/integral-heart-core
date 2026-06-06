import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/supervisor/reports")({
  component: SupervisorReports,
});

function SupervisorReports() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(() => new Date(new Date().setDate(new Date().getDate() - 6)).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const { data } = useQuery({
    queryKey: ["supervisor_reports", from, to],
    queryFn: async () => {
      const fromIso = new Date(from + "T00:00:00").toISOString();
      const toIso = new Date(to + "T23:59:59").toISOString();
      const [visits, invoices, emps, payments, routes] = await Promise.all([
        supabase.from("rep_visits").select("employee_id, outcome, started_at").gte("started_at", fromIso).lte("started_at", toIso),
        supabase.from("sales_invoices").select("rep_id, total, invoice_date").gte("invoice_date", from).lte("invoice_date", to).not("rep_id", "is", null),
        supabase.from("employees").select("id, full_name"),
        supabase.from("customer_payments").select("amount, payment_date").gte("payment_date", fromIso).lte("payment_date", toIso),
        supabase.from("rep_routes").select("employee_id, status, route_date").gte("route_date", from).lte("route_date", to),
      ]);
      const empMap = new Map((emps.data ?? []).map((e) => [e.id, e.full_name]));
      const perRep = new Map<string, { name: string; visits: number; sold: number; sales: number; planned: number; done: number }>();
      const get = (id: string) => {
        let r = perRep.get(id);
        if (!r) { r = { name: empMap.get(id) ?? "—", visits: 0, sold: 0, sales: 0, planned: 0, done: 0 }; perRep.set(id, r); }
        return r;
      };
      for (const v of visits.data ?? []) {
        const r = get(v.employee_id);
        r.visits++;
        if (v.outcome === "sold") r.sold++;
      }
      for (const inv of invoices.data ?? []) {
        if (!inv.rep_id) continue;
        const r = get(inv.rep_id);
        r.sales += Number(inv.total || 0);
      }
      for (const rt of routes.data ?? []) {
        const r = get(rt.employee_id);
        r.planned++;
        if (rt.status === "done") r.done++;
      }
      const totalPayments = (payments.data ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
      return { rows: Array.from(perRep.values()).sort((a, b) => b.sales - a.sales), totalPayments };
    },
  });

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div className="grid gap-1.5"><Label>{t("reports.from")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="grid gap-1.5"><Label>{t("reports.to")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><div className="text-[11px] uppercase text-muted-foreground">{t("supervisor.collectionsTotal")}</div><div className="text-xl font-bold tabular-nums">{data ? fmt(data.totalPayments) : "—"}</div></div>
      </CardContent></Card>

      <Card><CardContent className="p-0">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-start p-3">{t("supervisor.rep")}</th>
                <th className="text-end p-3">{t("supervisor.visits")}</th>
                <th className="text-end p-3">{t("supervisor.sold")}</th>
                <th className="text-end p-3">{t("supervisor.salesTotal")}</th>
                <th className="text-end p-3">{t("supervisor.routeAdherence")}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3 text-end tabular-nums">{r.visits}</td>
                  <td className="p-3 text-end tabular-nums">{r.sold}</td>
                  <td className="p-3 text-end tabular-nums font-semibold">{fmt(r.sales)}</td>
                  <td className="p-3 text-end tabular-nums">{r.planned ? `${r.done}/${r.planned}` : "—"}</td>
                </tr>
              ))}
              {(!data?.rows.length) && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t("dashboard.noData")}</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}