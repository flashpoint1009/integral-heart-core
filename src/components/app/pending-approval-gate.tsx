import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ShieldAlert, LogOut, RefreshCw } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export function PendingApprovalGate({ children }: { children: ReactNode }) {
  const { user, roles, loading, signOut } = useAuth();

  // Realtime: when admin grants a role, refresh the page automatically
  useEffect(() => {
    if (!user) return;
    if (roles.length > 0) return;
    const ch = supabase
      .channel(`user_roles_${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
        () => window.location.reload(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user, roles.length]);

  if (loading || !user) return <>{children}</>;
  if (roles.length > 0) return <>{children}</>;

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#070b1c] text-white p-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -start-40 h-[520px] w-[520px] rounded-full bg-indigo-500/30 blur-[140px]" />
        <div className="absolute bottom-[-160px] end-1/4 h-[520px] w-[520px] rounded-full bg-fuchsia-500/20 blur-[140px]" />
      </div>
      <div className="relative z-10 max-w-md w-full rounded-3xl border border-white/15 bg-white/[0.06] p-8 backdrop-blur-2xl shadow-2xl text-center space-y-5">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
          <ShieldAlert className="h-8 w-8 text-white" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">حسابك بانتظار التفعيل</h1>
          <p className="text-white/70 leading-relaxed text-sm">
            تم تسجيل دخولك بنجاح، وتم إبلاغ المدير لتحديد الصلاحيات المناسبة لك.
            ستتمكن من الوصول للنظام فور اعتماد حسابك.
          </p>
          <p className="text-xs text-white/50 pt-2">{user.email}</p>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={() => window.location.reload()}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-cyan-400 text-white border-0"
          >
            <RefreshCw className="me-2 h-4 w-4" /> تحديث الصفحة
          </Button>
          <Button
            variant="outline"
            onClick={() => signOut()}
            className="w-full h-11 rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
          >
            <LogOut className="me-2 h-4 w-4" /> تسجيل الخروج
          </Button>
        </div>
      </div>
    </div>
  );
}