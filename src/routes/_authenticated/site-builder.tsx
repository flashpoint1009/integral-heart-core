import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getSiteConfigPublic, saveSiteConfig } from "@/lib/api/storefront.functions";
import { PageHeader } from "@/components/app/page-header";
import { ImageUploader } from "@/components/app/image-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Image as ImageIcon, Layers, Type, Tags, Plus, Save, ExternalLink, Eye, Globe, Palette, Menu, Search, LayoutGrid } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/site-builder")({
  head: () => ({ meta: [{ title: "Site Builder — ERP" }] }),
  component: Builder,
});

type Section =
  | { id: string; type: "banner"; props: { title: string; subtitle?: string; image?: string | null; cta?: string } }
  | { id: string; type: "categories"; props: { title?: string } }
  | { id: string; type: "products"; props: { title?: string; categoryId?: string | null; limit?: number } }
  | { id: string; type: "text"; props: { title?: string; body?: string } }
  | { id: string; type: "image"; props: { url: string | null; alt?: string } }
  | { id: string; type: "features"; props: { title?: string; items?: { icon: string; label: string }[] } };

const TYPES: { type: Section["type"]; label: string; icon: any }[] = [
  { type: "banner", label: "بانر", icon: ImageIcon },
  { type: "categories", label: "أقسام", icon: Tags },
  { type: "products", label: "منتجات", icon: Layers },
  { type: "text", label: "نص", icon: Type },
  { type: "image", label: "صورة", icon: ImageIcon },
  { type: "features", label: "مميزات", icon: LayoutGrid },
];

const THEMES = [
  { key: "modern", name: "عصري", desc: "ألوان زاهية، حواف ناعمة", primary: "#6366f1", secondary: "#a855f7" },
  { key: "elegant", name: "أنيق", desc: "ذهبي وأسود فاخر", primary: "#c9a84c", secondary: "#1a1a1a" },
  { key: "bold", name: "جريء", desc: "تباين عالٍ، نيون", primary: "#ff4d6d", secondary: "#06d6a0" },
  { key: "minimal", name: "بسيط", desc: "أبيض/أسود تايبوجرافي", primary: "#111827", secondary: "#6b7280" },
  { key: "classic", name: "كلاسيكي", desc: "كحلي ثقة وأمان", primary: "#1e3a8a", secondary: "#3b82f6" },
] as const;

function newSection(type: Section["type"]): Section {
  const id = "s_" + Math.random().toString(36).slice(2, 9);
  switch (type) {
    case "banner": return { id, type, props: { title: "عنوان البانر", subtitle: "وصف قصير", cta: "تسوّق الآن", image: null } };
    case "categories": return { id, type, props: { title: "تسوّق حسب القسم" } };
    case "products": return { id, type, props: { title: "منتجات مميزة", limit: 12, categoryId: null } };
    case "text": return { id, type, props: { title: "عنوان", body: "النص هنا" } };
    case "image": return { id, type, props: { url: null, alt: "" } };
    case "features": return { id, type, props: { title: "مميزاتنا", items: [
      { icon: "🚚", label: "توصيل سريع" },
      { icon: "💳", label: "دفع عند الاستلام" },
      { icon: "✨", label: "جودة مضمونة" },
    ] } };
  }
}

type NavItem = { id: string; label: string; url: string };
type Banner = { id: string; image: string | null; title?: string; subtitle?: string; link?: string };

