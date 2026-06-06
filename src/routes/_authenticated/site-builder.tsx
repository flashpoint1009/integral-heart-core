import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getSiteConfigPublic, saveSiteConfig } from "@/lib/api/storefront.functions";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Image as ImageIcon, Layers, Type, Tags, Plus, Save, ExternalLink, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/site-builder")({
  head: () => ({ meta: [{ title: "Site Builder — ERP" }] }),
  component: Builder,
});

type Section =
  | { id: string; type: "banner"; props: { title: string; subtitle?: string; image?: string; cta?: string } }
  | { id: string; type: "categories"; props: { title?: string } }
  | { id: string; type: "products"; props: { title?: string; categoryId?: string | null; limit?: number } }
  | { id: string; type: "text"; props: { title?: string; body?: string } }
  | { id: string; type: "image"; props: { url: string; alt?: string } };

const TYPES: { type: Section["type"]; label: string; icon: any }[] = [
  { type: "banner", label: "بانر", icon: ImageIcon },
  { type: "categories", label: "أقسام", icon: Tags },
  { type: "products", label: "منتجات", icon: Layers },
  { type: "text", label: "نص", icon: Type },
  { type: "image", label: "صورة", icon: ImageIcon },
];

function newSection(type: Section["type"]): Section {
  const id = "s_" + Math.random().toString(36).slice(2, 9);
  switch (type) {
    case "banner": return { id, type, props: { title: "عنوان البانر", subtitle: "وصف قصير", cta: "تسوّق الآن" } };
    case "categories": return { id, type, props: { title: "تسوّق حسب القسم" } };
    case "products": return { id, type, props: { title: "منتجات مميزة", limit: 12, categoryId: null } };
    case "text": return { id, type, props: { title: "عنوان", body: "النص هنا" } };
    case "image": return { id, type, props: { url: "", alt: "" } };
  }
}

function Builder() {
  const fetchCfg = useServerFn(getSiteConfigPublic);
  const save = useServerFn(saveSiteConfig);
  const { data, refetch } = useQuery({ queryKey: ["site_cfg_builder"], queryFn: () => fetchCfg() });

  const [siteName, setSiteName] = useState("");
  const [primary, setPrimary] = useState("#1e3a8a");
  const [shape, setShape] = useState<"square" | "rounded" | "circle">("rounded");
  const [logo, setLogo] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [published, setPublished] = useState(true);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const c = data?.config;
    if (!c) return;
    setSiteName(c.site_name ?? "");
    setPrimary(c.primary_color ?? "#1e3a8a");
    setShape((c.card_shape as any) ?? "rounded");
    setLogo(c.logo_url ?? "");
    setPhone(c.contact_phone ?? "");
    setAddress(c.contact_address ?? "");
    setPublished(c.is_published ?? true);
    setSections(Array.isArray(c.sections) ? (c.sections as any) : []);
  }, [data]);

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
      site_name: siteName, logo_url: logo || null, primary_color: primary, card_shape: shape,
      contact_phone: phone || null, contact_address: address || null, sections, is_published: published,
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
        description="اسحب وأفلت الأقسام لترتيب صفحة المتجر"
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

      <div className="grid lg:grid-cols-[280px_1fr_320px] gap-4 mt-4">
        {/* Left: Section palette + settings */}
        <div className="space-y-4">
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
            <CardContent className="p-3 space-y-3">
              <h3 className="font-bold text-sm">إعدادات عامة</h3>
              <div><Label>اسم الموقع</Label><Input value={siteName} onChange={(e) => setSiteName(e.target.value)} /></div>
              <div><Label>اللون الأساسي</Label>
                <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-full rounded border" />
              </div>
              <div><Label>شكل الكروت</Label>
                <Select value={shape} onValueChange={(v: any) => setShape(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="square">مربع</SelectItem>
                    <SelectItem value="rounded">مدور الأطراف</SelectItem>
                    <SelectItem value="circle">دائري</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>الشعار (URL)</Label><Input value={logo} onChange={(e) => setLogo(e.target.value)} /></div>
              <div><Label>الهاتف</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div><Label>العنوان</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
              <div className="flex items-center justify-between"><Label>منشور</Label>
                <Switch checked={published} onCheckedChange={setPublished} /></div>
            </CardContent>
          </Card>
        </div>

        {/* Middle: Canvas */}
        <div>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" /> ترتيب الأقسام (اسحبها لإعادة الترتيب)
              </div>
              {sections.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  لا توجد أقسام. أضف قسم من اليمين.
                </div>
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
        </div>

        {/* Right: Inspector */}
        <div>
          <Card>
            <CardContent className="p-3 space-y-3">
              <h3 className="font-bold text-sm">خصائص القسم</h3>
              {!selected && <p className="text-sm text-muted-foreground">اختر قسماً لتعديل خصائصه</p>}
              {selected?.type === "banner" && (
                <>
                  <div><Label>العنوان</Label><Input value={selected.props.title} onChange={(e) => patchSelected({ title: e.target.value })} /></div>
                  <div><Label>الوصف</Label><Textarea value={selected.props.subtitle ?? ""} onChange={(e) => patchSelected({ subtitle: e.target.value })} /></div>
                  <div><Label>نص الزر</Label><Input value={selected.props.cta ?? ""} onChange={(e) => patchSelected({ cta: e.target.value })} /></div>
                </>
              )}
              {selected?.type === "categories" && (
                <div><Label>عنوان القسم</Label><Input value={selected.props.title ?? ""} onChange={(e) => patchSelected({ title: e.target.value })} /></div>
              )}
              {selected?.type === "products" && (
                <>
                  <div><Label>عنوان القسم</Label><Input value={selected.props.title ?? ""} onChange={(e) => patchSelected({ title: e.target.value })} /></div>
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
                  <div><Label>رابط الصورة</Label><Input value={selected.props.url} onChange={(e) => patchSelected({ url: e.target.value })} /></div>
                  <div><Label>نص بديل</Label><Input value={selected.props.alt ?? ""} onChange={(e) => patchSelected({ alt: e.target.value })} /></div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
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
          {(section.props as any).title || (section.props as any).url || "بدون عنوان"}
        </div>
      </div>
      <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}