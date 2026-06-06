import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { listRecipients, sendNotification } from "@/lib/api/notifications.functions";
import { ensurePushSubscription } from "@/lib/push-client";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Send, Bell, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications/send")({
  head: () => ({ meta: [{ title: "إرسال إشعار" }] }),
  component: SendPage,
});

const ROLES = [
  { value: "all_users", label: "كل المستخدمين" },
  { value: "admin", label: "المدراء" },
  { value: "hr", label: "الموارد البشرية" },
  { value: "supervisor", label: "المشرفون" },
  { value: "sales_rep", label: "المناديب" },
  { value: "warehouse", label: "أمناء المخازن" },
  { value: "cashier", label: "الكاشير" },
  { value: "accountant", label: "المحاسبون" },
];

function SendPage() {
  const { hasAnyRole } = useAuth();
  const allowed = hasAnyRole(["admin", "manager", "supervisor", "hr"]);
  const listFn = useServerFn(listRecipients);
  const sendFn = useServerFn(sendNotification);

  const { data: users } = useQuery({ queryKey: ["recipients"], queryFn: () => listFn(), enabled: allowed });

  const [mode, setMode] = useState<"user" | "role">("user");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [role, setRole] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");

  const sendMut = useMutation({
    mutationFn: () =>
      sendFn({
        data: {
          ...(mode === "user" ? { user_ids: userIds } : { role: role === "all_users" ? undefined : role }),
          ...(mode === "role" && role === "all_users" ? { user_ids: (users?.users ?? []).map((u: any) => u.id) } : {}),
          type: "manual",
          title,
          body: body || undefined,
          link: link || undefined,
        },
      }),
    onSuccess: (r) => {
      toast.success(`تم الإرسال لـ ${r.created} مستخدم • وصل push لـ ${r.pushed}`);
      setTitle(""); setBody(""); setLink(""); setUserIds([]);
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الإرسال"),
  });

  async function enablePush() {
    const result = await ensurePushSubscription();
    if (result === "granted") toast.success("تم تفعيل الإشعارات على هذا الجهاز");
    else if (result === "denied") toast.error("تم رفض إذن الإشعارات");
    else if (result === "unsupported") toast.error("المتصفح لا يدعم الإشعارات");
  }

  if (!allowed) return <div className="p-6"><Card><CardContent className="p-8 text-center">غير مصرّح بإرسال الإشعارات</CardContent></Card></div>;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      <PageHeader title="إرسال إشعار" description="إشعارات موجّهة للموظفين تصل للموبايل حتى لو الشاشة مقفولة" />

      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BellRing className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold text-sm">تفعيل الإشعارات على هذا الجهاز</div>
              <div className="text-xs text-muted-foreground">يجب تفعيلها مرة واحدة لاستقبال الإشعارات والشاشة مقفولة</div>
            </div>
          </div>
          <Button onClick={enablePush} variant="outline" size="sm" className="gap-2"><Bell className="h-4 w-4" /> تفعيل</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex gap-2">
            <Button variant={mode === "user" ? "default" : "outline"} size="sm" onClick={() => setMode("user")}>موظف محدد</Button>
            <Button variant={mode === "role" ? "default" : "outline"} size="sm" onClick={() => setMode("role")}>مجموعة (قسم)</Button>
          </div>

          {mode === "user" ? (
            <div className="space-y-2">
              <Label>اختر المستلمين</Label>
              <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-1">
                {(users?.users ?? []).map((u: any) => {
                  const checked = userIds.includes(u.id);
                  return (
                    <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setUserIds(e.target.checked ? [...userIds, u.id] : userIds.filter((id) => id !== u.id))}
                      />
                      <span className="text-sm">{u.full_name || u.email}</span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </label>
                  );
                })}
              </div>
              {userIds.length > 0 && <Badge variant="secondary">{userIds.length} مستلم</Badge>}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>المجموعة</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue placeholder="اختر مجموعة" /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="t">العنوان *</Label>
            <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="مثال: تذكير اجتماع الساعة 4" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b">الرسالة</Label>
            <Textarea id="b" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l">رابط (اختياري)</Label>
            <Input id="l" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/hr أو /supervisor" />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => sendMut.mutate()}
              disabled={sendMut.isPending || !title || (mode === "user" ? userIds.length === 0 : !role)}
              size="lg"
              className="gap-2"
            >
              {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              إرسال الإشعار
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}