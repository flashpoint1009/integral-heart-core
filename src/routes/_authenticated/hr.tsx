import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users, CalendarCheck, PlaneTakeoff, Wallet, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hr")({
  head: () => ({ meta: [{ title: "HR — ERP" }] }),
  component: Page,
});

const fmt = (n: number) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function StatCard({ label, value, icon: Icon, tint, color }: { label: string; value: string | number; icon: any; tint: string; color: string }) {
  return (
    <Card className={`bg-gradient-to-br ${tint} border-border/60`}>
      <CardContent className="pt-5 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
        </div>
        <div className={`h-10 w-10 rounded-xl bg-background/60 grid place-items-center ${color}`}><Icon className="h-5 w-5" /></div>
      </CardContent>
    </Card>
  );
}

function Page() {
  const { t } = useTranslation();
  return (
    <div className="p-6 space-y-4">
      <PageHeader title={t("hr.title")} description={t("hr.description")} />
      <Tabs defaultValue="employees">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="employees" className="gap-2"><Users className="h-4 w-4" />{t("hr.employees")}</TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2"><CalendarCheck className="h-4 w-4" />{t("hr.attendance")}</TabsTrigger>
          <TabsTrigger value="leaves" className="gap-2"><PlaneTakeoff className="h-4 w-4" />{t("hr.leaves")}</TabsTrigger>
          <TabsTrigger value="payroll" className="gap-2"><Wallet className="h-4 w-4" />{t("hr.payroll")}</TabsTrigger>
        </TabsList>
        <TabsContent value="employees" className="mt-4"><EmployeesTab /></TabsContent>
        <TabsContent value="attendance" className="mt-4"><AttendanceTab /></TabsContent>
        <TabsContent value="leaves" className="mt-4"><LeavesTab /></TabsContent>
        <TabsContent value="payroll" className="mt-4"><PayrollTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* -------- Employees -------- */
const empEmpty = { employee_code: "", full_name: "", email: "", phone: "", position: "", department: "", hire_date: "", base_salary: "0", allowances: "0" };

function EmployeesTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(empEmpty);

  const { data: rows = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await supabase.from("employees").select("*").order("full_name")).data ?? [],
  });

  const totalSalary = rows.reduce((s: number, r: any) => s + Number(r.base_salary || 0) + Number(r.allowances || 0), 0);
  const active = rows.filter((r: any) => r.is_active).length;

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        employee_code: form.employee_code || null,
        full_name: form.full_name.trim(), email: form.email || null, phone: form.phone || null,
        position: form.position || null, department: form.department || null,
        hire_date: form.hire_date || null,
        base_salary: Number(form.base_salary) || 0,
        allowances: Number(form.allowances) || 0,
      };
      if (editing) {
        const { error } = await supabase.from("employees").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employees").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["employees"] }); setOpen(false); setEditing(null); setForm(empEmpty); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => { setEditing(null); setForm(empEmpty); setOpen(true); };
  const openEdit = (r: any) => {
    setEditing(r);
    setForm({
      employee_code: r.employee_code ?? "", full_name: r.full_name, email: r.email ?? "", phone: r.phone ?? "",
      position: r.position ?? "", department: r.department ?? "",
      hire_date: r.hire_date ?? "", base_salary: String(r.base_salary ?? 0), allowances: String(r.allowances ?? 0),
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("hr.totalEmployees")} value={rows.length} icon={Users} tint="from-primary/10 to-primary/0" color="text-primary" />
        <StatCard label={t("common.active")} value={active} icon={CheckCircle2} tint="from-emerald-500/10 to-emerald-500/0" color="text-emerald-600" />
        <StatCard label={t("hr.totalSalary")} value={fmt(totalSalary)} icon={Wallet} tint="from-amber-500/10 to-amber-500/0" color="text-amber-600" />
      </div>
      <div className="flex justify-end">
        <Button onClick={openAdd}><Plus className="h-4 w-4 me-2" />{t("hr.addEmployee")}</Button>
      </div>
      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("hr.employee")}</TableHead>
            <TableHead>{t("hr.position")}</TableHead>
            <TableHead>{t("hr.department")}</TableHead>
            <TableHead>{t("hr.phone")}</TableHead>
            <TableHead className="text-end">{t("hr.baseSalary")}</TableHead>
            <TableHead className="text-end">{t("common.actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
            ) : rows.map((r: any) => {
              const initials = (r.full_name || "?").slice(0, 2);
              return (
                <TableRow key={r.id} className="hover:bg-muted/40">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8 ring-2 ring-primary/10"><AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-semibold">{initials}</AvatarFallback></Avatar>
                      <div>
                        <div className="font-semibold text-primary">{r.full_name}</div>
                        {r.employee_code && <div className="text-xs text-muted-foreground font-mono">{r.employee_code}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.position ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.department ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">{r.phone ?? "—"}</TableCell>
                  <TableCell className="text-end tabular-nums font-semibold">{fmt(Number(r.base_salary))}</TableCell>
                  <TableCell className="text-end">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>{t("common.edit")}</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? t("hr.editEmployee") : t("hr.addEmployee")}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>{t("hr.fullName")} *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><Label>{t("hr.employeeCode")}</Label><Input value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} /></div>
            <div><Label>{t("hr.hireDate")}</Label><Input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></div>
            <div><Label>{t("hr.position")}</Label><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
            <div><Label>{t("hr.department")}</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
            <div><Label>{t("hr.email")}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>{t("hr.phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>{t("hr.baseSalary")}</Label><Input type="number" step="0.01" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} /></div>
            <div><Label>{t("hr.allowances")}</Label><Input type="number" step="0.01" value={form.allowances} onChange={(e) => setForm({ ...form, allowances: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => save.mutate()} disabled={!form.full_name.trim() || save.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------- Attendance -------- */
function AttendanceTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: async () => (await supabase.from("employees").select("id,full_name,employee_code").eq("is_active", true).order("full_name")).data ?? [] });
  const { data: rows = [] } = useQuery({
    queryKey: ["attendance", date],
    queryFn: async () => (await supabase.from("attendance").select("*").eq("date", date)).data ?? [],
  });

  const recMap = new Map((rows as any[]).map((r) => [r.employee_id, r]));

  const upsert = useMutation({
    mutationFn: async ({ employee_id, status }: { employee_id: string; status: string }) => {
      const { error } = await supabase.from("attendance").upsert(
        { employee_id, date, status, check_in: status === "present" ? new Date(`${date}T09:00:00`).toISOString() : null, check_out: status === "present" ? new Date(`${date}T17:00:00`).toISOString() : null, hours: status === "present" ? 8 : 0 },
        { onConflict: "employee_id,date" },
      );
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance", date] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const present = (employees as any[]).filter((e) => recMap.get(e.id)?.status === "present").length;
  const absent = (employees as any[]).filter((e) => recMap.get(e.id)?.status === "absent").length;
  const noRec = (employees as any[]).length - present - absent - (employees as any[]).filter((e) => recMap.get(e.id)?.status === "leave").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label={t("hr.present")} value={present} icon={CheckCircle2} tint="from-emerald-500/10 to-emerald-500/0" color="text-emerald-600" />
        <StatCard label={t("hr.absent")} value={absent} icon={XCircle} tint="from-rose-500/10 to-rose-500/0" color="text-rose-600" />
        <StatCard label={t("hr.noRecord")} value={noRec} icon={Clock} tint="from-amber-500/10 to-amber-500/0" color="text-amber-600" />
        <StatCard label={t("hr.totalEmployees")} value={(employees as any[]).length} icon={Users} tint="from-primary/10 to-primary/0" color="text-primary" />
      </div>
      <div className="flex items-end gap-3">
        <div className="grid gap-1.5"><Label>{t("hr.date")}</Label><Input type="date" className="rounded-full" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("hr.employee")}</TableHead>
            <TableHead>{t("hr.status")}</TableHead>
            <TableHead className="text-end">{t("common.actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(employees as any[]).length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
            ) : (employees as any[]).map((e: any) => {
              const rec = recMap.get(e.id);
              const initials = (e.full_name || "?").slice(0, 2);
              const status = rec?.status;
              return (
                <TableRow key={e.id} className="hover:bg-muted/40">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8 ring-2 ring-primary/10"><AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-semibold">{initials}</AvatarFallback></Avatar>
                      <span className="font-semibold text-primary">{e.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {status === "present" ? <Badge className="rounded-full bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20">{t("hr.present")}</Badge>
                      : status === "absent" ? <Badge variant="destructive" className="rounded-full">{t("hr.absent")}</Badge>
                      : <Badge variant="outline" className="rounded-full">{t("hr.noRecord")}</Badge>}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant={status === "present" ? "default" : "outline"} onClick={() => upsert.mutate({ employee_id: e.id, status: "present" })}>{t("hr.markPresent")}</Button>
                      <Button size="sm" variant={status === "absent" ? "destructive" : "outline"} onClick={() => upsert.mutate({ employee_id: e.id, status: "absent" })}>{t("hr.markAbsent")}</Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* -------- Leaves -------- */
function LeavesTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", leave_type: "annual", from_date: "", to_date: "", reason: "" });

  const { data: rows = [] } = useQuery({
    queryKey: ["leaves"],
    queryFn: async () => (await supabase.from("leave_requests").select("*, employees(full_name)").order("from_date", { ascending: false })).data ?? [],
  });
  const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: async () => (await supabase.from("employees").select("id,full_name").eq("is_active", true).order("full_name")).data ?? [] });

  const pending = (rows as any[]).filter((r) => r.status === "pending").length;
  const approved = (rows as any[]).filter((r) => r.status === "approved").length;

  const save = useMutation({
    mutationFn: async () => {
      if (!form.employee_id || !form.from_date || !form.to_date) throw new Error("invalid");
      const days = Math.max(1, Math.ceil((new Date(form.to_date).getTime() - new Date(form.from_date).getTime()) / 86400000) + 1);
      const { error } = await supabase.from("leave_requests").insert({
        employee_id: form.employee_id, leave_type: form.leave_type as any,
        from_date: form.from_date, to_date: form.to_date, days, reason: form.reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["leaves"] }); setOpen(false); setForm({ employee_id: "", leave_type: "annual", from_date: "", to_date: "", reason: "" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("leave_requests").update({ status, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leaves"] }),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("hr.pending")} value={pending} icon={Clock} tint="from-amber-500/10 to-amber-500/0" color="text-amber-600" />
        <StatCard label={t("hr.approved")} value={approved} icon={CheckCircle2} tint="from-emerald-500/10 to-emerald-500/0" color="text-emerald-600" />
        <StatCard label={t("hr.totalRequests")} value={(rows as any[]).length} icon={PlaneTakeoff} tint="from-primary/10 to-primary/0" color="text-primary" />
      </div>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 me-2" />{t("hr.addLeave")}</Button>
      </div>
      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("hr.employee")}</TableHead>
            <TableHead>{t("hr.leaveType")}</TableHead>
            <TableHead>{t("hr.from")}</TableHead>
            <TableHead>{t("hr.to")}</TableHead>
            <TableHead className="text-end">{t("hr.days")}</TableHead>
            <TableHead>{t("hr.status")}</TableHead>
            <TableHead className="text-end">{t("common.actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(rows as any[]).length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
            ) : (rows as any[]).map((r: any) => (
              <TableRow key={r.id} className="hover:bg-muted/40">
                <TableCell className="font-semibold text-primary">{r.employees?.full_name}</TableCell>
                <TableCell><Badge variant="outline" className="rounded-full">{t(`hr.leaveTypes.${r.leave_type}`)}</Badge></TableCell>
                <TableCell className="text-muted-foreground text-sm">{r.from_date}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{r.to_date}</TableCell>
                <TableCell className="text-end tabular-nums">{r.days}</TableCell>
                <TableCell>
                  {r.status === "approved" ? <Badge className="rounded-full bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20">{t("hr.approved")}</Badge>
                    : r.status === "rejected" ? <Badge variant="destructive" className="rounded-full">{t("hr.rejected")}</Badge>
                    : <Badge variant="outline" className="rounded-full">{t("hr.pending")}</Badge>}
                </TableCell>
                <TableCell className="text-end">
                  {r.status === "pending" && (
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: r.id, status: "approved" })}>{t("hr.approve")}</Button>
                      <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: r.id, status: "rejected" })}>{t("hr.reject")}</Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("hr.addLeave")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("hr.employee")}</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(employees as any[]).map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("hr.leaveType")}</Label>
              <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">{t("hr.leaveTypes.annual")}</SelectItem>
                  <SelectItem value="sick">{t("hr.leaveTypes.sick")}</SelectItem>
                  <SelectItem value="unpaid">{t("hr.leaveTypes.unpaid")}</SelectItem>
                  <SelectItem value="other">{t("hr.leaveTypes.other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("hr.from")}</Label><Input type="date" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} /></div>
              <div><Label>{t("hr.to")}</Label><Input type="date" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} /></div>
            </div>
            <div><Label>{t("hr.reason")}</Label><Textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------- Payroll -------- */
function PayrollTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [period, setPeriod] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });

  const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: async () => (await supabase.from("employees").select("id,full_name,base_salary,allowances").eq("is_active", true).order("full_name")).data ?? [] });
  const { data: runs = [] } = useQuery({ queryKey: ["payroll_runs"], queryFn: async () => (await supabase.from("payroll_runs").select("*").order("period_month", { ascending: false })).data ?? [] });
  const currentRun = (runs as any[]).find((r) => r.period_month === period) ?? null;
  const { data: items = [] } = useQuery({
    queryKey: ["payroll_items", currentRun?.id],
    queryFn: async () => currentRun ? ((await supabase.from("payroll_items").select("*, employees(full_name)").eq("run_id", currentRun.id)).data ?? []) : [],
    enabled: !!currentRun,
  });

  const totalNet = (items as any[]).reduce((s, i) => s + Number(i.net_salary || 0), 0);

  const generate = useMutation({
    mutationFn: async () => {
      const { data: run, error: runErr } = await supabase.from("payroll_runs").insert({
        period_month: period, status: "draft", created_by: user?.id ?? null, total_net: 0,
      }).select().single();
      if (runErr) throw runErr;
      const lines = (employees as any[]).map((e) => {
        const base = Number(e.base_salary || 0);
        const allow = Number(e.allowances || 0);
        return { run_id: run.id, employee_id: e.id, base_salary: base, allowances: allow, bonuses: 0, deductions: 0, net_salary: base + allow };
      });
      if (lines.length > 0) {
        const { error: liErr } = await supabase.from("payroll_items").insert(lines);
        if (liErr) throw liErr;
      }
      const total = lines.reduce((s, l) => s + l.net_salary, 0);
      await supabase.from("payroll_runs").update({ total_net: total }).eq("id", run.id);
    },
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["payroll_runs"] }); qc.invalidateQueries({ queryKey: ["payroll_items"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("hr.period")} value={period.slice(0, 7)} icon={CalendarCheck} tint="from-primary/10 to-primary/0" color="text-primary" />
        <StatCard label={t("hr.employeesCount")} value={(items as any[]).length} icon={Users} tint="from-violet-500/10 to-violet-500/0" color="text-violet-600" />
        <StatCard label={t("hr.totalNet")} value={fmt(totalNet)} icon={Wallet} tint="from-emerald-500/10 to-emerald-500/0" color="text-emerald-600" />
      </div>
      <div className="flex items-end gap-3">
        <div className="grid gap-1.5"><Label>{t("hr.period")}</Label><Input type="month" className="rounded-full" value={period.slice(0, 7)} onChange={(e) => setPeriod(e.target.value + "-01")} /></div>
        {!currentRun && <Button onClick={() => generate.mutate()} disabled={generate.isPending}><Plus className="h-4 w-4 me-2" />{t("hr.generatePayroll")}</Button>}
        {currentRun && <Badge variant="outline" className="rounded-full">{t(`hr.runStatus.${currentRun.status}`)}</Badge>}
      </div>
      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("hr.employee")}</TableHead>
            <TableHead className="text-end">{t("hr.baseSalary")}</TableHead>
            <TableHead className="text-end">{t("hr.allowances")}</TableHead>
            <TableHead className="text-end">{t("hr.bonuses")}</TableHead>
            <TableHead className="text-end">{t("hr.deductions")}</TableHead>
            <TableHead className="text-end">{t("hr.net")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(items as any[]).length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{currentRun ? t("common.empty") : t("hr.noPayrollYet")}</TableCell></TableRow>
            ) : (items as any[]).map((it: any) => (
              <TableRow key={it.id} className="hover:bg-muted/40">
                <TableCell className="font-semibold text-primary">{it.employees?.full_name}</TableCell>
                <TableCell className="text-end tabular-nums">{fmt(Number(it.base_salary))}</TableCell>
                <TableCell className="text-end tabular-nums">{fmt(Number(it.allowances))}</TableCell>
                <TableCell className="text-end tabular-nums">{fmt(Number(it.bonuses))}</TableCell>
                <TableCell className="text-end tabular-nums text-rose-600">{fmt(Number(it.deductions))}</TableCell>
                <TableCell className="text-end tabular-nums font-bold text-emerald-600">{fmt(Number(it.net_salary))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}