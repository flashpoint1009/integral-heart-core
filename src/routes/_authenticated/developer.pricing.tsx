import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listPricingPlans,
  upsertPricingPlan,
  deletePricingPlan,
  type PricingPlan,
} from "@/lib/api/pricing.functions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Star, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/developer/pricing")({
  head: () => ({ meta: [{ title: "أسعار اللاندينج — المطور" }] }),
  component: PricingAdmin,
});

type Draft = Omit<PricingPlan, "id"> & { id?: string };

const blank = (): Draft => ({
  name: "",
  tagline: "",
  price_egp: 0,
  price_label: "",
  period: "شهرياً",
  features: [],
  is_featured: false,
  is_active: true,
  sort_order: 99,
  cta_label: "ابدأ الآن",
});

function PricingAdmin() {
  const { isDeveloper, hasRole } = useAuth();
  const canSee = isDeveloper || hasRole("admin");

  const listFn = useServerFn(listPricingPlans);
  const saveFn = useServerFn(upsertPricingPlan);
  const delFn = useServerFn(deletePricingPlan);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["pricing_plans_admin"],
    queryFn: () => listFn(),
    enabled: canSee,
  });

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const plans = data?.plans ?? [];

  const items = useMemo(() => {
    const map: Record<string, Draft> = {};
    for (const p of plans) {
      map[p.id] = { ...p, tagline: p.tagline ?? "", price_label: p.price_label ?? "", cta_label: p.cta_label ?? "" };
    }
    return { ...map, ...drafts };
  }, [plans, drafts]);

  const setField = (key: string, patch: Partial<Draft>) => {
    setDrafts((d) => ({ ...d, [key]: { ...(items[key] ?? blank()), ...patch } }));
  };

  const saveMut = useMutation({
    mutationFn: (key: string) => {
      const p = items[key];
      return saveFn({
        data: {
          ...(p.id ? { id: p.id } : {}),
          name: p.name,
          tagline: p.tagline || null,
          price_egp: Number(p.price_egp) || 0,
          price_label: p.price_label || null,
          period: p.period,
          features: p.features.filter((x) => x.trim()),
          is_featured: p.is_featured,
          is_active: p.is_active,
          sort_order: Number(p.sort_order) || 0,
          cta_label: p.cta_label || null,
        },
      });
    },
    onSuccess: (_r, key) => {
      toast.success("تم الحفظ");
      setDrafts((d) => { const c = { ...d }; delete c[key]; return c; });
      qc.invalidateQueries({ queryKey: ["pricing_plans_admin"] });
      qc.invalidateQueries({ queryKey: ["public_pricing_plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["pricing_plans_admin"] });
      qc.invalidateQueries({ queryKey: ["public_pricing_plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addNew = () => {
    const key = "new_" + Math.random().toString(36).slice(2, 8);
    setDrafts((d) => ({ ...d, [key]: blank() }));
  };

  if (!canSee) {
    return <div className="p-6"><PageHeader title="غير مصرح" description="للمطور والمدير فقط" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="أسعار الاشتراكات (لاندينج بيج)"
        description="عدّل الباقات الظاهرة لزوار الموقع. القيم بالجنيه المصري (EGP)."
      />

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">إجمالي الباقات: {Object.keys(items).length}</p>
        <Button onClick={addNew}><Plus className="h-4 w-4 ml-1" /> باقة جديدة</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(items)
          .sort((a, b) => (a[1].sort_order ?? 99) - (b[1].sort_order ?? 99))
          .map(([key, p]) => {
            const dirty = !!drafts[key];
            return (
              <Card key={key} className={p.is_featured ? "border-primary" : ""}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      {p.name || "(بدون اسم)"}
                      {p.is_featured && <Badge variant="default"><Star className="h-3 w-3 ml-1" /> مميزة</Badge>}
                      {!p.is_active && <Badge variant="secondary">معطلة</Badge>}
                      {dirty && <Badge variant="outline">غير محفوظ</Badge>}
                    </span>
                    {p.id && (
                      <Button size="icon" variant="ghost" onClick={() => {
                        if (confirm(`حذف باقة "${p.name}"؟`)) delMut.mutate(p.id!);
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>اسم الباقة</Label>
                      <Input value={p.name} onChange={(e) => setField(key, { name: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <Label>الوصف القصير</Label>
                      <Input value={p.tagline ?? ""} onChange={(e) => setField(key, { tagline: e.target.value })} />
                    </div>
                    <div>
                      <Label>السعر (جنيه مصري)</Label>
                      <Input type="number" min={0} value={p.price_egp} onChange={(e) => setField(key, { price_egp: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label>الدورة (مثل "شهرياً")</Label>
                      <Input value={p.period} onChange={(e) => setField(key, { period: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <Label>نص بديل للسعر (اختياري، مثل "حسب الطلب")</Label>
                      <Input value={p.price_label ?? ""} onChange={(e) => setField(key, { price_label: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <Label>المميزات (سطر لكل ميزة)</Label>
                      <Textarea
                        rows={6}
                        value={p.features.join("\n")}
                        onChange={(e) => setField(key, { features: e.target.value.split("\n") })}
                      />
                    </div>
                    <div>
                      <Label>نص الزر</Label>
                      <Input value={p.cta_label ?? ""} onChange={(e) => setField(key, { cta_label: e.target.value })} />
                    </div>
                    <div>
                      <Label>ترتيب الظهور</Label>
                      <Input type="number" min={0} value={p.sort_order} onChange={(e) => setField(key, { sort_order: Number(e.target.value) })} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={p.is_featured} onCheckedChange={(v) => setField(key, { is_featured: v })} />
                      <Label>الأكثر شعبية</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={p.is_active} onCheckedChange={(v) => setField(key, { is_active: v })} />
                      <Label>نشطة (ظاهرة)</Label>
                    </div>
                  </div>
                  <Button
                    onClick={() => saveMut.mutate(key)}
                    disabled={saveMut.isPending || !p.name}
                    className="w-full"
                  >
                    <Save className="h-4 w-4 ml-1" />
                    {saveMut.isPending ? "جاري الحفظ..." : "حفظ"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
}