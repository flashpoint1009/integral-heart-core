import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listTenantUsers, setScreenPermission, resetScreenPermission } from "@/lib/api/permissions.functions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield, RotateCcw, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/permissions")({
  head: () => ({ meta: [{ title: "صلاحيات الموظفين — ERP" }] }),
  component: Page,
});

type Screen = { key: string; label: string; group: string };
const SCREENS: Screen[] = [
  { key: "/pos", label: "نقطة البيع", group: "العمليات" },
  { key: "/sales", label: "المبيعات", group: "العمليات" },
  { key: "/purchases", label: "المشتريات", group: "العمليات" },
  { key: "/inventory", label: "المخزون", group: "المخزون" },
  { key: "/movements", label: "حركة المخزون", group: "المخزون" },
  { key: "/warehouses", label: "المخازن", group: "المخزون" },
  { key: "/products", label: "المنتجات", group: "البيانات" },
  { key: "/categories", label: "التصنيفات", group: "البيانات" },
  { key: "/customers", label: "العملاء", group: "البيانات" },
  { key: "/suppliers", label: "الموردين", group: "البيانات" },
  { key: "/finance", label: "المالية", group: "المالية" },
  { key: "/hr", label: "الموارد البشرية", group: "الموارد البشرية" },
  { key: "/supervisor", label: "المشرف الميداني", group: "الميدان" },
  { key: "/rep", label: "شاشة المندوب", group: "الميدان" },
  { key: "/reports", label: "التقارير", group: "التقارير" },
  { key: "/dashboard/executive", label: "داشبورد تنفيذي", group: "التقارير" },
  { key: "/dashboard/forecast", label: "توقع AI", group: "التقارير" },
  { key: "/dashboard/profitability", label: "تحليل الربحية", group: "التقارير" },
  { key: "/dashboard/reps", label: "أداء المندوبين", group: "التقارير" },
  { key: "/users", label: "إدارة المستخدمين", group: "النظام" },
  { key: "/settings", label: "الإعدادات", group: "النظام" },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير عام", manager: "مدير", sales_manager: "مدير مبيعات",
  accountant: "محاسب", warehouse: "أمين مخزن", cashier: "كاشير",
  sales_rep: "مندوب", supervisor: "مشرف", hr: "موارد بشرية", developer: "مطور",
};

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTenantUsers);
  const setFn = useServerFn(setScreenPermission);
  const resetFn = useServerFn(resetScreenPermission);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["tenant_users"],
    queryFn: () => listFn({ data: undefined }),
  });

  const setMut = useMutation({
    mutationFn: (vars: { user_id: string; tenant_id: string; screen_key: string; allowed: boolean }) =>
      setFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant_users"] });
      toast.success("تم حفظ الصلاحية");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMut = useMutation({
    mutationFn: (vars: { user_id: string; screen_key: string }) => resetFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant_users"] });
      toast.success("تم إعادة الافتراضي");
    },
  });

  if (isLoading || !data) return <div className="p-6 text-muted-foreground">جاري التحميل…</div>;

  const users = data.users.filter((u) =>
    !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()),
  );
  const selected = users.find((u) => u.id === selectedUser) ?? users[0];

  const overrideFor = (screenKey: string) => selected?.overrides.find((o) => o.screen_key === screenKey);
  const groups = [...new Set(SCREENS.map((s) => s.group))];

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="صلاحيات الموظفين" description="تحكم بأي شاشة يقدر يدخلها كل موظف" />

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">الموظفين ({users.length})</CardTitle>
            <div className="relative">
              <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="بحث…" value={search} onChange={(e) => setSearch(e.target.value)} className="pr-8 h-9" />
            </div>
          </CardHeader>
          <CardContent className="p-2 max-h-[600px] overflow-y-auto space-y-1">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedUser(u.id)}
                className={`w-full text-start p-3 rounded-lg transition ${selected?.id === u.id ? "bg-primary/10 border border-primary/30" : "hover:bg-accent"}`}
              >
                <div className="font-medium text-sm truncate">{u.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {u.roles.slice(0, 2).map((r) => (
                    <Badge key={r} variant="secondary" className="text-[10px] py-0 px-1.5 h-4">{ROLE_LABELS[r] ?? r}</Badge>
                  ))}
                  {u.overrides.length > 0 && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 bg-amber-500/15 text-amber-700 border-amber-500/30">
                      {u.overrides.length} استثناء
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {selected && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle>{selected.full_name}</CardTitle>
                  <div className="text-xs text-muted-foreground mt-1">{selected.email}</div>
                </div>
                <div className="flex flex-wrap gap-1 justify-end">
                  {selected.roles.map((r) => <Badge key={r} variant="secondary">{ROLE_LABELS[r] ?? r}</Badge>)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={groups[0]}>
                <TabsList className="flex-wrap h-auto">
                  {groups.map((g) => <TabsTrigger key={g} value={g}>{g}</TabsTrigger>)}
                </TabsList>
                {groups.map((g) => (
                  <TabsContent key={g} value={g} className="mt-4 space-y-2">
                    {SCREENS.filter((s) => s.group === g).map((s) => {
                      const ov = overrideFor(s.key);
                      const allowed = ov ? ov.allowed : true;
                      return (
                        <div key={s.key} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{s.label}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {s.key}
                              {ov && (
                                <Badge variant="outline" className="ms-2 text-[10px] py-0 h-4">
                                  استثناء يدوي
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {ov && (
                              <Button size="sm" variant="ghost" onClick={() => resetMut.mutate({ user_id: selected.id, screen_key: s.key })} title="إرجاع للافتراضي">
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                            <Switch
                              checked={allowed}
                              disabled={!selected.tenant_id || setMut.isPending}
                              onCheckedChange={(v) =>
                                selected.tenant_id && setMut.mutate({ user_id: selected.id, tenant_id: selected.tenant_id, screen_key: s.key, allowed: v })
                              }
                            />
                          </div>
                        </div>
                      );
                    })}
                  </TabsContent>
                ))}
              </Tabs>
              <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                💡 افتراضياً كل الشاشات مسموحة حسب الموديولات المفعّلة في الشركة ودور الموظف. الاستثناءات هنا تتقدم على الافتراضي وتؤثر فوراً عند تسجيل دخول الموظف.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}