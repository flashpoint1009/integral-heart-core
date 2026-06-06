import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Users — ERP" }] }),
  component: Page,
});

const ALL_ROLES = ["admin", "manager", "cashier", "accountant"] as const;
type RoleName = (typeof ALL_ROLES)[number];

type Profile = { id: string; full_name: string | null; email: string | null };
type RoleRow = { user_id: string; role: RoleName };

function Page() {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const qc = useQueryClient();
  const [dlg, setDlg] = useState<{ userId: string; existing: RoleName[] } | null>(null);
  const [pick, setPick] = useState<RoleName>("cashier");

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["user_roles_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data as RoleRow[];
    },
  });

  const rolesByUser = new Map<string, RoleName[]>();
  for (const r of roles) {
    const arr = rolesByUser.get(r.user_id) ?? [];
    arr.push(r.role); rolesByUser.set(r.user_id, arr);
  }

  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: RoleName }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["user_roles_all"] }); toast.success(t("common.saved")); setDlg(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: RoleName }) => {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["user_roles_all"] }); toast.success(t("common.deleted")); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <PageHeader title={t("users.title")} description={t("users.description")} />
      {!isAdmin && <p className="text-sm text-muted-foreground">{t("users.onlyAdmin")}</p>}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("users.user")}</TableHead>
              <TableHead>{t("users.email")}</TableHead>
              <TableHead>{t("users.roles")}</TableHead>
              {isAdmin && <TableHead className="text-end">{t("common.actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.length === 0 ? (
              <TableRow><TableCell colSpan={isAdmin ? 4 : 3} className="text-center py-8 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
            ) : profiles.map((p) => {
              const ur = rolesByUser.get(p.id) ?? [];
              const initials = (p.full_name || p.email || "?").slice(0, 2).toUpperCase();
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{initials}</AvatarFallback></Avatar>
                      <span className="font-medium">{p.full_name ?? "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.email ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {ur.length === 0 && <span className="text-xs text-muted-foreground">{t("users.noRoles")}</span>}
                      {ur.map((r) => (
                        <Badge key={r} variant="secondary" className="gap-1">
                          {t(`roles.${r}`)}
                          {isAdmin && (
                            <button onClick={() => { if (confirm(t("common.deleteConfirm"))) removeRole.mutate({ userId: p.id, role: r }); }} className="hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-end">
                      <Button variant="outline" size="sm" onClick={() => { setDlg({ userId: p.id, existing: ur }); setPick("cashier"); }}>
                        <Plus className="me-1 h-3 w-3" />{t("users.addRole")}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("users.addRole")}</DialogTitle></DialogHeader>
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={pick} onChange={(e) => setPick(e.target.value as RoleName)}>
            {ALL_ROLES.filter((r) => !dlg?.existing.includes(r)).map((r) => (
              <option key={r} value={r}>{t(`roles.${r}`)}</option>
            ))}
          </select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)}>{t("common.cancel")}</Button>
            <Button onClick={() => dlg && addRole.mutate({ userId: dlg.userId, role: pick })} disabled={addRole.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}