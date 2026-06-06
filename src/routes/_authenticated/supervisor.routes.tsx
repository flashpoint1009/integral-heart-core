import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { upsertRouteStops } from "@/lib/api/supervisor.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronUp, ChevronDown, X, Plus, Save, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/supervisor/routes")({
  component: RoutePlanner,
});

function RoutePlanner() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertRouteStops);
  const [repId, setRepId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [stops, setStops] = useState<{ id: string; name: string }[]>([]);
  const [q, setQ] = useState("");

  const { data: reps = [] } = useQuery({
    queryKey: ["supervisor_reps"],
    queryFn: async () => {
      const { data: ur } = await supabase.from("user_roles").select("user_id").eq("role", "sales_rep");
      const ids = (ur ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("employees").select("id, full_name, user_id").in("user_id", ids).eq("is_active", true);
      return data ?? [];
    },
  });

  useEffect(() => { if (!repId && reps[0]) setRepId(reps[0].id); }, [reps, repId]);

  const { data: existing = [] } = useQuery({
    queryKey: ["supervisor_route_existing", repId, date],
    enabled: !!repId,
    queryFn: async () => {
      const { data } = await supabase.from("rep_routes").select("sequence, customer_id, customers(id, name)").eq("employee_id", repId).eq("route_date", date).order("sequence");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (existing.length) setStops(existing.map((r: any) => ({ id: r.customers.id, name: r.customers.name })));
    else setStops([]);
  }, [existing, repId, date]);

  const { data: customers = [] } = useQuery({
    queryKey: ["supervisor_customers", q],
    queryFn: async () => {
      let qry = supabase.from("customers").select("id, name").eq("is_active", true).order("name").limit(30);
      if (q.trim()) qry = qry.ilike("name", `%${q}%`);
      return (await qry).data ?? [];
    },
  });

  const filteredCustomers = useMemo(() => customers.filter((c) => !stops.find((s) => s.id === c.id)), [customers, stops]);

  const move = (i: number, dir: -1 | 1) => {
    setStops((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const cp = [...s];
      [cp[i], cp[j]] = [cp[j], cp[i]];
      return cp;
    });
  };

  const save = useMutation({
    mutationFn: async () => await upsertFn({ data: { employee_id: repId, route_date: date, customer_ids: stops.map((s) => s.id) } }),
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["supervisor_route_existing"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4">
      <Card><CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>{t("supervisor.rep")}</Label>
            <Select value={repId} onValueChange={setRepId}>
              <SelectTrigger><SelectValue placeholder={t("supervisor.selectRep")} /></SelectTrigger>
              <SelectContent>{reps.map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("supervisor.date")}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">{t("supervisor.plannedStops")} ({stops.length})</h3>
            <Button size="sm" onClick={() => save.mutate()} disabled={!repId || save.isPending}><Save className="h-4 w-4 me-1" />{t("common.save")}</Button>
          </div>
          {stops.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8 border rounded-xl">{t("supervisor.noStops")}</div>
          ) : (
            <ol className="space-y-2">
              {stops.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2 border rounded-xl p-2 bg-card">
                  <span className="h-7 w-7 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold">{i + 1}</span>
                  <span className="flex-1 text-sm truncate">{s.name}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === stops.length - 1} onClick={() => move(i, +1)}><ChevronDown className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setStops((arr) => arr.filter((_, k) => k !== i))}><X className="h-3.5 w-3.5" /></Button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">{t("supervisor.addCustomers")}</h3>
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="ps-10" placeholder={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ul className="space-y-1.5 max-h-[420px] overflow-auto">
          {filteredCustomers.map((c) => (
            <li key={c.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
              <span className="text-sm truncate">{c.name}</span>
              <Button size="sm" variant="ghost" onClick={() => setStops((arr) => [...arr, { id: c.id, name: c.name }])}><Plus className="h-3.5 w-3.5" /></Button>
            </li>
          ))}
          {filteredCustomers.length === 0 && <li className="text-xs text-muted-foreground text-center py-6">—</li>}
        </ul>
      </CardContent></Card>
    </div>
  );
}