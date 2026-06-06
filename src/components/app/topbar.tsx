import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "./language-toggle";
import { NotificationsBell } from "./notifications-bell";
import { InstallPwaButton } from "./install-pwa-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "@tanstack/react-router";

export function Topbar() {
  const { t } = useTranslation();
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();
  const roleLabel = roles[0] ? t(`roles.${roles[0]}`) : "";

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="rounded-lg" />
      <div className="relative hidden md:flex flex-1 max-w-md">
        <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("common.search")}
          className="ps-9 h-10 rounded-full bg-muted/60 border-transparent focus-visible:bg-background"
        />
      </div>
      <div className="flex-1 md:hidden" />
      <LanguageToggle />
      <InstallPwaButton compact />
      <NotificationsBell />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 px-2 rounded-full h-10">
            <Avatar className="h-8 w-8 ring-2 ring-background shadow-sm">
              <AvatarFallback className="text-xs font-semibold text-white" style={{ background: "var(--gradient-brand)" }}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:flex flex-col items-start leading-tight">
              <span className="text-xs font-semibold max-w-[140px] truncate">{user?.email}</span>
              {roleLabel && (
                <span className="text-[10px] text-muted-foreground capitalize">{roleLabel}</span>
              )}
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="me-2 h-4 w-4" />
            {t("auth.signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}