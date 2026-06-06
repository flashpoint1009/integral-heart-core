import { createFileRoute, Outlet, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Home, MapPin, Users, ShoppingCart, Calendar, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/rep")({
  component: RepLayout,
});

function RepLayout() {
  const { t } = useTranslation();
  const { roles, signOut, user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!roles.length) return;
    const allowed = roles.some((r) => ["sales_rep", "admin", "manager", "supervisor"].includes(r));
    if (!allowed) navigate({ to: "/", replace: true });
  }, [roles, navigate]);

  const tabs = [
    { to: "/rep", icon: Home, label: t("rep.home") },
    { to: "/rep/plan", icon: Calendar, label: t("rep.routeToday") },
    { to: "/rep/customers", icon: Users, label: t("rep.customers") },
    { to: "/rep/sale", icon: ShoppingCart, label: t("rep.quickSale") },
    { to: "/rep/attendance", icon: MapPin, label: t("rep.attendance") },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/90 px-4 h-14 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-blue-500 text-white grid place-items-center font-bold text-sm shadow">R</div>
          <div className="leading-tight">
            <div className="text-sm font-bold">{t("rep.appName")}</div>
            <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">{user?.email}</div>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={async () => { await signOut(); navigate({ to: "/auth", replace: true }); }}>
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <main className="flex-1 overflow-auto pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-background border-t shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <ul className="grid grid-cols-5">
          {tabs.map((tab) => {
            const active = pathname === tab.to || (tab.to !== "/rep" && pathname.startsWith(tab.to));
            return (
              <li key={tab.to}>
                <Link
                  to={tab.to}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
                >
                  <tab.icon className={`h-5 w-5 ${active ? "scale-110" : ""} transition-transform`} />
                  <span>{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}