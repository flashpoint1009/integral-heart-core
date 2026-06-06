import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search, Package, Tag, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ExcelImportButton } from "@/components/app/excel-import";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({ meta: [{ title: "Products — ERP" }] }),
  component: Page,
});

type Row = {
  id: string; name_ar: string; name_en: string | null; sku: string | null; barcode: string | null;
  category_id: string | null; cost_price: number; sale_price: number; tax_rate: number;
  unit: string | null; min_stock: number | null; description: string | null;
  image_url: string | null; is_active: boolean;
};

const empty = {
  name_ar: "", name_en: "", sku: "", barcode: "", category_id: "",
  cost_price: "0", sale_price: "0", tax_rate: "0", unit: "",
  min_stock: "0", description: "", image_url: "", is_active: true,
};

function Page() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canImport = hasRole("admin") || hasRole("manager") || hasRole("warehouse") || hasRole("accountant");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState(empty);
  const [query, setQuery] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name_ar");
      if (error) throw error;
      return data as Row[];
    },
  });

  const { data: cats = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name_ar,name_en");
      if (error) throw error;
      return data;
    },
  });

  const catLabel = (id: string | null) => {
    const c = cats.find((x) => x.id === id);
    if (!c) return "—";
    return i18n.language === "en" && c.name_en ? c.name_en : c.name_ar;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.name_ar.toLowerCase().includes(q) ||
      (r.name_en ?? "").toLowerCase().includes(q) ||
      (r.sku ?? "").toLowerCase().includes(q) ||
      (r.barcode ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name_ar: form.name_ar.trim(),
        name_en: form.name_en.trim() || null,
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
        category_id: form.category_id || null,
        cost_price: Number(form.cost_price) || 0,
        sale_price: Number(form.sale_price) || 0,
        tax_rate: Number(form.tax_rate) || 0,
        unit: form.unit.trim() || null,
        min_stock: Number(form.min_stock) || 0,
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        is_active: form.is_active,
      };
      if (!payload.name_ar) throw new Error("name_ar required");
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["products"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("common.deleted")); qc.invalidateQueries({ queryKey: ["products"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({
      name_ar: r.name_ar, name_en: r.name_en ?? "", sku: r.sku ?? "", barcode: r.barcode ?? "",
      category_id: r.category_id ?? "", cost_price: String(r.cost_price), sale_price: String(r.sale_price),
      tax_rate: String(r.tax_rate), unit: r.unit ?? "", min_stock: String(r.min_stock ?? 0),
      description: r.description ?? "", image_url: r.image_url ?? "", is_active: r.is_active,
    });
    setOpen(true);
  };

  return (
    <div className="p-6">
      <PageHeader title={t("products.title")} actions={
        <div className="flex gap-2">
          {canImport && (
            <ExcelImportButton
              label="استيراد منتجات"
              title="استيراد منتجات من Excel"
              description="حمّل النموذج، املأه، ثم ارفعه. التحديث يتم عبر SKU إن وُجد."
              templateFileName="products-template.xlsx"
              columns={[
                { key: "name_ar", label: "الاسم بالعربية", required: true, example: "منتج تجريبي" },
                { key: "name_en", label: "Name (EN)", example: "Sample" },
                { key: "sku", label: "SKU", example: "SKU-001" },
                { key: "barcode", label: "Barcode", example: "1234567890" },
                { key: "category", label: "القسم", example: "مشروبات" },
                { key: "unit", label: "الوحدة", example: "pcs" },
                { key: "cost_price", label: "سعر التكلفة", example: "10" },
                { key: "sale_price", label: "سعر البيع", required: true, example: "15" },
                { key: "tax_rate", label: "نسبة الضريبة %", example: "14" },
                { key: "min_stock", label: "الحد الأدنى للمخزون", example: "5" },
              ]}
              importRow={async (r) => {
                const name_ar = String(r.name_ar ?? "").trim();
                if (!name_ar) throw new Error("الاسم بالعربية مطلوب");
                let category_id: string | null = null;
                const catName = String(r.category ?? "").trim();
                if (catName) {
                  const found = cats.find((c: any) =>
                    (c.name_ar ?? "").trim().toLowerCase() === catName.toLowerCase() ||
                    (c.name_en ?? "").trim().toLowerCase() === catName.toLowerCase());
                  if (found) category_id = found.id;
                  else {
                    const { data: created, error: ce } = await supabase.from("categories").insert({ name_ar: catName }).select("id").single();
                    if (ce) throw new Error(ce.message);
                    category_id = created.id;
                  }
                }
                const payload = {
                  name_ar,
                  name_en: String(r.name_en ?? "").trim() || null,
                  sku: String(r.sku ?? "").trim() || null,
                  barcode: String(r.barcode ?? "").trim() || null,
                  category_id,
                  unit: String(r.unit ?? "").trim() || null,
                  cost_price: Number(r.cost_price) || 0,
                  sale_price: Number(r.sale_price) || 0,
                  tax_rate: Number(r.tax_rate) || 0,
                  min_stock: Number(r.min_stock) || 0,
                  is_active: true,
                };
                if (payload.sku) {
                  const { data: existing } = await supabase.from("products").select("id").eq("sku", payload.sku).maybeSingle();
                  if (existing) {
                    const { error } = await supabase.from("products").update(payload).eq("id", existing.id);
                    if (error) throw new Error(error.message);
                    return;
                  }
                }
                const { error } = await supabase.from("products").insert(payload);
                if (error) throw new Error(error.message);
              }}
              onDone={() => { qc.invalidateQueries({ queryKey: ["products"] }); qc.invalidateQueries({ queryKey: ["categories"] }); }}
            />
          )}
          <Button onClick={openNew}><Plus className="h-4 w-4 me-2" />{t("products.add")}</Button>
        </div>
      } />

      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        {[
          { label: t("products.title"), value: rows.length, icon: Package, tint: "from-primary/10 to-primary/0", color: "text-primary" },
          { label: t("common.active"), value: rows.filter((r) => r.is_active).length, icon: CheckCircle2, tint: "from-emerald-500/10 to-emerald-500/0", color: "text-emerald-600" },
          { label: t("products.category"), value: cats.length, icon: Tag, tint: "from-violet-500/10 to-violet-500/0", color: "text-violet-600" },
        ].map((c) => (
          <Card key={c.label} className={`bg-gradient-to-br ${c.tint} border-border/60`}>
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className="text-2xl font-bold tabular-nums mt-1">{c.value}</div>
              </div>
              <div className={`h-10 w-10 rounded-xl bg-background/60 grid place-items-center ${c.color}`}>
                <c.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="ps-9 rounded-full shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30" placeholder={t("common.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("products.name_ar")}</TableHead>
              <TableHead>{t("products.sku")}</TableHead>
              <TableHead>{t("products.category")}</TableHead>
              <TableHead className="text-end">{t("products.sale_price")}</TableHead>
              <TableHead className="text-end">{t("products.cost_price")}</TableHead>
              <TableHead>{t("common.active")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/40">
                <TableCell className="font-semibold text-primary">
                  <div>{i18n.language === "en" && r.name_en ? r.name_en : r.name_ar}</div>
                  {r.barcode && <div className="text-xs text-muted-foreground font-mono">{r.barcode}</div>}
                </TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">{r.sku ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{catLabel(r.category_id)}</TableCell>
                <TableCell className="text-end tabular-nums">{Number(r.sale_price).toFixed(2)}</TableCell>
                <TableCell className="text-end tabular-nums text-muted-foreground">{Number(r.cost_price).toFixed(2)}</TableCell>
                <TableCell>{r.is_active ? <Badge className="rounded-full">{t("common.active")}</Badge> : <Badge variant="outline" className="rounded-full">{t("common.inactive")}</Badge>}</TableCell>
                <TableCell className="text-end">
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(t("common.deleteConfirm"))) remove.mutate(r.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t("products.edit") : t("products.add")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>{t("products.name_ar")} *</Label><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></div>
            <div><Label>{t("products.name_en")}</Label><Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>
            <div><Label>{t("products.sku")}</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            <div><Label>{t("products.barcode")}</Label><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
            <div>
              <Label>{t("products.category")}</Label>
              <Select value={form.category_id || "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("common.none")}</SelectItem>
                  {cats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{i18n.language === "en" && c.name_en ? c.name_en : c.name_ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t("products.unit")}</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs, kg..." /></div>
            <div><Label>{t("products.cost_price")}</Label><Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></div>
            <div><Label>{t("products.sale_price")}</Label><Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} /></div>
            <div><Label>{t("products.tax_rate")}</Label><Input type="number" step="0.01" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} /></div>
            <div><Label>{t("products.min_stock")}</Label><Input type="number" step="1" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>{t("products.image_url")}</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>{t("products.description")}</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="md:col-span-2 flex items-center justify-between rounded-md border p-3">
              <Label>{t("common.active")}</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}