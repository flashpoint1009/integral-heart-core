import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { getAuthBranding, updateAuthBranding } from "@/lib/api/notifications.functions";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2, X, Image as ImageIcon, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/developer/branding")({
  head: () => ({ meta: [{ title: "تخصيص شاشة الدخول" }] }),
  component: BrandingPage,
});

function BrandingPage() {
  const { isDeveloper, hasRole } = useAuth();
  const allowed = isDeveloper || hasRole("admin");
  const qc = useQueryClient();
  const getFn = useServerFn(getAuthBranding);
  const updateFn = useServerFn(updateAuthBranding);

  const { data } = useQuery({ queryKey: ["auth_branding_edit"], queryFn: () => getFn(), enabled: allowed });

  const [form, setForm] = useState({ logo_url: "", hero_image_url: "", title: "", subtitle: "" });
  const [uploading, setUploading] = useState<"logo" | "hero" | null>(null);

  useEffect(() => {
    const b = data?.branding as any;
    if (b) setForm({
      logo_url: b.logo_url ?? "",
      hero_image_url: b.hero_image_url ?? "",
      title: b.title ?? "",
      subtitle: b.subtitle ?? "",
    });
  }, [data]);

  async function uploadImage(field: "logo" | "hero", file: File) {
    if (file.size > 5 * 1024 * 1024) return toast.error("الحد الأقصى 5MB");
    setUploading(field);
    try {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const path = `${field}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("auth-images").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("auth-images").getPublicUrl(path);
      setForm((p) => ({ ...p, [field === "logo" ? "logo_url" : "hero_image_url"]: pub.publicUrl }));
      toast.success("تم الرفع");
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الرفع");
    } finally {
      setUploading(null);
    }
  }

  const saveMut = useMutation({
    mutationFn: () => updateFn({ data: form }),
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["auth_branding"] });
      qc.invalidateQueries({ queryKey: ["auth_branding_edit"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحفظ"),
  });

  if (!allowed) return <div className="p-6"><Card><CardContent className="p-8 text-center text-muted-foreground">غير مصرّح</CardContent></Card></div>;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      <PageHeader title="تخصيص شاشة الدخول" description="غيّر الشعار، صورة الخلفية، والنصوص" />

      <Card>
        <CardContent className="p-6 grid md:grid-cols-2 gap-6">
          {/* Logo */}
          <div>
            <Label className="mb-2 block">الشعار (Logo)</Label>
            <div className="relative aspect-square w-40 rounded-2xl border-2 border-dashed overflow-hidden bg-muted/30 mb-2">
              {form.logo_url ? (
                <img src={form.logo_url} alt="logo" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                  <ImageIcon className="h-10 w-10 opacity-40" />
                </div>
              )}
              {uploading === "logo" && <div className="absolute inset-0 grid place-items-center bg-background/80"><Loader2 className="h-6 w-6 animate-spin" /></div>}
            </div>
            <div className="flex gap-2">
              <label className="flex-1">
                <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadImage("logo", e.target.files[0])} />
                <span className="inline-flex w-full h-9 cursor-pointer items-center justify-center gap-2 rounded-md border bg-card text-sm font-medium hover:bg-accent">
                  <Upload className="h-4 w-4" /> رفع شعار
                </span>
              </label>
              {form.logo_url && (
                <Button variant="outline" size="icon" onClick={() => setForm({ ...form, logo_url: "" })}><X className="h-4 w-4" /></Button>
              )}
            </div>
          </div>

          {/* Hero image */}
          <div>
            <Label className="mb-2 block">صورة الخلفية (Hero)</Label>
            <div className="relative aspect-video w-full rounded-2xl border-2 border-dashed overflow-hidden bg-muted/30 mb-2">
              {form.hero_image_url ? (
                <img src={form.hero_image_url} alt="hero" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                  <ImageIcon className="h-10 w-10 opacity-40" />
                </div>
              )}
              {uploading === "hero" && <div className="absolute inset-0 grid place-items-center bg-background/80"><Loader2 className="h-6 w-6 animate-spin" /></div>}
            </div>
            <div className="flex gap-2">
              <label className="flex-1">
                <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadImage("hero", e.target.files[0])} />
                <span className="inline-flex w-full h-9 cursor-pointer items-center justify-center gap-2 rounded-md border bg-card text-sm font-medium hover:bg-accent">
                  <Upload className="h-4 w-4" /> رفع صورة
                </span>
              </label>
              {form.hero_image_url && (
                <Button variant="outline" size="icon" onClick={() => setForm({ ...form, hero_image_url: "" })}><X className="h-4 w-4" /></Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">العنوان الرئيسي</Label>
            <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subtitle">النص الفرعي</Label>
            <Textarea id="subtitle" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} maxLength={240} rows={3} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} size="lg" className="gap-2">
          {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          حفظ التغييرات
        </Button>
      </div>
    </div>
  );
}