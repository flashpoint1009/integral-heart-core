import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ensurePushSubscription } from "@/lib/push-client";

type Status = "checking" | "needs-enable" | "denied" | "unsupported" | "granted";

export function EnableNotificationsGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    const p = Notification.permission;
    if (p === "granted") {
      setStatus("granted");
      void ensurePushSubscription();
    } else if (p === "denied") {
      setStatus("denied");
    } else {
      setStatus("needs-enable");
    }
  }, []);

  async function handleEnable() {
    setBusy(true);
    try {
      const r = await ensurePushSubscription();
      if (r === "granted") setStatus("granted");
      else if (r === "denied") setStatus("denied");
      else if (r === "unsupported") setStatus("unsupported");
      else setStatus("needs-enable");
    } finally {
      setBusy(false);
    }
  }

  if (status === "granted" || status === "unsupported") return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-2xl text-center space-y-5">
        <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
          {status === "denied" ? (
            <BellOff className="w-10 h-10 text-destructive" />
          ) : (
            <Bell className="w-10 h-10 text-primary" />
          )}
        </div>

        {status === "checking" && (
          <>
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">جارٍ التحقق...</p>
          </>
        )}

        {status === "needs-enable" && (
          <>
            <h2 className="text-2xl font-bold">تفعيل الإشعارات مطلوب</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              لاستخدام النظام يجب تفعيل الإشعارات لاستقبال الطلبات والتنبيهات المهمة
              (مثل الموافقات، تنبيهات المخزون، الفواتير المتأخرة) حتى لو كانت شاشة الهاتف مقفلة.
            </p>
            <Button onClick={handleEnable} disabled={busy} size="lg" className="w-full">
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Bell className="w-4 h-4 mr-2" />}
              السماح بالإشعارات
            </Button>
          </>
        )}

        {status === "denied" && (
          <>
            <ShieldAlert className="w-6 h-6 text-destructive mx-auto" />
            <h2 className="text-2xl font-bold">الإشعارات محظورة</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              قمت برفض الإشعارات سابقًا. لاستئناف العمل، يجب السماح بها يدويًا من إعدادات المتصفح:
            </p>
            <div className="text-right text-xs bg-muted rounded-lg p-3 space-y-1 leading-relaxed">
              <p>• اضغط على أيقونة القفل 🔒 بجوار شريط العنوان</p>
              <p>• اختر "إعدادات الموقع" أو "الأذونات"</p>
              <p>• فعّل "الإشعارات" (Notifications)</p>
              <p>• ثم أعد تحميل الصفحة</p>
            </div>
            <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
              إعادة المحاولة
            </Button>
          </>
        )}
      </div>
    </div>
  );
}