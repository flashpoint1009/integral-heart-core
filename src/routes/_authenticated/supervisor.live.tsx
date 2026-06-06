import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LeafletMap, type MapMarker } from "@/components/map/LeafletMap";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/supervisor/live")({
  component: LiveMap,
});

function LiveMap() {
  const { t } = useTranslation();

  const { data } = useQuery({
    queryKey: ["supervisor_live"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const iso = today.toISOString();
      const [checkIns, visits, emps] = await Promise.all([
        supabase.from("rep_check_ins").select("employee_id, check_in_lat, check_in_lng, check_in_at, check_out_at").gte("check_in_at", iso),
        supabase.from("rep_visits").select("id, employee_id, customer_id, lat, lng, started_at, outcome, customers(name)").gte("started_at", iso).order("started_at", { ascending: false }),
        supabase.from("employees").select("id, full_name"),
      ]);
      return {
        checkIns: checkIns.data ?? [],
        visits: visits.data ?? [],
        emps: new Map((emps.data ?? []).map((e) => [e.id, e.full_name])),
      };
    },
  });

  const markers = useMemo<MapMarker[]>(() => {
    if (!data) return [];
    const out: MapMarker[] = [];
    const repLatest = new Map<string, { lat: number; lng: number; ts: string }>();
    for (const v of data.visits) {
      if (v.lat == null || v.lng == null) continue;
      const cur = repLatest.get(v.employee_id);
      if (!cur || cur.ts < v.started_at) repLatest.set(v.employee_id, { lat: Number(v.lat), lng: Number(v.lng), ts: v.started_at });
    }
    for (const c of data.checkIns) {
      if (c.check_in_lat == null || c.check_in_lng == null) continue;
      const cur = repLatest.get(c.employee_id);
      if (!cur || cur.ts < c.check_in_at) repLatest.set(c.employee_id, { lat: Number(c.check_in_lat), lng: Number(c.check_in_lng), ts: c.check_in_at });
    }
    for (const [empId, pos] of repLatest) {
      out.push({ id: `rep-${empId}`, lat: pos.lat, lng: pos.lng, label: data.emps.get(empId) ?? "Rep", color: "#2563eb" });
    }
    for (const v of data.visits.slice(0, 30)) {
      if (v.lat == null || v.lng == null) continue;
      const color = v.outcome === "sold" ? "#16a34a" : v.outcome === "collected" ? "#0891b2" : v.outcome ? "#a16207" : "#9ca3af";
      out.push({ id: `v-${v.id}`, lat: Number(v.lat), lng: Number(v.lng), label: `${(v.customers as any)?.name ?? ""} · ${v.outcome ?? "active"}`, color });
    }
    return out;
  }, [data]);

  const repRows = useMemo(() => {
    if (!data) return [] as Array<{ id: string; name: string; status: string }>;
    const map = new Map<string, { id: string; name: string; status: string }>();
    for (const c of data.checkIns) {
      const name = data.emps.get(c.employee_id) ?? "—";
      map.set(c.employee_id, { id: c.employee_id, name, status: c.check_out_at ? "ended" : "active" });
    }
    return Array.from(map.values());
  }, [data]);

  return (
    <div className="space-y-4">
      <LeafletMap markers={markers} />
      <Card><CardContent className="p-4">
        <h3 className="font-semibold mb-3">{t("supervisor.repsToday")}</h3>
        {repRows.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">{t("dashboard.noData")}</div>
        ) : (
          <ul className="divide-y">
            {repRows.map((r) => (
              <li key={r.id} className="py-2 flex items-center justify-between">
                <span className="text-sm font-medium">{r.name}</span>
                <Badge variant={r.status === "active" ? "default" : "outline"}>{t(`supervisor.status.${r.status}`)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent></Card>
    </div>
  );
}