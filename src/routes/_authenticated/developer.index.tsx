import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import {
  seedDemoUsers,
  listTenants,
  promoteToDeveloper,
} from "@/lib/api/developer.functions";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  Sparkles,
  Crown,
  Layers,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/developer/")({
  head: () => ({ meta: [{ title: "لوحة المطور — Super Admin" }] }),
  component: DeveloperHome,
});

function DeveloperHome() {
  const { isDeveloper, hasRole } = useAuth();
  const canSee = isDeveloper || hasRole("admin");
  const [promoteEmail, setPromoteEmail] = useState("");

  const seedFn = useServerFn(seedDemoUsers);
  const promoteFn = useServerFn(promoteToDeveloper);
  const listFn = useServerFn(listTenants);

  const { data: tenantsData } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => listFn(),
    enabled: canSee,
  });

  const seedMut = useMutation({
    mutationFn: () => seedFn(),
    onSuccess: (r) => {
      const created = r.results.filter((x) => x.status === "created").length;
      const exists = r.results.filter((x) => x.status === "exists").length;
      const errors = r.results.filter((x) => x.status === "error");
      toast.success(`تم: ${created} جديد، ${exists} موجود`);
      if (errors.length) toast.error(`أخطاء: ${errors.length}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const promoteMut = useMutation({
    mutationFn: (email: string) => promoteFn({ data: { email } }),
    onSuccess: () => {
      toast.success("تم منح صلاحية المطور — أعد تسجيل الدخول لتفعيلها");
      setPromoteEmail("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canSee) {
    return (
      <div className="p-6">
        <PageHeader title="غير مصرح" description="هذه الصفحة للمطور والمدير فقط" />
      </div>
    );
  }

  const tenants = tenantsData?.tenants ?? [];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="لوحة المطور"
        description="إدارة النسخ والعملاء والمكونات المباعة"
      />

      {/* Quick stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">العملاء (Tenants)</p>
                <p className="text-3xl font-bold">{tenants.length}</p>
              </div>
              <Building2 className="h-10 w-10 text-primary/40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">العملاء النشطون</p>
                <p className="text-3xl font-bold text-green-600">
                  {tenants.filter((t) => t.status === "active").length}
                </p>
              </div>
              <Sparkles className="h-10 w-10 text-green-500/40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">حالتك</p>
                <Badge variant="default" className="mt-1">
                  {isDeveloper ? "مطور (Super Admin)" : "مدير"}
                </Badge>
              </div>
              <Crown className="h-10 w-10 text-amber-500/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link to="/developer/tenants">
          <Card className="hover:shadow-lg transition cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" /> إدارة الشركات (Tenants)
                </span>
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                إنشاء نسخة جديدة، تفعيل/إيقاف عميل، إدارة الخطط
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/developer/modules">
          <Card className="hover:shadow-lg transition cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Layers className="h-5 w-5" /> إدارة المكونات
                </span>
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                فعّل أو ألغِ مكونات معينة لكل عميل (HR، المالية، المخزون...)
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Setup tools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> أدوات الإعداد السريع
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/30 p-4">
            <h3 className="font-semibold mb-2">إنشاء حسابات تجريبية لكل الأدوار</h3>
            <p className="text-sm text-muted-foreground mb-3">
              ينشئ 8 حسابات (admin, sales, accountant, warehouse, cashier, rep,
              supervisor, hr) بكلمة سر موحدة: <code className="bg-background px-1 rounded">Demo@2026</code>
            </p>
            <Button
              onClick={() => seedMut.mutate()}
              disabled={seedMut.isPending}
            >
              {seedMut.isPending ? "جاري الإنشاء..." : "إنشاء الحسابات التجريبية"}
            </Button>
            {seedMut.data && (
              <div className="mt-4 space-y-1 text-sm">
                {seedMut.data.results.map((r) => (
                  <div key={r.email} className="flex justify-between border-b pb-1">
                    <span>{r.email}</span>
                    <Badge
                      variant={
                        r.status === "created"
                          ? "default"
                          : r.status === "exists"
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {r.status === "created"
                        ? "تم الإنشاء"
                        : r.status === "exists"
                        ? "موجود مسبقاً"
                        : "خطأ"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              ترقية مستخدم لصلاحية المطور
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              أدخل بريد المستخدم الإلكتروني ليحصل على صلاحية Super Admin
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="user@example.com"
                value={promoteEmail}
                onChange={(e) => setPromoteEmail(e.target.value)}
              />
              <Button
                onClick={() => promoteMut.mutate(promoteEmail)}
                disabled={!promoteEmail || promoteMut.isPending}
              >
                ترقية
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}