import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, MapPin, Crosshair } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — ERP" }] }),
  component: Page,
});

type Settings = {
  id?: string;
  company_name: string;
  logo_url: string | null;
  currency: string;
  currency_symbol: string;
  default_tax_rate: number;
  default_locale: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_number: string | null;
  extra?: any;
};

const blank: Settings = {
  company_name: "My Company", logo_url: "", currency: "EGP", currency_symbol: "ج.م",
  default_tax_rate: 14, default_locale: "ar",
  address: "", phone: "", email: "", tax_number: "",
  extra: {},
};

function Page() {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const qc = useQueryClient();
  const [form, setForm] = useState<Settings>(blank);

  const { data, isLoading } = useQuery({
    queryKey: ["company_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as Settings | null;
    },
  });

  useEffect(() => { if (data) setForm({ ...blank, ...data }); }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const extra = {
        ...(form.extra ?? {}),
        office_lat: form.extra?.office_lat ?? null,
        office_lng: form.extra?.office_lng ?? null,
        office_radius_m: Number(form.extra?.office_radius_m ?? 150) || 150,
      };
      const payload = {
        company_name: form.company_name,
        logo_url: form.logo_url || null,
        currency: form.currency,
        currency_symbol: form.currency_symbol,
        default_tax_rate: Number(form.default_tax_rate) || 0,
        default_locale: form.default_locale,
        address: form.address || null,
        phone: form.phone || null,
        email: form.email || null,
        tax_number: form.tax_number || null,
        extra,
      };
      if (data?.id) {
        const { error } = await supabase.from("company_settings").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company_settings"] }); toast.success(t("common.saved")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setExtra = (k: string, v: any) => setForm((f) => ({ ...f, extra: { ...(f.extra ?? {}), [k]: v } }));

  const captureLocation = () => {
    if (!navigator.geolocation) { toast.error("الجهاز لا يدعم GPS"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setExtra("office_lat", Number(pos.coords.latitude.toFixed(6)));
        setExtra("office_lng", Number(pos.coords.longitude.toFixed(6)));
        toast.success("تم تحديد موقع الشركة");
      },
      (err) => toast.error("فشل GPS: " + err.message),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title={t("settings.title")}
        description={t("settings.description")}
        actions={isAdmin ? (
          <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading}>
            <Save className="me-2 h-4 w-4" />{t("common.save")}
          </Button>
        ) : undefined}
      />
      {!isAdmin && <p className="text-sm text-muted-foreground">{t("users.onlyAdmin")}</p>}
      <Card>
        <CardContent className="pt-6 grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5 md:col-span-2"><Label>{t("settings.company_name")}</Label><Input disabled={!isAdmin} value={form.company_name} onChange={(e) => set("company_name", e.target.value)} /></div>
          <div className="grid gap-1.5 md:col-span-2"><Label>{t("settings.logo_url")}</Label><Input disabled={!isAdmin} value={form.logo_url ?? ""} onChange={(e) => set("logo_url", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>{t("settings.currency")}</Label><Input disabled={!isAdmin} value={form.currency} onChange={(e) => set("currency", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>{t("settings.currency_symbol")}</Label><Input disabled={!isAdmin} value={form.currency_symbol} onChange={(e) => set("currency_symbol", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>{t("settings.default_tax_rate")}</Label><Input disabled={!isAdmin} type="number" step="0.01" value={form.default_tax_rate} onChange={(e) => set("default_tax_rate", Number(e.target.value))} /></div>
          <div className="grid gap-1.5"><Label>{t("settings.default_locale")}</Label>
            <select disabled={!isAdmin} className="h-9 rounded-md border bg-background px-2 text-sm" value={form.default_locale} onChange={(e) => set("default_locale", e.target.value)}>
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="grid gap-1.5"><Label>{t("settings.phone")}</Label><Input disabled={!isAdmin} value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>{t("settings.email")}</Label><Input disabled={!isAdmin} type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>{t("settings.tax_number")}</Label><Input disabled={!isAdmin} value={form.tax_number ?? ""} onChange={(e) => set("tax_number", e.target.value)} /></div>
          <div className="grid gap-1.5 md:col-span-2"><Label>{t("settings.address")}</Label><Textarea rows={2} disabled={!isAdmin} value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />موقع الشركة (الحضور التلقائي)</div>
              <p className="text-xs text-muted-foreground mt-1">يسجّل الموظف الحضور تلقائياً عند الوصول لهذا الموقع من الموبايل.</p>
            </div>
            <Button type="button" variant="outline" disabled={!isAdmin} onClick={captureLocation}>
              <Crosshair className="h-4 w-4 me-2" />التقاط الموقع الحالي
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>خط العرض (Latitude)</Label>
              <Input disabled={!isAdmin} type="number" step="0.000001" value={form.extra?.office_lat ?? ""} onChange={(e) => setExtra("office_lat", e.target.value === "" ? null : Number(e.target.value))} placeholder="30.0444" />
            </div>
            <div className="grid gap-1.5">
              <Label>خط الطول (Longitude)</Label>
              <Input disabled={!isAdmin} type="number" step="0.000001" value={form.extra?.office_lng ?? ""} onChange={(e) => setExtra("office_lng", e.target.value === "" ? null : Number(e.target.value))} placeholder="31.2357" />
            </div>
            <div className="grid gap-1.5">
              <Label>نطاق الحضور (متر)</Label>
              <Input disabled={!isAdmin} type="number" min={20} max={5000} step="10" value={form.extra?.office_radius_m ?? 150} onChange={(e) => setExtra("office_radius_m", Number(e.target.value))} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}