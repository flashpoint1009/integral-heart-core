import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role =
  | "admin"
  | "manager"
  | "cashier"
  | "accountant"
  | "sales_rep"
  | "supervisor"
  | "developer"
  | "sales_manager"
  | "warehouse"
  | "hr";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: Role[];
  tenantId: string | null;
  enabledModules: string[];
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (r: Role) => boolean;
  hasAnyRole: (rs: Role[]) => boolean;
  isDeveloper: boolean;
  moduleEnabled: (key: string) => boolean;
  screenAllowed: (key: string) => boolean;
  deniedScreens: string[];
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [deniedScreens, setDeniedScreens] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async (uid: string) => {
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role, tenant_id")
        .eq("user_id", uid);
      const rs = (rolesData ?? []).map((r) => r.role as Role);
      setRoles(rs);
      const tid = (rolesData ?? []).find((r) => r.tenant_id)?.tenant_id ?? null;
      setTenantId(tid);
      if (tid) {
        const { data: mods } = await supabase
          .from("tenant_modules")
          .select("module_key, enabled")
          .eq("tenant_id", tid);
        setEnabledModules(
          (mods ?? []).filter((m) => m.enabled).map((m) => m.module_key)
        );
      } else {
        setEnabledModules([]);
      }
      const { data: perms } = await supabase
        .from("user_screen_permissions")
        .select("screen_key, allowed")
        .eq("user_id", uid);
      setDeniedScreens((perms ?? []).filter((p) => !p.allowed).map((p) => p.screen_key));
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) setTimeout(() => fetchUserData(s.user.id), 0);
      else {
        setRoles([]);
        setTenantId(null);
        setEnabledModules([]);
        setDeniedScreens([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) fetchUserData(s.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthCtx = {
    user,
    session,
    roles,
    tenantId,
    enabledModules,
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    hasRole: (r) => roles.includes(r),
    hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
    isDeveloper: roles.includes("developer"),
    moduleEnabled: (key: string) =>
      roles.includes("developer") || enabledModules.length === 0 || enabledModules.includes(key),
    screenAllowed: (key: string) => roles.includes("developer") || !deniedScreens.includes(key),
    deniedScreens,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}