function Builder() {
  const fetchCfg = useServerFn(getSiteConfigPublic);
  const save = useServerFn(saveSiteConfig);
  const { data, refetch } = useQuery({ queryKey: ["site_cfg_builder"], queryFn: () => fetchCfg() });

  const [siteName, setSiteName] = useState("");
  const [theme, setTheme] = useState<string>("modern");
  const [primary, setPrimary] = useState("#1e3a8a");
  const [secondary, setSecondary] = useState("#3b82f6");
  const [shape, setShape] = useState<"square" | "rounded" | "circle">("rounded");
  const [logo, setLogo] = useState<string | null>(null);
  const [hero, setHero] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [published, setPublished] = useState(true);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enableSearch, setEnableSearch] = useState(true);
  const [enableMenu, setEnableMenu] = useState(true);
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [customDomain, setCustomDomain] = useState("");

  useEffect(() => {
    const c = data?.config;
    if (!c) return;
    setSiteName(c.site_name ?? "");
    setTheme(c.theme_preset ?? "modern");
    setPrimary(c.primary_color ?? "#1e3a8a");
    setSecondary(c.secondary_color ?? "#3b82f6");
    setShape((c.card_shape as any) ?? "rounded");
    setLogo(c.logo_url ?? null);
    setHero(c.hero_image ?? null);
    setPhone(c.contact_phone ?? "");
    setAddress(c.contact_address ?? "");
    setPublished(c.is_published ?? true);
    setSections(Array.isArray(c.sections) ? (c.sections as any) : []);
    setEnableSearch(c.enable_search ?? true);
    setEnableMenu(c.enable_menu ?? true);
    setNavItems(Array.isArray(c.nav_items) ? (c.nav_items as any) : []);
    setBanners(Array.isArray(c.banners) ? (c.banners as any) : []);
    setCustomDomain(c.custom_domain ?? "");
  }, [data]);

  function applyTheme(key: string) {
    setTheme(key);
    const th = THEMES.find((t) => t.key === key);
    if (th) { setPrimary(th.primary); setSecondary(th.secondary); }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = sections.findIndex((s) => s.id === active.id);
    const newIdx = sections.findIndex((s) => s.id === over.id);
    setSections(arrayMove(sections, oldIdx, newIdx));
  }

  const m = useMutation({
    mutationFn: () => save({ data: {
      site_name: siteName, logo_url: logo, primary_color: primary, secondary_color: secondary,
      theme_preset: theme as any, card_shape: shape, hero_image: hero,
      contact_phone: phone || null, contact_address: address || null,
      enable_search: enableSearch, enable_menu: enableMenu,
      nav_items: navItems, banners,
      custom_domain: customDomain || null,
      sections, is_published: published,
    }}),
    onSuccess: () => { toast.success("تم الحفظ"); refetch(); },
    onError: (e: any) => toast.error(e.message ?? "فشل الحفظ"),
  });

  const selected = sections.find((s) => s.id === selectedId);

  function patchSelected(props: any) {
    setSections(sections.map((s) => s.id === selectedId ? { ...s, props: { ...s.props, ...props } } : s));
  }

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="بناء الموقع"
        description="تيمات جاهزة + سحب وإفلات للأقسام"
        actions={
          <div className="flex items-center gap-2">
            <a href="/shop" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm underline">
              <ExternalLink className="h-4 w-4" /> معاينة المتجر
            </a>
            <Button onClick={() => m.mutate()} disabled={m.isPending}>
              <Save className="h-4 w-4 me-1" /> حفظ
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="design" className="mt-4">
        <TabsList className="grid grid-cols-5 max-w-2xl">
          <TabsTrigger value="design"><Palette className="h-4 w-4 me-1" />التصميم</TabsTrigger>
          <TabsTrigger value="header"><Menu className="h-4 w-4 me-1" />الهيدر</TabsTrigger>
          <TabsTrigger value="banners"><ImageIcon className="h-4 w-4 me-1" />البانرات</TabsTrigger>
          <TabsTrigger value="layout"><Layers className="h-4 w-4 me-1" />الأقسام</TabsTrigger>
          <TabsTrigger value="domain"><Globe className="h-4 w-4 me-1" />الدومين</TabsTrigger>
        </TabsList>

        <TabsContent value="design" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-bold">اختر ثيم جاهز</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {THEMES.map((th) => (
                    <button key={th.key} onClick={() => applyTheme(th.key)}
                      className={`text-start rounded-xl border-2 p-3 transition ${theme === th.key ? "border-primary shadow-md" : "border-border hover:border-primary/50"}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="h-6 w-6 rounded-full border" style={{ background: th.primary }} />
                        <span className="h-6 w-6 rounded-full border" style={{ background: th.secondary }} />
                        <span className="font-bold text-sm">{th.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{th.desc}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-bold">الهوية</h3>
                <div><Label>اسم الموقع</Label><Input value={siteName} onChange={(e) => setSiteName(e.target.value)} /></div>
                <ImageUploader label="الشعار" value={logo} onChange={setLogo} folder="logo" aspect="square" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>اللون الأساسي</Label>
                    <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-full rounded border" />
                  </div>
                  <div>
                    <Label>اللون الثانوي</Label>
                    <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="h-10 w-full rounded border" />
                  </div>
                </div>
                <div>
                  <Label>شكل الكروت</Label>
                  <Select value={shape} onValueChange={(v: any) => setShape(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="square">مربع</SelectItem>
                      <SelectItem value="rounded">مدور الأطراف</SelectItem>
                      <SelectItem value="circle">دائري</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between"><Label>منشور</Label>
                  <Switch checked={published} onCheckedChange={setPublished} /></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="header" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-bold flex items-center gap-2"><Search className="h-4 w-4" /> مكونات الهيدر</h3>
                <div className="flex items-center justify-between">
                  <Label>إظهار شريط البحث</Label>
                  <Switch checked={enableSearch} onCheckedChange={setEnableSearch} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>إظهار القائمة الجانبية</Label>
                  <Switch checked={enableMenu} onCheckedChange={setEnableMenu} />
                </div>
                <div><Label>الهاتف</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                <div><Label>العنوان</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">روابط القائمة</h3>
                  <Button size="sm" variant="outline" onClick={() => setNavItems([...navItems, { id: "n_" + Math.random().toString(36).slice(2, 8), label: "رابط", url: "/" }])}>
                    <Plus className="h-4 w-4 me-1" />إضافة
                  </Button>
                </div>
                <div className="space-y-2">
                  {navItems.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد روابط</p>}
                  {navItems.map((n) => (
                    <div key={n.id} className="flex gap-2">
                      <Input placeholder="الاسم" value={n.label} onChange={(e) => setNavItems(navItems.map(x => x.id === n.id ? { ...x, label: e.target.value } : x))} />
                      <Input placeholder="/" value={n.url} onChange={(e) => setNavItems(navItems.map(x => x.id === n.id ? { ...x, url: e.target.value } : x))} />
                      <Button size="icon" variant="ghost" onClick={() => setNavItems(navItems.filter(x => x.id !== n.id))}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="banners" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold">سلايدر البانرات الرئيسية</h3>
                  <p className="text-xs text-muted-foreground">صور تظهر في أعلى الصفحة الرئيسية للمتجر</p>
                </div>
                <Button size="sm" onClick={() => setBanners([...banners, { id: "b_" + Math.random().toString(36).slice(2, 8), image: null, title: "", subtitle: "", link: "" }])}>
                  <Plus className="h-4 w-4 me-1" />إضافة بانر
                </Button>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {banners.map((b) => (
                  <div key={b.id} className="border rounded-xl p-3 space-y-3 bg-card">
                    <ImageUploader value={b.image} onChange={(v) => setBanners(banners.map(x => x.id === b.id ? { ...x, image: v } : x))} folder="banners" aspect="wide" />
                    <Input placeholder="عنوان (اختياري)" value={b.title ?? ""} onChange={(e) => setBanners(banners.map(x => x.id === b.id ? { ...x, title: e.target.value } : x))} />
                    <Input placeholder="وصف (اختياري)" value={b.subtitle ?? ""} onChange={(e) => setBanners(banners.map(x => x.id === b.id ? { ...x, subtitle: e.target.value } : x))} />
                    <Input placeholder="رابط (اختياري)" value={b.link ?? ""} onChange={(e) => setBanners(banners.map(x => x.id === b.id ? { ...x, link: e.target.value } : x))} />
                    <Button size="sm" variant="outline" className="w-full" onClick={() => setBanners(banners.filter(x => x.id !== b.id))}>
                      <Trash2 className="h-4 w-4 me-1 text-destructive" />حذف
                    </Button>
                  </div>
                ))}
                {banners.length === 0 && <p className="text-sm text-muted-foreground text-center py-8 col-span-full">لا توجد بانرات بعد</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="domain" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-4 max-w-2xl">
              <div>
                <h3 className="font-bold flex items-center gap-2"><Globe className="h-4 w-4" /> الدومين المخصص</h3>
                <p className="text-xs text-muted-foreground mt-1">اربط متجرك بدومين خاص بك (مثلاً: shop.mybrand.com).</p>
              </div>
              <div>
                <Label>الدومين</Label>
                <Input dir="ltr" placeholder="shop.mybrand.com" value={customDomain} onChange={(e) => setCustomDomain(e.target.value.trim().toLowerCase())} />
              </div>
              <div className="rounded-xl bg-muted/50 p-4 text-sm space-y-2">
                <div className="font-semibold">خطوات الربط:</div>
                <ol className="list-decimal ps-5 space-y-1 text-muted-foreground text-xs">
                  <li>اذهب لمزود الدومين (GoDaddy / Cloudflare / Namecheap…).</li>
                  <li>أضف سجل <code className="bg-background px-1 rounded">A</code> لاسم <code className="bg-background px-1 rounded">@</code> أو الـ subdomain بقيمة <code className="bg-background px-1 rounded">185.158.133.1</code>.</li>
                  <li>أضف سجل <code className="bg-background px-1 rounded">TXT</code> باسم <code className="bg-background px-1 rounded">_lovable</code> من إعدادات المشروع.</li>
                  <li>من إعدادات المشروع → Domains، اضغط Connect Domain وأكمل التحقق.</li>
                  <li>الـ SSL يُفعَّل تلقائياً (قد يستغرق حتى 72 ساعة).</li>
                </ol>
              </div>
              <p className="text-xs text-muted-foreground">احفظ الدومين هنا ليظهر في معلومات المتجر، ثم اربطه فعلياً من إعدادات المشروع.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="layout" className="mt-4">
          <div className="grid lg:grid-cols-[260px_1fr_320px] gap-4">
            <Card>
              <CardContent className="p-3 space-y-2">
                <h3 className="font-bold text-sm">إضافة قسم</h3>
                {TYPES.map((t) => (
                  <Button key={t.type} variant="outline" size="sm" className="w-full justify-start"
                    onClick={() => setSections([...sections, newSection(t.type)])}>
                    <t.icon className="h-4 w-4 me-2" /> {t.label}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                  <Eye className="h-4 w-4" /> ترتيب الأقسام (اسحبها لإعادة الترتيب)
                </div>
                {sections.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">لا توجد أقسام.</div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {sections.map((s) => (
                          <SortableRow key={s.id} section={s}
                            selected={selectedId === s.id}
                            onSelect={() => setSelectedId(s.id)}
                            onDelete={() => { setSections(sections.filter((x) => x.id !== s.id)); if (selectedId === s.id) setSelectedId(null); }} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 space-y-3">
                <h3 className="font-bold text-sm">خصائص القسم</h3>
                {!selected && <p className="text-sm text-muted-foreground">اختر قسماً لتعديل خصائصه</p>}
                {selected?.type === "banner" && (
                  <>
                    <div><Label>العنوان</Label><Input value={selected.props.title} onChange={(e) => patchSelected({ title: e.target.value })} /></div>
                    <div><Label>الوصف</Label><Textarea value={selected.props.subtitle ?? ""} onChange={(e) => patchSelected({ subtitle: e.target.value })} /></div>
                    <div><Label>نص الزر</Label><Input value={selected.props.cta ?? ""} onChange={(e) => patchSelected({ cta: e.target.value })} /></div>
                    <ImageUploader label="صورة خلفية" value={selected.props.image ?? null} onChange={(v) => patchSelected({ image: v })} folder="sections" aspect="wide" />
                  </>
                )}
                {selected?.type === "categories" && (
                  <div><Label>عنوان</Label><Input value={selected.props.title ?? ""} onChange={(e) => patchSelected({ title: e.target.value })} /></div>
                )}
                {selected?.type === "products" && (
                  <>
                    <div><Label>عنوان</Label><Input value={selected.props.title ?? ""} onChange={(e) => patchSelected({ title: e.target.value })} /></div>
                    <div><Label>القسم</Label>
                      <Select value={selected.props.categoryId ?? "all"} onValueChange={(v) => patchSelected({ categoryId: v === "all" ? null : v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">كل الأقسام</SelectItem>
                          {(data?.categories ?? []).map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>الحد الأقصى</Label><Input type="number" value={selected.props.limit ?? 12} onChange={(e) => patchSelected({ limit: Number(e.target.value) || 12 })} /></div>
                  </>
                )}
                {selected?.type === "text" && (
                  <>
                    <div><Label>العنوان</Label><Input value={selected.props.title ?? ""} onChange={(e) => patchSelected({ title: e.target.value })} /></div>
                    <div><Label>النص</Label><Textarea rows={6} value={selected.props.body ?? ""} onChange={(e) => patchSelected({ body: e.target.value })} /></div>
                  </>
                )}
                {selected?.type === "image" && (
                  <>
                    <ImageUploader label="الصورة" value={selected.props.url ?? null} onChange={(v) => patchSelected({ url: v })} folder="sections" aspect="wide" />
                    <div><Label>نص بديل</Label><Input value={selected.props.alt ?? ""} onChange={(e) => patchSelected({ alt: e.target.value })} /></div>
                  </>
                )}
                {selected?.type === "features" && (
                  <>
                    <div><Label>العنوان</Label><Input value={selected.props.title ?? ""} onChange={(e) => patchSelected({ title: e.target.value })} /></div>
                    <div className="space-y-2">
                      <Label>المميزات</Label>
                      {(selected.props.items ?? []).map((it, i) => (
                        <div key={i} className="flex gap-2">
                          <Input className="w-16" value={it.icon} onChange={(e) => { const items = [...(selected.props.items ?? [])]; items[i] = { ...it, icon: e.target.value }; patchSelected({ items }); }} />
                          <Input value={it.label} onChange={(e) => { const items = [...(selected.props.items ?? [])]; items[i] = { ...it, label: e.target.value }; patchSelected({ items }); }} />
                          <Button size="icon" variant="ghost" onClick={() => { const items = (selected.props.items ?? []).filter((_, j) => j !== i); patchSelected({ items }); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <Button size="sm" variant="outline" onClick={() => { const items = [...(selected.props.items ?? []), { icon: "⭐", label: "ميزة جديدة" }]; patchSelected({ items }); }}>
                        <Plus className="h-4 w-4 me-1" />إضافة
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SortableRow({ section, selected, onSelect, onDelete }: { section: Section; selected: boolean; onSelect: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const label = TYPES.find((t) => t.type === section.type)?.label ?? section.type;
  const Icon = TYPES.find((t) => t.type === section.type)?.icon ?? Layers;
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={`flex items-center gap-2 border rounded-lg p-3 bg-card cursor-pointer ${selected ? "border-primary ring-2 ring-primary/20" : ""}`}
      onClick={onSelect}>
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground" onClick={(e) => e.stopPropagation()}>
        <GripVertical className="h-5 w-5" />
      </button>
      <Icon className="h-4 w-4 text-primary" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{label}</div>
        <div className="text-xs text-muted-foreground truncate">
          {(section.props as any).title || (section.props as any).url || (section.props as any).alt || "بدون عنوان"}
        </div>
      </div>
      <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
