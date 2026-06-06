import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import {
  listTenants,
  listTenantModules,
  toggleModule,
  AVAILABLE_MODULES,
} from "@/lib/api/developer.functions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layers } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/developer/modules")({
  head: () => ({ meta: [{ title: "إدارة المكونات — Developer" }] }),
  component: ModulesPage,
});

function ModulesPage() {
  const { isDeveloper, hasRole, tenantId } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listTenants);
  const modulesFn = useServerFn(listTenantModules);
  const toggleFn = useServerFn(toggleModule);

  const [selectedTenant, setSelectedTenant] = useState<string>("");

  const { data: tenantsData } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => listFn(),
    enabled: isDeveloper || hasRole("admin"),
  });

  // Auto-select tenant for non-developer (admin)
  useEffect(() => {
    if (!selectedTenant && !isDeveloper && tenantId) {
      setSelectedTenant(tenantId);
    } else if (!selectedTenant && tenantsData?.tenants?.[0]) {
      setSelectedTenant(tenantsData.tenants[0].id);
    }
  }, [tenantsData, isDeveloper, tenantId, selectedTenant]);

  const { data: modulesData } = useQuery({
    queryKey: ["tenant_modules", selectedTenant],
    queryFn: () => modulesFn({ data: { tenant_id: selectedTenant } }),
    enabled: !!selectedTenant,
  });

  const toggleMut = useMutation({
    mutationFn: (vars: { module_key: string; enabled: boolean }) =>
      toggleFn({
        data: {
          tenant_id: selectedTenant,
          module_key: vars.module_key,
          enabled: vars.enabled,
        },
      }),
    onSuccess: () => {
      toast.success("تم التحديث");
      qc.invalidateQueries({ queryKey: ["tenant_modules", selectedTenant] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isDeveloper && !hasRole("admin")) {
    return (
      <div className="p-6">
        <PageHeader title="غير مصرح" />
      </div>
    );
  }

  const modulesMap = new Map<string, boolean>();
  for (const m of modulesData?.modules ?? []) {
    modulesMap.set(m.module_key, m.enabled);
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="إدارة المكونات"
        description="فعّل أو ألغِ مكونات معينة لكل شركة — أساس البيع بنسخ مختلفة"
      />

      {isDeveloper && (
        <Card>
          <CardContent className="pt-6">
            <label className="text-sm font-semibold mb-2 block">
              اختر الشركة
            </label>
            <Select value={selectedTenant} onValueChange={setSelectedTenant}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="اختر شركة" />
              </SelectTrigger>
              <SelectContent>
                {(tenantsData?.tenants ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {AVAILABLE_MODULES.map((m) => {
          const enabled = modulesMap.get(m.key) ?? true;
          return (
            <Card key={m.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  {m.label}
                </CardTitle>
                <Switch
                  checked={enabled}
                  disabled={!selectedTenant || toggleMut.isPending}
                  onCheckedChange={(checked) =>
                    toggleMut.mutate({ module_key: m.key, enabled: checked })
                  }
                />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  المفتاح: <code className="bg-muted px-1 rounded">{m.key}</code>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="rounded-md border bg-blue-50 dark:bg-blue-950/20 p-4 text-sm">
        <p className="font-semibold mb-1">💡 ملاحظة</p>
        <p className="text-muted-foreground">
          إلغاء أي مكون يخفي صفحاته من القائمة الجانبية تلقائياً لكل مستخدمي
          هذه الشركة. التغيير يظهر فور إعادة تسجيل الدخول.
        </p>
      </div>
    </div>
  );
}