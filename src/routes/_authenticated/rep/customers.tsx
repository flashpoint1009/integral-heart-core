import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createRepCustomer } from "@/lib/api/rep.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Phone, MapPin, Search, Loader2, Play } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/rep/customers")({
  component: RepCustomers,
});

function getPos(): Promise<{ lat: number | null; lng: number | null }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat: null, lng: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

function RepCustomers() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const createCust = useServerFn(createRepCustomer);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "", address_notes: "" });
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gps, setGps] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });

  const { data: customers = [] } = useQuery({
    queryKey: ["rep_customers"],
    queryFn: async () => (await supabase.from("customers").select("id, name, phone, address, balance, lat, lng").eq("is_active", true).order("name").limit(500)).data ?? [],
  });

  const filtered = customers.filter((c) => !q || c.name?.toLowerCase().includes(q.toLowerCase()) || c.phone?.includes(q));

  const save = useMutation({
    mutationFn: async () => await createCust({ data: { ...form, lat: gps.lat ?? undefined, lng: gps.lng ?? undefined } }),
    onSuccess: () => { toast.success(t("common.saved")); setOpen(false); setForm({ name: "", phone: "", address: "", address_notes: "" }); setGps({ lat: null, lng: null }); qc.invalidateQueries({ queryKey: ["rep_customers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{t("rep.customers")}</h1>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 me-1" />{t("rep.addCustomer")}</Button>
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="ps-10 h-11 rounded-2xl" placeholder={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <ul className="space-y-2">
        {filtered.length === 0 ? (
          <li className="text-center text-sm text-muted-foreground py-10">{t("dashboard.noData")}</li>
        ) : filtered.map((c) => (
          <li key={c.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{c.name}</div>
                {c.phone && <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><Phone className="h-3 w-3" />{c.phone}</div>}
                {c.address && <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><MapPin className="h-3 w-3" />{c.address}</div>}
              </div>
              <div className="text-end shrink-0">
                <div className="text-[10px] text-muted-foreground">{t("rep.balance")}</div>
                <div className={`font-semibold tabular-nums ${Number(c.balance) > 0 ? "text-amber-600" : ""}`}>{fmt(Number(c.balance || 0))}</div>
              </div>
            </div>
            <Link to="/rep/visit/$customerId" params={{ customerId: c.id }} className="mt-3 inline-flex items-center justify-center gap-1 h-9 w-full rounded-xl bg-primary text-primary-foreground text-xs font-semibold">
              <Play className="h-3 w-3" />{t("rep.startVisit")}
            </Link>
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("rep.addCustomer")}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label>{t("customers.name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>{t("customers.phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>{t("customers.address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>{t("rep.landmark")}</Label><Input value={form.address_notes} onChange={(e) => setForm({ ...form, address_notes: e.target.value })} placeholder={t("rep.landmarkHint")} /></div>
            <Button variant="outline" type="button" disabled={gpsLoading} onClick={async () => { setGpsLoading(true); const p = await getPos(); setGps(p); setGpsLoading(false); toast.success(p.lat ? t("rep.gpsCaptured") : t("rep.gpsFailed")); }}>
              {gpsLoading ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <MapPin className="h-4 w-4 me-2" />}
              {gps.lat ? `📍 ${gps.lat.toFixed(4)}, ${gps.lng?.toFixed(4)}` : t("rep.captureLocation")}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}