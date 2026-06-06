import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Tags,
  Warehouse,
  Receipt,
  Users,
  Truck,
  BarChart3,
  Settings,
  UserCog,
  Boxes,
  History,
  ShoppingBag,
  Wallet,
  UsersRound,
  MapPin,
  Crown,
  Layers,
  Building2,
  Sparkles,
  PieChart,
  Trophy,
  Globe,
  Package2,
  Bell,
  Palette,
  Database,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { t } = useTranslation();
  const { state } = useSidebar();
  const { hasAnyRole, isDeveloper, moduleEnabled, screenAllowed } = useAuth();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));

  const showSupervisor =
    hasAnyRole(["admin", "manager", "supervisor"]) && moduleEnabled("supervisor");
  const showDeveloper = isDeveloper || hasAnyRole(["admin"]);

  type Item = { url: string; icon: typeof LayoutDashboard; title: string; module?: string; screen?: string };
  type Group = { label: string; items: Item[] };

  const groupsRaw: Group[] = [
    {
      label: t("nav.main"),
      items: [
        { url: "/dashboard", icon: LayoutDashboard, title: t("nav.dashboard") },
        { url: "/pos", icon: ShoppingCart, title: t("nav.pos"), module: "pos" },
      ],
    },
    ...(showDeveloper ? [{
      label: "المطور",
      items: [
        { url: "/developer", icon: Crown, title: "لوحة المطور" } as Item,
        ...(isDeveloper ? [
          { url: "/developer/tenants", icon: Building2, title: "الشركات" } as Item,
        ] : []),
        { url: "/developer/modules", icon: Layers, title: "المكونات" } as Item,
        ...(isDeveloper ? [
          { url: "/developer/audit", icon: History, title: "سجل العمليات" } as Item,
          { url: "/developer/branding", icon: Palette, title: "شاشة الدخول" } as Item,
          { url: "/developer/backup", icon: Database, title: "نسخ احتياطي" } as Item,
          { url: "/developer/pricing", icon: Crown, title: "أسعار اللاندينج" } as Item,
        ] : []),
      ],
    }] : []),
    ...(hasAnyRole(["admin","manager","supervisor","hr"]) ? [{
      label: "التواصل",
      items: [
        { url: "/notifications/send", icon: Bell, title: "إرسال إشعار" } as Item,
      ],
    }] : []),
    ...(showSupervisor ? [{
      label: t("nav.field"),
      items: [
        { url: "/supervisor", icon: MapPin, title: t("supervisor.title") },
      ],
    }] : []),
    {
      label: t("nav.operations"),
      items: [
        { url: "/sales", icon: Receipt, title: t("nav.sales"), module: "sales" },
        { url: "/purchases", icon: ShoppingBag, title: t("purchases.title"), module: "purchases" },
        { url: "/inventory", icon: Boxes, title: t("nav.inventory"), module: "inventory" },
        { url: "/movements", icon: History, title: t("movements.title"), module: "inventory" },
      ],
    },
    {
      label: t("nav.data"),
      items: [
        { url: "/products", icon: Package, title: t("nav.products") },
        { url: "/categories", icon: Tags, title: t("nav.categories") },
        { url: "/warehouses", icon: Warehouse, title: t("nav.warehouses"), module: "inventory" },
        { url: "/customers", icon: Users, title: t("nav.customers") },
        { url: "/suppliers", icon: Truck, title: t("nav.suppliers") },
      ],
    },
    {
      label: t("nav.finance"),
      items: [
        { url: "/finance", icon: Wallet, title: t("nav.financeHub"), module: "finance" },
        { url: "/hr", icon: UsersRound, title: t("nav.hr"), module: "hr" },
      ],
    },
    {
      label: t("nav.system"),
      items: [
        { url: "/reports", icon: BarChart3, title: t("nav.reports"), module: "reports" },
        { url: "/site-builder", icon: Globe, title: "بناء الموقع" },
        { url: "/online-orders", icon: Package2, title: "طلبات الموقع" },
        { url: "/dashboard/executive", icon: BarChart3, title: "داشبورد تنفيذي", module: "reports" },
        { url: "/dashboard/forecast", icon: Sparkles, title: "توقع AI", module: "reports" },
        { url: "/dashboard/profitability", icon: PieChart, title: "تحليل الربحية", module: "reports" },
        { url: "/dashboard/reps", icon: Trophy, title: "أداء المندوبين", module: "rep" },
        { url: "/users", icon: UserCog, title: t("nav.users") },
        ...(hasAnyRole(["admin", "manager"]) ? [{ url: "/permissions", icon: UserCog, title: "صلاحيات الموظفين" } as Item] : []),
        { url: "/settings", icon: Settings, title: t("nav.settings") },
      ],
    },
  ];

  // Filter by enabled modules
  const groups = groupsRaw
    .map((g) => ({
      ...g,
      items: g.items.filter((it) =>
        (!it.module || moduleEnabled(it.module)) && screenAllowed(it.url),
      ),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <Sidebar side="right" collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-5">
        <div className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-sidebar-primary-foreground font-bold shrink-0 shadow-md"
            style={{ background: "var(--gradient-brand)" }}
          >
            E
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-sidebar-foreground truncate tracking-tight">{t("app.name")}</span>
              <span className="text-[11px] text-sidebar-foreground/60 truncate">{t("app.tagline")}</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 px-3">
                {g.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                      className="h-10 rounded-xl data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-semibold data-[active=true]:shadow-sm transition-all"
                    >
                      <Link to={item.url} className="flex items-center gap-3">
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && <span className="text-sm">{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}