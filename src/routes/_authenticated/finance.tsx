import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Wallet, Receipt, ArrowLeftRight, Users, Truck, BookOpen, Landmark, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Finance — ERP" }] }),
  component: Page,
});

const fmt = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const isoNow = () => new Date().toISOString();

function Page() {
  const { t } = useTranslation();
  return (
    <div className="p-6 space-y-4">
      <PageHeader title={t("finance.title")} description={t("finance.description")} />
      <Tabs defaultValue="accounts">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="accounts" className="gap-2"><Wallet className="h-4 w-4" />{t("finance.accounts")}</TabsTrigger>
          <TabsTrigger value="expenses" className="gap-2"><Receipt className="h-4 w-4" />{t("finance.expenses")}</TabsTrigger>
          <TabsTrigger value="transfers" className="gap-2"><ArrowLeftRight className="h-4 w-4" />{t("finance.transfers")}</TabsTrigger>
          <TabsTrigger value="cust" className="gap-2"><Users className="h-4 w-4" />{t("finance.customerPayments")}</TabsTrigger>
          <TabsTrigger value="sup" className="gap-2"><Truck className="h-4 w-4" />{t("finance.supplierPayments")}</TabsTrigger>
          <TabsTrigger value="coa" className="gap-2"><Landmark className="h-4 w-4" />{t("finance.chart")}</TabsTrigger>
          <TabsTrigger value="journal" className="gap-2"><BookOpen className="h-4 w-4" />{t("finance.journal")}</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts" className="mt-4"><AccountsTab /></TabsContent>
        <TabsContent value="expenses" className="mt-4"><ExpensesTab /></TabsContent>
        <TabsContent value="transfers" className="mt-4"><TransfersTab /></TabsContent>
        <TabsContent value="cust" className="mt-4"><CustomerPaymentsTab /></TabsContent>
        <TabsContent value="sup" className="mt-4"><SupplierPaymentsTab /></TabsContent>
        <TabsContent value="coa" className="mt-4"><ChartTab /></TabsContent>
        <TabsContent value="journal" className="mt-4"><JournalTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* -------- Accounts -------- */
function StatCard({ label, value, icon: Icon, tint, color }: { label: string; value: string | number; icon: any; tint: string; color: string }) {
  return (
    <Card className={`bg-gradient-to-br ${tint} border-border/60`}>
      <CardContent className="pt-5 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
        </div>
        <div className={`h-10 w-10 rounded-xl bg-background/60 grid place-items-center ${color}`}><Icon className="h-5 w-5" /></div>
      </CardContent>
    </Card>
  );
}

function AccountsTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "cash", bank_name: "", account_number: "", opening_balance: "0" });

  const { data: rows = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const totalCash = rows.filter((r: any) => r.type === "cash").reduce((s: number, r: any) => s + Number(r.balance || 0), 0);
  const totalBank = rows.filter((r: any) => r.type === "bank").reduce((s: number, r: any) => s + Number(r.balance || 0), 0);

  const save = useMutation({
    mutationFn: async () => {
      const ob = Number(form.opening_balance) || 0;
      const { error } = await supabase.from("accounts").insert({
        name: form.name.trim(), type: form.type, bank_name: form.bank_name || null,
        account_number: form.account_number || null, opening_balance: ob, balance: ob,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["accounts"] }); setOpen(false); setForm({ name: "", type: "cash", bank_name: "", account_number: "", opening_balance: "0" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("finance.totalCash")} value={fmt(totalCash)} icon={Wallet} tint="from-emerald-500/10 to-emerald-500/0" color="text-emerald-600" />
        <StatCard label={t("finance.totalBank")} value={fmt(totalBank)} icon={Landmark} tint="from-primary/10 to-primary/0" color="text-primary" />
        <StatCard label={t("finance.totalLiquidity")} value={fmt(totalCash + totalBank)} icon={TrendingUp} tint="from-violet-500/10 to-violet-500/0" color="text-violet-600" />
      </div>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 me-2" />{t("finance.addAccount")}</Button>
      </div>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("finance.accountName")}</TableHead>
            <TableHead>{t("finance.accountType")}</TableHead>
            <TableHead>{t("finance.bank")}</TableHead>
            <TableHead className="text-end">{t("finance.balance")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
            ) : rows.map((r: any) => (
              <TableRow key={r.id} className="hover:bg-muted/40">
                <TableCell className="font-semibold text-primary">{r.name}</TableCell>
                <TableCell><Badge variant="outline" className="rounded-full">{t(`finance.types.${r.type}`)}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{r.bank_name ?? "—"}</TableCell>
                <TableCell className="text-end tabular-nums font-semibold">{fmt(Number(r.balance))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("finance.addAccount")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("finance.accountName")} *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>{t("finance.accountType")}</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t("finance.types.cash")}</SelectItem>
                  <SelectItem value="bank">{t("finance.types.bank")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.type === "bank" && (
              <>
                <div><Label>{t("finance.bank")}</Label><Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></div>
                <div><Label>{t("finance.accountNumber")}</Label><Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></div>
              </>
            )}
            <div><Label>{t("finance.openingBalance")}</Label><Input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} /></div>
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

/* -------- Expenses -------- */
function ExpensesTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category_id: "", account_id: "", amount: "0", vendor: "", notes: "", expense_date: new Date().toISOString().slice(0, 10) });

  const { data: rows = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*, expense_categories(name_ar), accounts(name)").order("expense_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: cats = [] } = useQuery({ queryKey: ["expense_categories"], queryFn: async () => (await supabase.from("expense_categories").select("id,name_ar").order("name_ar")).data ?? [] });
  const { data: accs = [] } = useQuery({ queryKey: ["accounts"], queryFn: async () => (await supabase.from("accounts").select("id,name").order("name")).data ?? [] });

  const total = rows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const monthTotal = rows.filter((r: any) => new Date(r.expense_date).getMonth() === new Date().getMonth()).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

  const save = useMutation({
    mutationFn: async () => {
      const amt = Number(form.amount);
      if (!amt || amt <= 0) throw new Error("invalid amount");
      const { error } = await supabase.from("expenses").insert({
        category_id: form.category_id || null, account_id: form.account_id || null,
        amount: amt, vendor: form.vendor || null, notes: form.notes || null,
        expense_date: new Date(form.expense_date).toISOString(), created_by: user?.id ?? null,
      });
      if (error) throw error;
      if (form.account_id) {
        const acc = (accs as any[]).find((a) => a.id === form.account_id);
        if (acc) {
          const { data: cur } = await supabase.from("accounts").select("balance").eq("id", form.account_id).single();
          await supabase.from("accounts").update({ balance: Number((cur as any)?.balance || 0) - amt }).eq("id", form.account_id);
        }
      }
    },
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["expenses"] }); qc.invalidateQueries({ queryKey: ["accounts"] }); setOpen(false); setForm({ category_id: "", account_id: "", amount: "0", vendor: "", notes: "", expense_date: new Date().toISOString().slice(0, 10) }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("finance.totalExpenses")} value={fmt(total)} icon={TrendingDown} tint="from-amber-500/10 to-amber-500/0" color="text-amber-600" />
        <StatCard label={t("finance.monthExpenses")} value={fmt(monthTotal)} icon={Receipt} tint="from-rose-500/10 to-rose-500/0" color="text-rose-600" />
        <StatCard label={t("finance.expenseCount")} value={rows.length} icon={BookOpen} tint="from-primary/10 to-primary/0" color="text-primary" />
      </div>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 me-2" />{t("finance.addExpense")}</Button>
      </div>
      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("finance.date")}</TableHead>
            <TableHead>{t("finance.category")}</TableHead>
            <TableHead>{t("finance.vendor")}</TableHead>
            <TableHead>{t("finance.account")}</TableHead>
            <TableHead className="text-end">{t("finance.amount")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
            ) : rows.map((r: any) => (
              <TableRow key={r.id} className="hover:bg-muted/40">
                <TableCell className="text-muted-foreground text-sm">{new Date(r.expense_date).toLocaleDateString()}</TableCell>
                <TableCell className="font-semibold text-primary">{r.expense_categories?.name_ar ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{r.vendor ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{r.accounts?.name ?? "—"}</TableCell>
                <TableCell className="text-end tabular-nums font-semibold text-rose-600">{fmt(Number(r.amount))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("finance.addExpense")}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>{t("finance.category")}</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("common.none")} /></SelectTrigger>
                <SelectContent>{(cats as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>{t("finance.account")}</Label>
              <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("common.none")} /></SelectTrigger>
                <SelectContent>{(accs as any[]).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("finance.amount")} *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>{t("finance.date")}</Label><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div>
            <div className="col-span-2"><Label>{t("finance.vendor")}</Label><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></div>
            <div className="col-span-2"><Label>{t("common.notes") || "Notes"}</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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

/* -------- Transfers -------- */
function TransfersTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ from_account_id: "", to_account_id: "", amount: "0", notes: "" });

  const { data: rows = [] } = useQuery({
    queryKey: ["transfers"],
    queryFn: async () => (await supabase.from("account_transfers").select("*, from:accounts!from_account_id(name), to:accounts!to_account_id(name)").order("transfer_date", { ascending: false })).data ?? [],
  });
  const { data: accs = [] } = useQuery({ queryKey: ["accounts"], queryFn: async () => (await supabase.from("accounts").select("id,name,balance").order("name")).data ?? [] });

  const save = useMutation({
    mutationFn: async () => {
      const amt = Number(form.amount);
      if (!amt || amt <= 0) throw new Error("invalid amount");
      if (!form.from_account_id || !form.to_account_id || form.from_account_id === form.to_account_id) throw new Error("invalid accounts");
      const { error } = await supabase.from("account_transfers").insert({
        from_account_id: form.from_account_id, to_account_id: form.to_account_id,
        amount: amt, notes: form.notes || null, created_by: user?.id ?? null,
      });
      if (error) throw error;
      const from = (accs as any[]).find((a) => a.id === form.from_account_id);
      const to = (accs as any[]).find((a) => a.id === form.to_account_id);
      if (from) await supabase.from("accounts").update({ balance: Number(from.balance) - amt }).eq("id", from.id);
      if (to) await supabase.from("accounts").update({ balance: Number(to.balance) + amt }).eq("id", to.id);
    },
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["transfers"] }); qc.invalidateQueries({ queryKey: ["accounts"] }); setOpen(false); setForm({ from_account_id: "", to_account_id: "", amount: "0", notes: "" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 me-2" />{t("finance.addTransfer")}</Button>
      </div>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("finance.date")}</TableHead>
            <TableHead>{t("finance.from")}</TableHead>
            <TableHead>{t("finance.to")}</TableHead>
            <TableHead className="text-end">{t("finance.amount")}</TableHead>
            <TableHead>{t("common.notes") || "Notes"}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
            ) : rows.map((r: any) => (
              <TableRow key={r.id} className="hover:bg-muted/40">
                <TableCell className="text-muted-foreground text-sm">{new Date(r.transfer_date).toLocaleDateString()}</TableCell>
                <TableCell className="font-semibold">{r.from?.name ?? "—"}</TableCell>
                <TableCell className="font-semibold text-primary">{r.to?.name ?? "—"}</TableCell>
                <TableCell className="text-end tabular-nums">{fmt(Number(r.amount))}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{r.notes ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("finance.addTransfer")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("finance.from")}</Label>
              <Select value={form.from_account_id} onValueChange={(v) => setForm({ ...form, from_account_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(accs as any[]).map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({fmt(Number(a.balance))})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("finance.to")}</Label>
              <Select value={form.to_account_id} onValueChange={(v) => setForm({ ...form, to_account_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(accs as any[]).filter((a) => a.id !== form.from_account_id).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("finance.amount")}</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>{t("common.notes") || "Notes"}</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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

/* -------- Customer Payments -------- */
function CustomerPaymentsTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer_id: "", account_id: "", amount: "0", notes: "" });

  const { data: rows = [] } = useQuery({
    queryKey: ["customer_payments"],
    queryFn: async () => (await supabase.from("customer_payments").select("*, customers(name), accounts(name)").order("payment_date", { ascending: false })).data ?? [],
  });
  const { data: customers = [] } = useQuery({ queryKey: ["customers_lite"], queryFn: async () => (await supabase.from("customers").select("id,name").order("name")).data ?? [] });
  const { data: accs = [] } = useQuery({ queryKey: ["accounts"], queryFn: async () => (await supabase.from("accounts").select("id,name,balance").order("name")).data ?? [] });

  const total = rows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

  const save = useMutation({
    mutationFn: async () => {
      const amt = Number(form.amount);
      if (!amt || amt <= 0 || !form.customer_id) throw new Error("invalid");
      const { error } = await supabase.from("customer_payments").insert({
        customer_id: form.customer_id, account_id: form.account_id || null,
        amount: amt, notes: form.notes || null, created_by: user?.id ?? null,
      });
      if (error) throw error;
      if (form.account_id) {
        const acc = (accs as any[]).find((a) => a.id === form.account_id);
        if (acc) await supabase.from("accounts").update({ balance: Number(acc.balance) + amt }).eq("id", acc.id);
      }
    },
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["customer_payments"] }); qc.invalidateQueries({ queryKey: ["accounts"] }); setOpen(false); setForm({ customer_id: "", account_id: "", amount: "0", notes: "" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label={t("finance.totalReceived")} value={fmt(total)} icon={TrendingUp} tint="from-emerald-500/10 to-emerald-500/0" color="text-emerald-600" />
        <StatCard label={t("finance.paymentsCount")} value={rows.length} icon={Receipt} tint="from-primary/10 to-primary/0" color="text-primary" />
      </div>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 me-2" />{t("finance.addPayment")}</Button>
      </div>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("finance.date")}</TableHead>
            <TableHead>{t("customers.name")}</TableHead>
            <TableHead>{t("finance.account")}</TableHead>
            <TableHead className="text-end">{t("finance.amount")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
            ) : rows.map((r: any) => (
              <TableRow key={r.id} className="hover:bg-muted/40">
                <TableCell className="text-muted-foreground text-sm">{new Date(r.payment_date).toLocaleDateString()}</TableCell>
                <TableCell className="font-semibold text-primary">{r.customers?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{r.accounts?.name ?? "—"}</TableCell>
                <TableCell className="text-end tabular-nums font-semibold text-emerald-600">{fmt(Number(r.amount))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("finance.addPayment")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("customers.name")} *</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(customers as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("finance.account")}</Label>
              <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(accs as any[]).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("finance.amount")}</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>{t("common.notes") || "Notes"}</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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

/* -------- Supplier Payments -------- */
function SupplierPaymentsTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ supplier_id: "", account_id: "", amount: "0", notes: "" });

  const { data: rows = [] } = useQuery({
    queryKey: ["supplier_payments"],
    queryFn: async () => (await supabase.from("supplier_payments").select("*, suppliers(name), accounts(name)").order("payment_date", { ascending: false })).data ?? [],
  });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers_lite"], queryFn: async () => (await supabase.from("suppliers").select("id,name").order("name")).data ?? [] });
  const { data: accs = [] } = useQuery({ queryKey: ["accounts"], queryFn: async () => (await supabase.from("accounts").select("id,name,balance").order("name")).data ?? [] });

  const total = rows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

  const save = useMutation({
    mutationFn: async () => {
      const amt = Number(form.amount);
      if (!amt || amt <= 0 || !form.supplier_id) throw new Error("invalid");
      const { error } = await supabase.from("supplier_payments").insert({
        supplier_id: form.supplier_id, account_id: form.account_id || null,
        amount: amt, notes: form.notes || null, created_by: user?.id ?? null,
      });
      if (error) throw error;
      if (form.account_id) {
        const acc = (accs as any[]).find((a) => a.id === form.account_id);
        if (acc) await supabase.from("accounts").update({ balance: Number(acc.balance) - amt }).eq("id", acc.id);
      }
    },
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["supplier_payments"] }); qc.invalidateQueries({ queryKey: ["accounts"] }); setOpen(false); setForm({ supplier_id: "", account_id: "", amount: "0", notes: "" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label={t("finance.totalPaid")} value={fmt(total)} icon={TrendingDown} tint="from-rose-500/10 to-rose-500/0" color="text-rose-600" />
        <StatCard label={t("finance.paymentsCount")} value={rows.length} icon={Receipt} tint="from-primary/10 to-primary/0" color="text-primary" />
      </div>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 me-2" />{t("finance.addPayment")}</Button>
      </div>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("finance.date")}</TableHead>
            <TableHead>{t("suppliers.name")}</TableHead>
            <TableHead>{t("finance.account")}</TableHead>
            <TableHead className="text-end">{t("finance.amount")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
            ) : rows.map((r: any) => (
              <TableRow key={r.id} className="hover:bg-muted/40">
                <TableCell className="text-muted-foreground text-sm">{new Date(r.payment_date).toLocaleDateString()}</TableCell>
                <TableCell className="font-semibold text-primary">{r.suppliers?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{r.accounts?.name ?? "—"}</TableCell>
                <TableCell className="text-end tabular-nums font-semibold text-rose-600">{fmt(Number(r.amount))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("finance.addPayment")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("suppliers.name")} *</Label>
              <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(suppliers as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("finance.account")}</Label>
              <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(accs as any[]).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("finance.amount")}</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>{t("common.notes") || "Notes"}</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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

/* -------- Chart of Accounts -------- */
function ChartTab() {
  const { t } = useTranslation();
  const { data: rows = [] } = useQuery({
    queryKey: ["chart_accounts"],
    queryFn: async () => (await supabase.from("chart_accounts").select("*").order("code")).data ?? [],
  });
  const tints: Record<string, string> = {
    asset: "bg-emerald-500/10 text-emerald-700",
    liability: "bg-rose-500/10 text-rose-700",
    equity: "bg-violet-500/10 text-violet-700",
    income: "bg-blue-500/10 text-blue-700",
    expense: "bg-amber-500/10 text-amber-700",
  };
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader><TableRow>
          <TableHead className="w-24">{t("finance.code")}</TableHead>
          <TableHead>{t("finance.accountName")}</TableHead>
          <TableHead>{t("finance.accountType")}</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((r: any) => (
            <TableRow key={r.id} className="hover:bg-muted/40">
              <TableCell className="font-mono text-sm">{r.code}</TableCell>
              <TableCell className="font-semibold text-primary">{r.name_ar} <span className="text-xs text-muted-foreground ms-2">{r.name_en}</span></TableCell>
              <TableCell><span className={`px-2 py-0.5 rounded-full text-xs ${tints[r.type]}`}>{t(`finance.coaTypes.${r.type}`)}</span></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* -------- Journal -------- */
function JournalTab() {
  const { t } = useTranslation();
  const { data: rows = [] } = useQuery({
    queryKey: ["journal_entries"],
    queryFn: async () => (await supabase.from("journal_entries").select("*, journal_entry_lines(*)").order("entry_date", { ascending: false })).data ?? [],
  });
  return (
    <Card className="border-border/60">
      <CardContent className="pt-6">
        {rows.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">{t("finance.noEntries")}</div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t("finance.date")}</TableHead><TableHead>{t("finance.description")}</TableHead><TableHead className="text-end">{t("finance.debit")}</TableHead><TableHead className="text-end">{t("finance.credit")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono">{r.entry_number}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{new Date(r.entry_date).toLocaleDateString()}</TableCell>
                  <TableCell>{r.description ?? "—"}</TableCell>
                  <TableCell className="text-end tabular-nums">{fmt(Number(r.total_debit))}</TableCell>
                  <TableCell className="text-end tabular-nums">{fmt(Number(r.total_credit))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
