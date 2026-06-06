import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import {
  listTenants,
  createTenant,
  updateTenantStatus,
  AVAILABLE_MODULES,
} from "@/lib/api/developer.functions";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/developer/tenants")({
  head: () => ({ meta: [{ title: "إدارة الشركات — Developer" }] }),
  component: TenantsPage,
});

function TenantsPage() {
  const { isDeveloper } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listTenants);
  const createFn = useServerFn(createTenant);
  const updateStatusFn = useServerFn(updateTenantStatus);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    contact_email: "",
    contact_phone: "",
    plan: "standard" as "basic" | "standard" | "enterprise",
    max_users: 50,
    modules: AVAILABLE_MODULES.map((m) => m.key),
  });

  const { data } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => listFn(),
    enabled: isDeveloper,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          name: form.name,
          slug: form.slug || undefined,
          contact_email: form.contact_email || null,
          contact_phone: form.contact_phone || null,
          plan: form.plan,
          max_users: form.max_users,
          modules: form.modules,
        },
      }),
    onSuccess: () => {
      toast.success("تم إنشاء الشركة");
      qc.invalidateQueries({ queryKey: ["tenants"] });
      setOpen(false);
      setForm({
        name: "",
        slug: "",
        contact_email: "",
        contact_phone: "",
        plan: "standard",
        max_users: 50,
        modules: AVAILABLE_MODULES.map((m) => m.key),
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (vars: { tenant_id: string; status: "active" | "suspended" | "trial" }) =>
      updateStatusFn({ data: vars }),
    onSuccess: () => {
      toast.success("تم التحديث");
      qc.invalidateQueries({ queryKey: ["tenants"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isDeveloper) {
    return (
      <div className="p-6">
        <PageHeader title="غير مصرح" description="هذه الصفحة للمطور فقط" />
      </div>
    );
  }

  const tenants = data?.tenants ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="إدارة الشركات (Tenants)"
          description="كل شركة لها بياناتها المعزولة ومكوناتها الخاصة"
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="me-1 h-4 w-4" /> إنشاء نسخة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>إنشاء نسخة جديدة (Tenant)</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>اسم الشركة *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="شركة العميل"
                  />
                </div>
                <div>
                  <Label>المعرف (slug)</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) =>
                      setForm({ ...form, slug: e.target.value.toLowerCase() })
                    }
                    placeholder="company-name"
                  />
                </div>
                <div>
                  <Label>البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    value={form.contact_email}
                    onChange={(e) =>
                      setForm({ ...form, contact_email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>الهاتف</Label>
                  <Input
                    value={form.contact_phone}
                    onChange={(e) =>
                      setForm({ ...form, contact_phone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>الخطة</Label>
                  <Select
                    value={form.plan}
                    onValueChange={(v) =>
                      setForm({ ...form, plan: v as typeof form.plan })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">أساسية</SelectItem>
                      <SelectItem value="standard">قياسية</SelectItem>
                      <SelectItem value="enterprise">احترافية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>أقصى عدد مستخدمين</Label>
                  <Input
                    type="number"
                    value={form.max_users}
                    onChange={(e) =>
                      setForm({ ...form, max_users: Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div>
                <Label className="mb-2 block">المكونات المفعلة</Label>
                <div className="grid grid-cols-2 gap-2 rounded-md border p-3 bg-muted/30">
                  {AVAILABLE_MODULES.map((m) => (
                    <label
                      key={m.key}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={form.modules.includes(m.key)}
                        onCheckedChange={(checked) => {
                          setForm({
                            ...form,
                            modules: checked
                              ? [...form.modules, m.key]
                              : form.modules.filter((x) => x !== m.key),
                          });
                        }}
                      />
                      <span className="text-sm">{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                إلغاء
              </Button>
              <Button
                onClick={() => createMut.mutate()}
                disabled={!form.name || createMut.isPending}
              >
                {createMut.isPending ? "جاري الإنشاء..." : "إنشاء"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الشركة</TableHead>
              <TableHead>الخطة</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>المستخدمين</TableHead>
              <TableHead>تاريخ الإنشاء</TableHead>
              <TableHead className="text-end">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  لا توجد شركات
                </TableCell>
              </TableRow>
            ) : (
              tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <div>
                        <div className="font-semibold">{t.name}</div>
                        {t.slug && (
                          <div className="text-xs text-muted-foreground">
                            {t.slug}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{t.plan}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        t.status === "active"
                          ? "default"
                          : t.status === "suspended"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {t.status === "active"
                        ? "نشط"
                        : t.status === "suspended"
                        ? "متوقف"
                        : "تجريبي"}
                    </Badge>
                  </TableCell>
                  <TableCell>{t.max_users}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString("ar-EG")}
                  </TableCell>
                  <TableCell className="text-end">
                    <Select
                      value={t.status}
                      onValueChange={(v) =>
                        statusMut.mutate({
                          tenant_id: t.id,
                          status: v as "active" | "suspended" | "trial",
                        })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">تفعيل</SelectItem>
                        <SelectItem value="suspended">إيقاف</SelectItem>
                        <SelectItem value="trial">تجريبي</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}