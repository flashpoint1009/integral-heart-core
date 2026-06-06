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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Truck, Wallet, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [{ title: "Suppliers — ERP" }] }),
  component: Page,
});

type Row = {
  id: string; name: string; phone: string | null; email: string | null;
  address: string | null; tax_number: string | null; balance: number;
  notes: string | null; is_active: boolean;
};

const empty = { name: "", phone: "", email: "", address: "", tax_number: "", notes: "", is_active: true };

function Page() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState(empty);
  const [query, setQuery] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data as Row[];
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      (r.phone ?? "").toLowerCase().includes(q) ||
      (r.email ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        tax_number: form.tax_number || null,
        notes: form.notes || null,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from("suppliers").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(t("common.saved"));
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast.success(t("common.deleted")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({
      name: r.name, phone: r.phone ?? "", email: r.email ?? "",
      address: r.address ?? "", tax_number: r.tax_number ?? "",
      notes: r.notes ?? "", is_active: r.is_active,
    });
    setOpen(true);
  };

  return (
    <div className="p-6 space-y-4">
      <PageHeader title={t("suppliers.title")} actions={<Button onClick={openAdd}><Plus className="me-2 h-4 w-4" />{t("suppliers.add")}</Button>} />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: t("suppliers.title"), value: rows.length, icon: Truck, tint: "from-primary/10 to-primary/0", color: "text-primary" },
          { label: t("suppliers.balance"), value: rows.reduce((s, r) => s + Number(r.balance || 0), 0).toFixed(2), icon: Wallet, tint: "from-amber-500/10 to-amber-500/0", color: "text-amber-600" },
          { label: t("common.active"), value: rows.filter((r) => r.is_active).length, icon: CheckCircle2, tint: "from-emerald-500/10 to-emerald-500/0", color: "text-emerald-600" },
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

      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="ps-9 rounded-full shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30" placeholder={t("common.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("suppliers.name")}</TableHead>
              <TableHead>{t("suppliers.phone")}</TableHead>
              <TableHead>{t("suppliers.email")}</TableHead>
              <TableHead>{t("suppliers.balance")}</TableHead>
              <TableHead>{t("common.active")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/40">
                <TableCell className="font-semibold text-primary">{r.name}</TableCell>
                <TableCell>{r.phone ?? "—"}</TableCell>
                <TableCell>{r.email ?? "—"}</TableCell>
                <TableCell className="tabular-nums">{Number(r.balance).toFixed(2)}</TableCell>
                <TableCell><Badge className="rounded-full" variant={r.is_active ? "default" : "outline"}>{r.is_active ? t("common.active") : t("common.inactive")}</Badge></TableCell>
                <TableCell className="text-end">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm(t("common.deleteConfirm"))) del.mutate(r.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? t("suppliers.edit") : t("suppliers.add")}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5"><Label>{t("suppliers.name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>{t("suppliers.phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>{t("suppliers.email")}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="grid gap-1.5"><Label>{t("suppliers.address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>{t("suppliers.tax_number")}</Label><Input value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>{t("suppliers.notes")}</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>{t("common.active")}</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}