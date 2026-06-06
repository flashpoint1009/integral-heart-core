import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/movements")({
  head: () => ({ meta: [{ title: "Stock Movements — ERP" }] }),
  component: Page,
});

type MovementType = "purchase" | "sale" | "adjustment" | "transfer_in" | "transfer_out" | "return_in" | "return_out";
type Row = {
  id: string; created_at: string; product_id: string; warehouse_id: string;
  movement_type: MovementType; quantity: number; reference_type: string | null; notes: string | null;
  products: { name_ar: string; name_en: string | null } | null;
  warehouses: { name: string } | null;
};

function Page() {
  const { t, i18n } = useTranslation();
  const [warehouseId, setWarehouseId] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [query, setQuery] = useState("");

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", "all"],
    queryFn: async () => (await supabase.from("warehouses").select("id,name").order("name")).data ?? [],
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["stock_movements", warehouseId, type],
    queryFn: async () => {
      let q = supabase
        .from("stock_movements")
        .select("id, created_at, product_id, warehouse_id, movement_type, quantity, reference_type, notes, products(name_ar, name_en), warehouses(name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (warehouseId !== "all") q = q.eq("warehouse_id", warehouseId);
      if (type !== "all") q = q.eq("movement_type", type as MovementType);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const filtered = useMemo(() => {
    const qq = query.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter((r) => {
      const name = (r.products?.name_ar ?? "") + " " + (r.products?.name_en ?? "");
      return name.toLowerCase().includes(qq);
    });
  }, [rows, query]);

  const productName = (r: Row) =>
    i18n.language === "en" && r.products?.name_en ? r.products.name_en : r.products?.name_ar ?? "—";

  const typeVariant = (mt: MovementType): "default" | "secondary" | "destructive" | "outline" =>
    mt === "purchase" || mt === "return_in" || mt === "transfer_in" ? "default"
    : mt === "sale" || mt === "return_out" || mt === "transfer_out" ? "destructive"
    : "secondary";

  return (
    <div className="p-6 space-y-4">
      <PageHeader title={t("movements.title")} description={t("movements.description")} />
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5 flex-1 min-w-[180px]">
            <Label>{t("common.search")}</Label>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("movements.product")} />
          </div>
          <div className="grid gap-1.5 min-w-[180px]">
            <Label>{t("movements.warehouse")}</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 min-w-[160px]">
            <Label>{t("movements.type")}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                {(["purchase","sale","adjustment","transfer_in","transfer_out","return_in","return_out"] as const).map((k) => (
                  <SelectItem key={k} value={k}>{t(`movements.types.${k}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("movements.date")}</TableHead>
              <TableHead>{t("movements.product")}</TableHead>
              <TableHead>{t("movements.warehouse")}</TableHead>
              <TableHead>{t("movements.type")}</TableHead>
              <TableHead className="text-end">{t("movements.qty")}</TableHead>
              <TableHead>{t("movements.reference")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell className="font-medium">{productName(r)}</TableCell>
                <TableCell>{r.warehouses?.name ?? "—"}</TableCell>
                <TableCell><Badge variant={typeVariant(r.movement_type)}>{t(`movements.types.${r.movement_type}`)}</Badge></TableCell>
                <TableCell className={`text-end tabular-nums font-medium ${Number(r.quantity) < 0 ? "text-destructive" : "text-success"}`}>
                  {Number(r.quantity) > 0 ? "+" : ""}{Number(r.quantity)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.reference_type ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}