import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/warehouses")({
  head: () => ({ meta: [{ title: "Warehouses — ERP" }] }),
  component: Page,
});

type Row = {
  id: string; name: string; code: string | null; address: string | null;
  is_active: boolean; is_default: boolean;
};

function Page() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ name: "", code: "", address: "", is_active: true, is_default: false });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("*").order("name");
      if (error) throw error;
      return data as Row[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        address: form.address.trim() || null,
        is_active: form.is_active,
        is_default: form.is_default,
      };
      if (!payload.name) throw new Error("name required");
      if (payload.is_default) {
        await supabase.from("warehouses").update({ is_default: false }).neq("id", editing?.id ?? "00000000-0000-0000-0000-000000000000");
      }
      if (editing) {
        const { error } = await supabase.from("warehouses").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("warehouses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["warehouses"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("warehouses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("common.deleted")); qc.invalidateQueries({ queryKey: ["warehouses"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ name: "", code: "", address: "", is_active: true, is_default: rows.length === 0 }); setOpen(true); };
  const openEdit = (r: Row) => { setEditing(r); setForm({ name: r.name, code: r.code ?? "", address: r.address ?? "", is_active: r.is_active, is_default: r.is_default }); setOpen(true); };

  return (
    <div className="p-6">
      <PageHeader title={t("warehouses.title")} actions={<Button onClick={openNew}><Plus className="h-4 w-4 me-2" />{t("warehouses.add")}</Button>} />
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("warehouses.name")}</TableHead>
              <TableHead>{t("warehouses.code")}</TableHead>
              <TableHead>{t("warehouses.address")}</TableHead>
              <TableHead>{t("common.active")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/40">
                <TableCell className="font-semibold text-primary">
                  {r.name}
                  {r.is_default && <Badge variant="secondary" className="ms-2 rounded-full">{t("warehouses.is_default")}</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground">{r.code ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{r.address ?? "—"}</TableCell>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("warehouses.edit") : t("warehouses.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("warehouses.name")} *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>{t("warehouses.code")}</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div><Label>{t("warehouses.address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label>{t("common.active")}</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label>{t("warehouses.is_default")}</Label>
              <Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
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