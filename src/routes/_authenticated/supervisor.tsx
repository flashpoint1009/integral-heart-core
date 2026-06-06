import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { MapPin, CalendarRange, BarChart3, LayoutDashboard, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/supervisor")({
  component: SupervisorLayout,
});

function SupervisorLayout() {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!roles.length) return;
    const allowed = roles.some((r) => ["supervisor", "admin", "manager"].includes(r));
    if (!allowed) navigate({ to: "/", replace: true });
  }, [roles, navigate]);

  const tabs = [
    { to: "/supervisor", icon: LayoutDashboard, label: t("supervisor.overview") },
    { to: "/supervisor/live", icon: MapPin, label: t("supervisor.liveMap") },
    { to: "/supervisor/routes", icon: CalendarRange, label: t("supervisor.routes") },
    { to: "/supervisor/requests", icon: FileText, label: "الطلبات" },
    { to: "/supervisor/reports", icon: BarChart3, label: t("supervisor.reports") },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold">{t("supervisor.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("supervisor.subtitle")}</p>
      </div>
      <nav className="flex flex-wrap gap-1 border-b">
        {tabs.map((tab) => {
          const active = tab.to === "/supervisor" ? pathname === "/supervisor" : pathname.startsWith(tab.to);
          return (
            <Link key={tab.to} to={tab.to} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <tab.icon className="h-4 w-4" />{tab.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}