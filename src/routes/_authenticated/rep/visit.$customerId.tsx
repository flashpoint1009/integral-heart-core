import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { startVisit, endVisit, collectFromVisit } from "@/lib/api/rep.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Phone, ShoppingCart, Wallet, X, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/rep/visit/$customerId")({
  component: VisitPage,
});

function getPos(): Promise<{ lat: number | null; lng: number | null }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat: null, lng: null });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

function VisitPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { customerId } = Route.useParams();
  const startFn = useServerFn(startVisit);
  const endFn = useServerFn(endVisit);
  const collectFn = useServerFn(collectFromVisit);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [collectOpen, setCollectOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");

  const { data: customer } = useQuery({
    queryKey: ["rep_visit_customer", customerId],
    queryFn: async () => (await supabase.from("customers").select("id, name, phone, address, address_notes, lat, lng, balance").eq("id", customerId).maybeSingle()).data,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["rep_visit_accounts"],
    queryFn: async () => {
      const { data } = await supabase.from("accounts").select("id, name, type").eq("is_active", true).order("name");
      const list = data ?? [];
      const def = list.find((a) => a.type === "cash") ?? list[0];
      if (def && !accountId) setAccountId(def.id);
      return list;
    },
  });

  // Auto-start visit on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pos = await getPos();
      try {
        const r = await startFn({ data: { customer_id: customerId, lat: pos.lat, lng: pos.lng } });
        if (!cancelled) setVisitId(r.id);
      } catch (e: any) {
        toast.error(e?.message ?? "Visit start failed");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const endMut = useMutation({
    mutationFn: async (outcome: "no_sale" | "not_found" | "rescheduled") => {
      if (!visitId) throw new Error("Visit not started");
      return await endFn({ data: { visit_id: visitId, outcome } });
    },
    onSuccess: () => { toast.success(t("rep.visitEnded")); navigate({ to: "/rep" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const collectMut = useMutation({
    mutationFn: async () => {
      if (!visitId) throw new Error("Visit not started");
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error(t("rep.invalidAmount"));
      if (!accountId) throw new Error(t("rep.selectAccount"));
      return await collectFn({ data: { visit_id: visitId, customer_id: customerId, amount: amt, account_id: accountId } });
    },
    onSuccess: () => { toast.success(t("rep.collected")); navigate({ to: "/rep" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-3xl p-5 text-white shadow-lg" style={{ background: "var(--gradient-hero)" }}>
        <div className="flex items-center gap-2 text-[11px] text-white/70 mb-1">
          {visitId ? <><CheckCircle2 className="h-3 w-3" />{t("rep.visitActive")}</> : <><Loader2 className="h-3 w-3 animate-spin" />{t("rep.startingVisit")}</>}
        </div>
        <h1 className="text-2xl font-bold">{customer?.name ?? "—"}</h1>
        <div className="mt-2 space-y-1 text-sm text-white/90">
          {customer?.phone && <div className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{customer.phone}</div>}
          {customer?.address && <div className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{customer.address}</div>}
          {customer?.address_notes && <div className="text-xs text-white/70">{customer.address_notes}</div>}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/20 pt-3">
          <span className="text-xs text-white/70">{t("rep.balance")}</span>
          <span className="text-lg font-bold tabular-nums">{fmt(Number(customer?.balance ?? 0))}</span>
        </div>
      </div>

      {!collectOpen ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              className="h-20 rounded-2xl flex-col gap-1"
              disabled={!visitId}
              onClick={() => navigate({ to: "/rep/sale", search: { visit: visitId!, customer: customerId } as any })}
            >
              <ShoppingCart className="h-6 w-6" />
              <span className="text-sm">{t("rep.makeSale")}</span>
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="h-20 rounded-2xl flex-col gap-1"
              disabled={!visitId}
              onClick={() => setCollectOpen(true)}
            >
              <Wallet className="h-6 w-6" />
              <span className="text-sm">{t("rep.collect")}</span>
            </Button>
          </div>

          <Card><CardContent className="p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">{t("rep.endVisitAs")}</div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" disabled={!visitId || endMut.isPending} onClick={() => endMut.mutate("no_sale")}>{t("rep.outcome.no_sale")}</Button>
              <Button variant="outline" size="sm" disabled={!visitId || endMut.isPending} onClick={() => endMut.mutate("not_found")}>{t("rep.outcome.not_found")}</Button>
              <Button variant="outline" size="sm" disabled={!visitId || endMut.isPending} onClick={() => endMut.mutate("rescheduled")}>{t("rep.outcome.rescheduled")}</Button>
            </div>
          </CardContent></Card>
        </>
      ) : (
        <Card><CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{t("rep.collect")}</h3>
            <Button size="icon" variant="ghost" onClick={() => setCollectOpen(false)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("payments.amount")}</Label>
            <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 text-lg" />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("payments.account")}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button size="lg" className="w-full h-12 rounded-2xl" disabled={collectMut.isPending} onClick={() => collectMut.mutate()}>
            {t("rep.confirmCollect")}
          </Button>
        </CardContent></Card>
      )}
    </div>
  );
}