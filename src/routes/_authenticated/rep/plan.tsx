import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/rep/plan")({
  component: RepRoutePage,
});

function RepRoutePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: route = [] } = useQuery({
    queryKey: ["rep_route_today", user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data: emp } = await supabase.from("employees").select("id").eq("user_id", user!.id).maybeSingle();
      if (!emp) return [];
      const { data } = await supabase
        .from("rep_routes")
        .select("id, sequence, status, notes, customers(id, name, phone, address, lat, lng)")
        .eq("employee_id", emp.id)
        .eq("route_date", today)
        .order("sequence", { ascending: true });
      return data ?? [];
    },
    enabled: !!user,
  });

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">{t("rep.routeToday")}</h1>
      <p className="text-xs text-muted-foreground">{t("rep.routeHint")}</p>

      {route.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{t("rep.noRoute")}</CardContent></Card>
      ) : (
        <ol className="space-y-2">
          {route.map((r: any, idx: number) => {
            const c = r.customers;
            const done = r.status === "done";
            const skipped = r.status === "skipped";
            return (
              <li key={r.id} className={`rounded-2xl border p-4 flex items-center gap-3 ${done ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20" : skipped ? "opacity-60" : "bg-card"}`}>
                <div className={`h-9 w-9 rounded-full grid place-items-center text-sm font-bold shrink-0 ${done ? "bg-emerald-500 text-white" : "bg-primary/10 text-primary"}`}>
                  {done ? <Check className="h-4 w-4" /> : (idx + 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c?.name ?? "—"}</div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {c?.phone && <span>{c.phone}</span>}
                    {c?.address && <span className="truncate">· {c.address}</span>}
                  </div>
                </div>
                {!done && c?.id && (
                  <Link to="/rep/visit/$customerId" params={{ customerId: c.id }} className="shrink-0">
                    <button className="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1"><Play className="h-3 w-3" />{t("rep.startVisit")}</button>
                  </Link>
                )}
                <Badge variant={done ? "default" : skipped ? "outline" : "secondary"} className="text-[10px]">
                  {t(`rep.routeStatus.${r.status}`)}
                </Badge>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}