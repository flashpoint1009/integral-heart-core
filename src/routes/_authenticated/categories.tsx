import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({ meta: [{ title: "Categories — ERP" }] }),
  component: Page,
});

type Row = { id: string; name_ar: string; name_en: string | null; parent_id: string | null };

function Page() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ name_ar: "", name_en: "", parent_id: "" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name_ar");
      if (error) throw error;
      return data as Row[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name_ar: form.name_ar.trim(),
        name_en: form.name_en.trim() || null,
        parent_id: form.parent_id || null,
      };
      if (!payload.name_ar) throw new Error("name_ar required");
      if (editing) {
        const { error } = await supabase.from("categories").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["categories"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("common.deleted"));
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name_ar: "", name_en: "", parent_id: "" });
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({ name_ar: r.name_ar, name_en: r.name_en ?? "", parent_id: r.parent_id ?? "" });
    setOpen(true);
  };

  const label = (r: Row) => (i18n.language === "en" && r.name_en ? r.name_en : r.name_ar);

  return (
    <div className="p-6">
      <PageHeader
        title={t("categories.title")}
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 me-2" />
            {t("categories.add")}
          </Button>
        }
      />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("categories.name_ar")}</TableHead>
              <TableHead>{t("categories.name_en")}</TableHead>
              <TableHead>{t("categories.parent")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
            ) : rows.map((r) => {
              const parent = rows.find((x) => x.id === r.parent_id);
              return (
                <TableRow key={r.id} className="hover:bg-muted/40">
                  <TableCell className="font-semibold text-primary">{r.name_ar}</TableCell>
                  <TableCell className="text-muted-foreground">{r.name_en ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{parent ? label(parent) : "—"}</TableCell>
                  <TableCell className="text-end">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm(t("common.deleteConfirm"))) remove.mutate(r.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("categories.edit") : t("categories.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("categories.name_ar")} *</Label>
              <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
            </div>
            <div>
              <Label>{t("categories.name_en")}</Label>
              <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
            </div>
            <div>
              <Label>{t("categories.parent")}</Label>
              <Select value={form.parent_id || "none"} onValueChange={(v) => setForm({ ...form, parent_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("common.none")}</SelectItem>
                  {rows.filter((r) => r.id !== editing?.id).map((r) => (
                    <SelectItem key={r.id} value={r.id}>{label(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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