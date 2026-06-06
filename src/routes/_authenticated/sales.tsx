import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createSale } from "@/lib/api/sales.functions";
import { recordPayment } from "@/lib/api/payments.functions";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Trash2, Printer, Wallet, Search, Receipt, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({ meta: [{ title: "Sales — ERP" }] }),
  component: Page,
});

type Invoice = {
  id: string; invoice_number: string; invoice_date: string;
  customer_id: string | null; total: number; paid: number;
  status: "draft" | "confirmed" | "paid" | "partial" | "cancelled";
};
type Product = { id: string; name_ar: string; name_en: string | null; sale_price: number; tax_rate: number };
type Item = { product_id: string; quantity: number; unit_price: number; discount: number; tax_rate: number };

function Page() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const createSaleFn = useServerFn(createSale);
  const recordPaymentFn = useServerFn(recordPayment);
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("0");
  const [payMethodId, setPayMethodId] = useState<string>("");
  const [payNotes, setPayNotes] = useState("");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["sales_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales_invoices").select("*").order("invoice_date", { ascending: false }).limit(100);
      if (error) throw error;
      return data as Invoice[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", "active"],
    queryFn: async () => (await supabase.from("customers").select("id,name").eq("is_active", true).order("name")).data ?? [],
  });

  const customerName = (id: string | null) => customers.find((c) => c.id === id)?.name ?? t("sales.walkin");

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["payment_methods", "active"],
    queryFn: async () => (await supabase.from("payment_methods").select("id,name").eq("is_active", true).order("name")).data ?? [],
  });

  const { data: detail } = useQuery({
    queryKey: ["invoice_detail", detailId],
    queryFn: async () => {
      if (!detailId) return null;
      const [inv, items, pays] = await Promise.all([
        supabase.from("sales_invoices").select("*, customers(name, phone, address)").eq("id", detailId).single(),
        supabase.from("sales_invoice_items").select("*, products(name_ar, name_en, sku)").eq("invoice_id", detailId),
        supabase.from("payments").select("*, payment_methods(name)").eq("invoice_id", detailId).order("payment_date", { ascending: false }),
      ]);
      if (inv.error) throw inv.error;
      return {
        invoice: inv.data as Invoice & { customers: { name: string; phone: string | null; address: string | null } | null; notes: string | null; subtotal: number; tax_total: number; discount: number },
        items: (items.data ?? []) as Array<{ id: string; quantity: number; unit_price: number; discount: number; tax_rate: number; total: number; products: { name_ar: string; name_en: string | null; sku: string | null } | null }>,
        payments: (pays.data ?? []) as Array<{ id: string; amount: number; payment_date: string; notes: string | null; payment_methods: { name: string } | null }>,
      };
    },
    enabled: !!detailId,
  });

  const submitPayment = useMutation({
    mutationFn: async () => {
      if (!detailId) return;
      return await recordPaymentFn({
        data: {
          invoice_id: detailId,
          amount: Number(payAmount),
          payment_method_id: payMethodId || null,
          notes: payNotes || null,
        },
      });
    },
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["sales_invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice_detail", detailId] });
      setPayOpen(false); setPayAmount("0"); setPayNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const printInvoice = () => {
    if (typeof window !== "undefined") window.print();
  };

  // New invoice form state
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [items, setItems] = useState<Item[]>([]);
  const [paid, setPaid] = useState("0");
  const [notes, setNotes] = useState("");

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", "active"],
    queryFn: async () => (await supabase.from("warehouses").select("id,name,is_default").eq("is_active", true).order("name")).data ?? [],
  });

  const { data: company } = useQuery({
    queryKey: ["company_settings"],
    queryFn: async () => (await supabase.from("company_settings").select("*").limit(1).maybeSingle()).data,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", "active"],
    queryFn: async () => (await supabase.from("products").select("id,name_ar,name_en,sale_price,tax_rate").eq("is_active", true).order("name_ar")).data as Product[] ?? [],
  });

  const productLabel = (p: Product) => i18n.language === "en" && p.name_en ? p.name_en : p.name_ar;

  const totals = useMemo(() => {
    let subtotal = 0, disc = 0, tax = 0;
    for (const i of items) {
      const gross = i.quantity * i.unit_price;
      const net = gross - i.discount;
      subtotal += gross;
      disc += i.discount;
      tax += (net * i.tax_rate) / 100;
    }
    const total = subtotal - disc + tax;
    return { subtotal, disc, tax, total };
  }, [items]);

  const openNew = () => {
    const def = warehouses.find((w) => w.is_default) ?? warehouses[0];
    setWarehouseId(def?.id ?? "");
    setCustomerId("");
    setItems([]);
    setPaid("0");
    setNotes("");
    setOpen(true);
  };

  const addItem = () => setItems([...items, { product_id: "", quantity: 1, unit_price: 0, discount: 0, tax_rate: 0 }]);
  const updateItem = (idx: number, patch: Partial<Item>) => setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const onProductPick = (idx: number, pid: string) => {
    const p = products.find((x) => x.id === pid);
    if (p) updateItem(idx, { product_id: pid, unit_price: Number(p.sale_price), tax_rate: Number(p.tax_rate) });
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!warehouseId) throw new Error(t("sales.selectWarehouse"));
      if (items.length === 0 || items.some((i) => !i.product_id || i.quantity <= 0)) throw new Error(t("sales.noItems"));
      return await createSaleFn({
        data: {
          customer_id: customerId || null,
          warehouse_id: warehouseId,
          items: items.map((i) => ({
            product_id: i.product_id, quantity: Number(i.quantity), unit_price: Number(i.unit_price),
            discount: Number(i.discount), tax_rate: Number(i.tax_rate),
          })),
          paid: Number(paid) || 0,
          notes: notes || null,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`${t("sales.invoice")} ${res.invoice_number}`);
      qc.invalidateQueries({ queryKey: ["sales_invoices"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const statusVariant: Record<Invoice["status"], "default" | "secondary" | "outline" | "destructive"> = {
    paid: "default", partial: "secondary", confirmed: "outline", draft: "outline", cancelled: "destructive",
  };

  const [search, setSearch] = useState("");
  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) =>
      inv.invoice_number.toLowerCase().includes(q) ||
      customerName(inv.customer_id).toLowerCase().includes(q),
    );
  }, [invoices, search, customers]);

  const summary = useMemo(() => {
    const totalSales = invoices.reduce((s, i) => s + Number(i.total || 0), 0);
    const totalPaid = invoices.reduce((s, i) => s + Number(i.paid || 0), 0);
    const totalDue = totalSales - totalPaid;
    return { count: invoices.length, totalSales, totalPaid, totalDue };
  }, [invoices]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("sales.title")}
        description={t("sales.subtitle", "كل فواتير المبيعات والمدفوعات في مكان واحد")}
        actions={
          <Button onClick={openNew} className="rounded-xl shadow-md h-10">
            <Plus className="h-4 w-4 me-2" />{t("sales.new")}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t("sales.invoicesCount", "عدد الفواتير"), value: summary.count.toString(), icon: Receipt, bg: "bg-primary/10 text-primary" },
          { label: t("sales.totalSales", "إجمالي المبيعات"), value: fmt(summary.totalSales), icon: TrendingUp, bg: "bg-emerald-500/10 text-emerald-600" },
          { label: t("sales.totalPaid", "إجمالي المحصّل"), value: fmt(summary.totalPaid), icon: Wallet, bg: "bg-violet-500/10 text-violet-600" },
          { label: t("sales.totalDue", "إجمالي المستحق"), value: fmt(summary.totalDue), icon: Clock, bg: "bg-amber-500/10 text-amber-600" },
        ].map((s) => (
          <Card key={s.label} className="border-border/60 shadow-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{s.label}</p>
                <p className="text-2xl font-bold tabular-nums">{s.value}</p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${s.bg}`}>
                <s.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("common.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9 h-10 rounded-full bg-muted/60 border-transparent"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent">
              <TableHead>{t("sales.invoice_number")}</TableHead>
              <TableHead>{t("sales.date")}</TableHead>
              <TableHead>{t("sales.customer")}</TableHead>
              <TableHead className="text-end">{t("sales.total")}</TableHead>
              <TableHead className="text-end">{t("sales.paid")}</TableHead>
              <TableHead>{t("sales.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
            ) : filteredInvoices.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
            ) : filteredInvoices.map((inv) => (
              <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setDetailId(inv.id)}>
                <TableCell className="font-mono font-semibold text-primary">{inv.invoice_number}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{new Date(inv.invoice_date).toLocaleString()}</TableCell>
                <TableCell className="font-medium">{customerName(inv.customer_id)}</TableCell>
                <TableCell className="text-end tabular-nums font-semibold">{fmt(Number(inv.total))}</TableCell>
                <TableCell className="text-end tabular-nums">{fmt(Number(inv.paid))}</TableCell>
                <TableCell><Badge variant={statusVariant[inv.status]} className="rounded-full capitalize">{t(`sales.statuses.${inv.status}`)}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("sales.new")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>{t("sales.warehouse")} *</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger><SelectValue placeholder={t("sales.selectWarehouse")} /></SelectTrigger>
                  <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("sales.customer")}</Label>
                <Select value={customerId || "walkin"} onValueChange={(v) => setCustomerId(v === "walkin" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walkin">{t("sales.walkin")}</SelectItem>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">{t("sales.product")}</TableHead>
                    <TableHead>{t("sales.qty")}</TableHead>
                    <TableHead>{t("sales.price")}</TableHead>
                    <TableHead>{t("sales.discount")}</TableHead>
                    <TableHead>{t("sales.tax")}</TableHead>
                    <TableHead className="text-end">{t("sales.lineTotal")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-4 text-muted-foreground text-sm">{t("sales.noItems")}</TableCell></TableRow>
                  ) : items.map((it, idx) => {
                    const lineTotal = (it.quantity * it.unit_price - it.discount) * (1 + it.tax_rate / 100);
                    return (
                      <TableRow key={idx}>
                        <TableCell>
                          <Select value={it.product_id} onValueChange={(v) => onProductPick(idx, v)}>
                            <SelectTrigger><SelectValue placeholder={t("sales.selectProduct")} /></SelectTrigger>
                            <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{productLabel(p)}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><Input type="number" step="0.001" className="w-20" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} /></TableCell>
                        <TableCell><Input type="number" step="0.01" className="w-24" value={it.unit_price} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })} /></TableCell>
                        <TableCell><Input type="number" step="0.01" className="w-20" value={it.discount} onChange={(e) => updateItem(idx, { discount: Number(e.target.value) })} /></TableCell>
                        <TableCell><Input type="number" step="0.01" className="w-20" value={it.tax_rate} onChange={(e) => updateItem(idx, { tax_rate: Number(e.target.value) })} /></TableCell>
                        <TableCell className="text-end tabular-nums">{fmt(lineTotal)}</TableCell>
                        <TableCell><Button size="icon" variant="ghost" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="p-2 border-t">
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4 me-1" />{t("sales.addItem")}</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t("customers.notes")}</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                <div className="mt-3">
                  <Label>{t("sales.paid")}</Label>
                  <Input type="number" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("sales.subtotal")}</span><span className="tabular-nums">{fmt(totals.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("sales.discountTotal")}</span><span className="tabular-nums">−{fmt(totals.disc)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("sales.taxTotal")}</span><span className="tabular-nums">{fmt(totals.tax)}</span></div>
                <div className="flex justify-between font-bold text-base border-t pt-2 mt-2"><span>{t("sales.total")}</span><span className="tabular-nums">{fmt(totals.total)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>{t("sales.due")}</span><span className="tabular-nums">{fmt(Math.max(0, totals.total - (Number(paid) || 0)))}</span></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>{t("sales.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto print:shadow-none">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>{t("invoice.details")}{detail?.invoice ? ` — ${detail.invoice.invoice_number}` : ""}</span>
              <div className="flex gap-2 print:hidden">
                <Button size="sm" variant="outline" onClick={printInvoice}><Printer className="h-4 w-4 me-1" />{t("invoice.print")}</Button>
                {detail?.invoice && detail.invoice.status !== "paid" && detail.invoice.status !== "cancelled" && (
                  <Button size="sm" onClick={() => { const due = Number(detail.invoice.total) - Number(detail.invoice.paid); setPayAmount(due.toFixed(2)); setPayMethodId(paymentMethods[0]?.id ?? ""); setPayOpen(true); }}>
                    <Wallet className="h-4 w-4 me-1" />{t("payments.add")}
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          {detail ? (
            <div id="invoice-print" className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-muted-foreground text-xs">{t("sales.customer")}</div>
                  <div className="font-medium">{detail.invoice.customers?.name ?? t("sales.walkin")}</div>
                  {detail.invoice.customers?.phone && <div className="text-xs text-muted-foreground">{detail.invoice.customers.phone}</div>}
                </div>
                <div className="text-end">
                  <div className="text-muted-foreground text-xs">{t("sales.date")}</div>
                  <div className="font-medium">{new Date(detail.invoice.invoice_date).toLocaleString()}</div>
                  <Badge variant={statusVariant[detail.invoice.status]} className="mt-1">{t(`sales.statuses.${detail.invoice.status}`)}</Badge>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("sales.product")}</TableHead>
                      <TableHead className="text-end">{t("sales.qty")}</TableHead>
                      <TableHead className="text-end">{t("sales.price")}</TableHead>
                      <TableHead className="text-end">{t("sales.lineTotal")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell>{i18n.language === "en" && it.products?.name_en ? it.products.name_en : it.products?.name_ar ?? "—"}</TableCell>
                        <TableCell className="text-end tabular-nums">{Number(it.quantity)}</TableCell>
                        <TableCell className="text-end tabular-nums">{fmt(Number(it.unit_price))}</TableCell>
                        <TableCell className="text-end tabular-nums">{fmt(Number(it.total))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <div className="w-64 space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("sales.subtotal")}</span><span className="tabular-nums">{fmt(Number(detail.invoice.subtotal))}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("sales.discountTotal")}</span><span className="tabular-nums">−{fmt(Number(detail.invoice.discount))}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("sales.taxTotal")}</span><span className="tabular-nums">{fmt(Number(detail.invoice.tax_total))}</span></div>
                  <div className="flex justify-between font-bold text-base border-t pt-2"><span>{t("sales.total")}</span><span className="tabular-nums">{fmt(Number(detail.invoice.total))}</span></div>
                  <div className="flex justify-between text-success"><span>{t("sales.paid")}</span><span className="tabular-nums">{fmt(Number(detail.invoice.paid))}</span></div>
                  <div className="flex justify-between text-warning"><span>{t("payments.remaining")}</span><span className="tabular-nums">{fmt(Number(detail.invoice.total) - Number(detail.invoice.paid))}</span></div>
                </div>
              </div>

              <div>
                <div className="font-semibold mb-2">{t("payments.title")}</div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("payments.date")}</TableHead>
                        <TableHead>{t("payments.method")}</TableHead>
                        <TableHead className="text-end">{t("payments.amount")}</TableHead>
                        <TableHead>{t("payments.notes")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.payments.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground text-sm">{t("payments.noPayments")}</TableCell></TableRow>
                      ) : detail.payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs text-muted-foreground">{new Date(p.payment_date).toLocaleString()}</TableCell>
                          <TableCell>{p.payment_methods?.name ?? "—"}</TableCell>
                          <TableCell className="text-end tabular-nums">{fmt(Number(p.amount))}</TableCell>
                          <TableCell className="text-xs">{p.notes ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">{t("common.loading")}</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("payments.add")}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>{t("payments.method")}</Label>
              <Select value={payMethodId || "none"} onValueChange={(v) => setPayMethodId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {paymentMethods.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label>{t("payments.amount")}</Label><Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>{t("payments.notes")}</Label><Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => submitPayment.mutate()} disabled={submitPayment.isPending || Number(payAmount) <= 0}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}