import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState, useMemo } from "react";
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
import { Plus, Users, CalendarCheck, PlaneTakeoff, Wallet, CheckCircle2, XCircle, Clock, AlertOctagon, HandCoins, Zap, Calculator, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hr")({
  head: () => ({ meta: [{ title: "HR — ERP" }] }),
  component: Page,
});

const fmt = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthRange = (yyyymm: string) => {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), days: end.getUTCDate() };
};

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
          <TabsTrigger value="penalties" className="gap-2"><AlertOctagon className="h-4 w-4" />{t("hr.penalties")}</TabsTrigger>
          <TabsTrigger value="advances" className="gap-2"><HandCoins className="h-4 w-4" />{t("hr.advances")}</TabsTrigger>
          <TabsTrigger value="payroll" className="gap-2"><Wallet className="h-4 w-4" />{t("hr.payroll")}</TabsTrigger>
        </TabsList>
        <TabsContent value="employees" className="mt-4"><EmployeesTab /></TabsContent>
        <TabsContent value="attendance" className="mt-4"><AttendanceTab /></TabsContent>
        <TabsContent value="leaves" className="mt-4"><LeavesTab /></TabsContent>
        <TabsContent value="penalties" className="mt-4"><PenaltiesTab /></TabsContent>
        <TabsContent value="advances" className="mt-4"><AdvancesTab /></TabsContent>
        <TabsContent value="payroll" className="mt-4"><PayrollTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* -------- Employees -------- */
const empEmpty = {
  employee_code: "", full_name: "", email: "", phone: "", position: "", department: "", hire_date: "",
  base_salary: "0", allowances: "0", transport_allowance: "0",
  insurance_employee_pct: "11", insurance_employer_pct: "18.75",
  annual_leave_balance: "21", casual_leave_balance: "6", sick_leave_balance: "90",
};

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

  const totalSalary = rows.reduce((s: number, r: any) => s + Number(r.base_salary || 0) + Number(r.allowances || 0) + Number(r.transport_allowance || 0), 0);
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
        transport_allowance: Number(form.transport_allowance) || 0,
        insurance_employee_pct: Number(form.insurance_employee_pct) || 0,
        insurance_employer_pct: Number(form.insurance_employer_pct) || 0,
        annual_leave_balance: Number(form.annual_leave_balance) || 0,
        casual_leave_balance: Number(form.casual_leave_balance) || 0,
        sick_leave_balance: Number(form.sick_leave_balance) || 0,
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
      hire_date: r.hire_date ?? "",
      base_salary: String(r.base_salary ?? 0), allowances: String(r.allowances ?? 0),
      transport_allowance: String(r.transport_allowance ?? 0),
      insurance_employee_pct: String(r.insurance_employee_pct ?? 11),
      insurance_employer_pct: String(r.insurance_employer_pct ?? 18.75),
      annual_leave_balance: String(r.annual_leave_balance ?? 21),
      casual_leave_balance: String(r.casual_leave_balance ?? 6),
      sick_leave_balance: String(r.sick_leave_balance ?? 90),
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
            <TableHead>{t("hr.department")}</TableHead>
            <TableHead className="text-end">{t("hr.baseSalary")}</TableHead>
            <TableHead className="text-center" title={t("hr.annualBalance")}>{t("hr.annualBalance")}</TableHead>
            <TableHead className="text-center" title={t("hr.casualBalance")}>{t("hr.casualBalance")}</TableHead>
            <TableHead className="text-center" title={t("hr.sickBalance")}>{t("hr.sickBalance")}</TableHead>
            <TableHead className="text-end">{t("common.actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
            ) : rows.map((r: any) => {
              const initials = (r.full_name || "?").slice(0, 2);
              return (
                <TableRow key={r.id} className="hover:bg-muted/40">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8 ring-2 ring-primary/10"><AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-semibold">{initials}</AvatarFallback></Avatar>
                      <div>
                        <div className="font-semibold text-primary">{r.full_name}</div>
                        {r.position && <div className="text-xs text-muted-foreground">{r.position}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.department ?? "—"}</TableCell>
                  <TableCell className="text-end tabular-nums font-semibold">{fmt(Number(r.base_salary))}</TableCell>
                  <TableCell className="text-center tabular-nums"><Badge variant="outline" className="rounded-full">{Number(r.annual_leave_balance ?? 0)}</Badge></TableCell>
                  <TableCell className="text-center tabular-nums"><Badge variant="outline" className="rounded-full">{Number(r.casual_leave_balance ?? 0)}</Badge></TableCell>
                  <TableCell className="text-center tabular-nums"><Badge variant="outline" className="rounded-full">{Number(r.sick_leave_balance ?? 0)}</Badge></TableCell>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? t("hr.editEmployee") : t("hr.addEmployee")}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>{t("hr.fullName")} *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><Label>{t("hr.employeeCode")}</Label><Input value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} /></div>
            <div><Label>{t("hr.hireDate")}</Label><Input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></div>
            <div><Label>{t("hr.position")}</Label><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
            <div><Label>{t("hr.department")}</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
            <div><Label>{t("hr.email")}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>{t("hr.phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>

            <div className="col-span-2 mt-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("hr.baseSalary")} & {t("hr.allowances")}</div>
            <div><Label>{t("hr.baseSalary")}</Label><Input type="number" step="0.01" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} /></div>
            <div><Label>{t("hr.allowances")}</Label><Input type="number" step="0.01" value={form.allowances} onChange={(e) => setForm({ ...form, allowances: e.target.value })} /></div>
            <div><Label>{t("hr.transportAllowance")}</Label><Input type="number" step="0.01" value={form.transport_allowance} onChange={(e) => setForm({ ...form, transport_allowance: e.target.value })} /></div>
            <div><Label>{t("hr.insuranceEmployeePct")}</Label><Input type="number" step="0.01" value={form.insurance_employee_pct} onChange={(e) => setForm({ ...form, insurance_employee_pct: e.target.value })} /></div>

            <div className="col-span-2 mt-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("hr.balances")}</div>
            <div><Label>{t("hr.annualBalance")}</Label><Input type="number" step="0.5" value={form.annual_leave_balance} onChange={(e) => setForm({ ...form, annual_leave_balance: e.target.value })} /></div>
            <div><Label>{t("hr.casualBalance")}</Label><Input type="number" step="0.5" value={form.casual_leave_balance} onChange={(e) => setForm({ ...form, casual_leave_balance: e.target.value })} /></div>
            <div><Label>{t("hr.sickBalance")}</Label><Input type="number" step="0.5" value={form.sick_leave_balance} onChange={(e) => setForm({ ...form, sick_leave_balance: e.target.value })} /></div>
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

  const autoAbsent = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("mark_auto_absent", { p_date: date });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => { toast.success(t("hr.autoAbsentDone", { n })); qc.invalidateQueries({ queryKey: ["attendance", date] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const present = (employees as any[]).filter((e) => recMap.get(e.id)?.status === "present").length;
  const absent = (employees as any[]).filter((e) => recMap.get(e.id)?.status === "absent").length;
  const onLeave = (employees as any[]).filter((e) => recMap.get(e.id)?.status === "leave").length;
  const noRec = (employees as any[]).length - present - absent - onLeave;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label={t("hr.present")} value={present} icon={CheckCircle2} tint="from-emerald-500/10 to-emerald-500/0" color="text-emerald-600" />
        <StatCard label={t("hr.absent")} value={absent} icon={XCircle} tint="from-rose-500/10 to-rose-500/0" color="text-rose-600" />
        <StatCard label={t("hr.leaves")} value={onLeave} icon={PlaneTakeoff} tint="from-sky-500/10 to-sky-500/0" color="text-sky-600" />
        <StatCard label={t("hr.noRecord")} value={noRec} icon={Clock} tint="from-amber-500/10 to-amber-500/0" color="text-amber-600" />
      </div>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="grid gap-1.5"><Label>{t("hr.date")}</Label><Input type="date" className="rounded-full" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <Button variant="outline" onClick={() => autoAbsent.mutate()} disabled={autoAbsent.isPending} className="gap-2"><Zap className="h-4 w-4" />{t("hr.runAutoAbsent")}</Button>
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
                      : status === "leave" ? <Badge className="rounded-full bg-sky-500/15 text-sky-700 hover:bg-sky-500/20">{t("hr.leaves")}</Badge>
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
  const [form, setForm] = useState({ employee_id: "", leave_type: "casual", from_date: "", to_date: "", reason: "" });

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
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["leaves"] }); qc.invalidateQueries({ queryKey: ["employees"] }); setOpen(false); setForm({ employee_id: "", leave_type: "casual", from_date: "", to_date: "", reason: "" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("leave_requests").update({ status, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leaves"] }); qc.invalidateQueries({ queryKey: ["employees"] }); qc.invalidateQueries({ queryKey: ["attendance"] }); },
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
                  <SelectItem value="casual">{t("hr.leaveTypes.casual")}</SelectItem>
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

/* -------- Penalties -------- */
function PenaltiesTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", date: new Date().toISOString().slice(0, 10), amount: "0", reason: "" });

  const { data: rows = [] } = useQuery({
    queryKey: ["penalties"],
    queryFn: async () => (await supabase.from("penalties").select("*, employees(full_name)").order("date", { ascending: false })).data ?? [],
  });
  const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: async () => (await supabase.from("employees").select("id,full_name").eq("is_active", true).order("full_name")).data ?? [] });

  const total = (rows as any[]).reduce((s, r) => s + Number(r.amount || 0), 0);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.employee_id || !form.reason.trim()) throw new Error(t("hr.reasonRequired"));
      const { error } = await supabase.from("penalties").insert({ employee_id: form.employee_id, date: form.date, amount: Number(form.amount), reason: form.reason.trim() });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["penalties"] }); setOpen(false); setForm({ employee_id: "", date: new Date().toISOString().slice(0, 10), amount: "0", reason: "" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("penalties").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["penalties"] }),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label={t("hr.totalRequests")} value={(rows as any[]).length} icon={AlertOctagon} tint="from-rose-500/10 to-rose-500/0" color="text-rose-600" />
        <StatCard label={t("hr.penaltiesTotal")} value={fmt(total)} icon={Wallet} tint="from-amber-500/10 to-amber-500/0" color="text-amber-600" />
      </div>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 me-2" />{t("hr.addPenalty")}</Button>
      </div>
      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("hr.employee")}</TableHead>
            <TableHead>{t("hr.date")}</TableHead>
            <TableHead className="text-end">{t("hr.amount")}</TableHead>
            <TableHead>{t("hr.reason")}</TableHead>
            <TableHead className="text-end">{t("common.actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(rows as any[]).length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
            ) : (rows as any[]).map((r: any) => (
              <TableRow key={r.id} className="hover:bg-muted/40">
                <TableCell className="font-semibold text-primary">{r.employees?.full_name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{r.date}</TableCell>
                <TableCell className="text-end tabular-nums font-semibold text-rose-600">{fmt(Number(r.amount))}</TableCell>
                <TableCell className="text-sm">{r.reason}</TableCell>
                <TableCell className="text-end">
                  <Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("hr.addPenalty")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("hr.employee")} *</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(employees as any[]).map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("hr.date")}</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label>{t("hr.amount")} *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            </div>
            <div><Label>{t("hr.reason")} *</Label><Textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={t("hr.reasonRequired")} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.reason.trim() || !form.employee_id || Number(form.amount) <= 0}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------- Advances -------- */
function AdvancesTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", amount: "0", installments: "1", reason: "" });

  const { data: rows = [] } = useQuery({
    queryKey: ["advances"],
    queryFn: async () => (await supabase.from("salary_advances").select("*, employees(full_name)").order("request_date", { ascending: false })).data ?? [],
  });
  const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: async () => (await supabase.from("employees").select("id,full_name").eq("is_active", true).order("full_name")).data ?? [] });

  const totalRemaining = (rows as any[]).filter((r) => r.status === "approved").reduce((s, r) => s + Number(r.remaining || 0), 0);

  const save = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount);
      const inst = Math.max(1, Number(form.installments));
      const monthly = +(amount / inst).toFixed(2);
      const { error } = await supabase.from("salary_advances").insert({
        employee_id: form.employee_id, amount, installments: inst,
        monthly_deduction: monthly, remaining: amount, reason: form.reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["advances"] }); setOpen(false); setForm({ employee_id: "", amount: "0", installments: "1", reason: "" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("salary_advances").update({ status, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advances"] }),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label={t("hr.totalRequests")} value={(rows as any[]).length} icon={HandCoins} tint="from-violet-500/10 to-violet-500/0" color="text-violet-600" />
        <StatCard label={t("hr.remaining")} value={fmt(totalRemaining)} icon={Wallet} tint="from-amber-500/10 to-amber-500/0" color="text-amber-600" />
      </div>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 me-2" />{t("hr.addAdvance")}</Button>
      </div>
      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("hr.employee")}</TableHead>
            <TableHead>{t("hr.date")}</TableHead>
            <TableHead className="text-end">{t("hr.amount")}</TableHead>
            <TableHead className="text-end">{t("hr.installments")}</TableHead>
            <TableHead className="text-end">{t("hr.monthlyDeduction")}</TableHead>
            <TableHead className="text-end">{t("hr.remaining")}</TableHead>
            <TableHead>{t("hr.status")}</TableHead>
            <TableHead className="text-end">{t("common.actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(rows as any[]).length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("common.empty")}</TableCell></TableRow>
            ) : (rows as any[]).map((r: any) => (
              <TableRow key={r.id} className="hover:bg-muted/40">
                <TableCell className="font-semibold text-primary">{r.employees?.full_name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{r.request_date}</TableCell>
                <TableCell className="text-end tabular-nums font-semibold">{fmt(Number(r.amount))}</TableCell>
                <TableCell className="text-end tabular-nums">{r.installments}</TableCell>
                <TableCell className="text-end tabular-nums">{fmt(Number(r.monthly_deduction))}</TableCell>
                <TableCell className="text-end tabular-nums text-amber-700">{fmt(Number(r.remaining))}</TableCell>
                <TableCell>
                  {r.status === "approved" ? <Badge className="rounded-full bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20">{t("hr.approved")}</Badge>
                    : r.status === "rejected" ? <Badge variant="destructive" className="rounded-full">{t("hr.rejected")}</Badge>
                    : r.status === "paid_off" ? <Badge variant="outline" className="rounded-full">{t("hr.runStatus.paid")}</Badge>
                    : <Badge variant="outline" className="rounded-full">{t("hr.pending")}</Badge>}
                </TableCell>
                <TableCell className="text-end">
                  {r.status === "pending" && (
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: r.id, status: "approved" })}>{t("hr.approveAdvance")}</Button>
                      <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: r.id, status: "rejected" })}>{t("hr.rejectAdvance")}</Button>
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
          <DialogHeader><DialogTitle>{t("hr.addAdvance")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("hr.employee")} *</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(employees as any[]).map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("hr.amount")} *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>{t("hr.installments")} *</Label><Input type="number" min="1" value={form.installments} onChange={(e) => setForm({ ...form, installments: e.target.value })} /></div>
            </div>
            <div><Label>{t("hr.reason")}</Label><Textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.employee_id || Number(form.amount) <= 0}>{t("common.save")}</Button>
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
  const [period, setPeriod] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 7); });

  const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: async () => (await supabase.from("employees").select("*").eq("is_active", true).order("full_name")).data ?? [] });
  const { data: runs = [] } = useQuery({ queryKey: ["payroll_runs"], queryFn: async () => (await supabase.from("payroll_runs").select("*").order("period_month", { ascending: false })).data ?? [] });
  const periodDate = period + "-01";
  const currentRun = (runs as any[]).find((r) => r.period_month === periodDate) ?? null;
  const { data: items = [] } = useQuery({
    queryKey: ["payroll_items", currentRun?.id],
    queryFn: async () => currentRun ? ((await supabase.from("payroll_items").select("*, employees(full_name)").eq("run_id", currentRun.id)).data ?? []) : [],
    enabled: !!currentRun,
  });

  const totals = useMemo(() => {
    const t = { net: 0, deductions: 0, insurance: 0, penalties: 0, absence: 0, advances: 0 };
    for (const it of items as any[]) {
      t.net += Number(it.net_salary || 0);
      t.deductions += Number(it.deductions || 0);
      t.insurance += Number(it.insurance || 0);
      t.penalties += Number(it.penalties_total || 0);
      t.absence += Number(it.absence_deduction || 0);
      t.advances += Number(it.advance_deduction || 0);
    }
    return t;
  }, [items]);

  const generate = useMutation({
    mutationFn: async () => {
      const { start, end, days: daysInMonth } = monthRange(period);

      // Fetch period-scoped data once for all employees
      const [attRes, penRes, advRes] = await Promise.all([
        supabase.from("attendance").select("employee_id,status").gte("date", start).lte("date", end).eq("status", "absent"),
        supabase.from("penalties").select("employee_id,amount").gte("date", start).lte("date", end),
        supabase.from("salary_advances").select("id,employee_id,monthly_deduction,remaining").eq("status", "approved").gt("remaining", 0),
      ]);
      if (attRes.error) throw attRes.error;
      if (penRes.error) throw penRes.error;
      if (advRes.error) throw advRes.error;

      const absMap = new Map<string, number>();
      for (const r of attRes.data ?? []) absMap.set(r.employee_id, (absMap.get(r.employee_id) ?? 0) + 1);
      const penMap = new Map<string, number>();
      for (const r of penRes.data ?? []) penMap.set(r.employee_id, (penMap.get(r.employee_id) ?? 0) + Number(r.amount || 0));
      const advByEmp = new Map<string, any[]>();
      for (const r of advRes.data ?? []) {
        const arr = advByEmp.get(r.employee_id) ?? [];
        arr.push(r);
        advByEmp.set(r.employee_id, arr);
      }

      const { data: run, error: runErr } = await supabase.from("payroll_runs").insert({
        period_month: periodDate, status: "draft", created_by: user?.id ?? null, total_net: 0,
      }).select().single();
      if (runErr) throw runErr;

      const lines: any[] = [];
      const advanceUpdates: { id: string; remaining: number; status: string }[] = [];

      for (const e of employees as any[]) {
        const base = Number(e.base_salary || 0);
        const allow = Number(e.allowances || 0);
        const transport = Number(e.transport_allowance || 0);
        const dailyRate = base / daysInMonth;
        const absDays = absMap.get(e.id) ?? 0;
        const absDed = +(absDays * dailyRate).toFixed(2);
        const penTotal = +(penMap.get(e.id) ?? 0).toFixed(2);
        const insurance = +(base * Number(e.insurance_employee_pct || 0) / 100).toFixed(2);
        let advDed = 0;
        for (const adv of advByEmp.get(e.id) ?? []) {
          const take = Math.min(Number(adv.monthly_deduction), Number(adv.remaining));
          advDed += take;
          const newRem = +(Number(adv.remaining) - take).toFixed(2);
          advanceUpdates.push({ id: adv.id, remaining: newRem, status: newRem <= 0 ? "paid_off" : "approved" });
        }
        advDed = +advDed.toFixed(2);
        const deductions = +(insurance + penTotal + absDed + advDed).toFixed(2);
        const net = +(base + allow + transport - deductions).toFixed(2);
        lines.push({
          run_id: run.id, employee_id: e.id,
          base_salary: base, allowances: allow, transport_allowance: transport,
          bonuses: 0, incentives: 0,
          insurance, penalties_total: penTotal,
          absence_days: absDays, absence_deduction: absDed,
          advance_deduction: advDed,
          deductions, net_salary: net,
        });
      }

      if (lines.length > 0) {
        const { error: liErr } = await supabase.from("payroll_items").insert(lines);
        if (liErr) throw liErr;
      }
      // Update advances remaining
      for (const u of advanceUpdates) {
        await supabase.from("salary_advances").update({ remaining: u.remaining, status: u.status }).eq("id", u.id);
      }
      const total = lines.reduce((s, l) => s + l.net_salary, 0);
      await supabase.from("payroll_runs").update({ total_net: total }).eq("id", run.id);
    },
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["payroll_runs"] }); qc.invalidateQueries({ queryKey: ["payroll_items"] }); qc.invalidateQueries({ queryKey: ["advances"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!currentRun) return;
      const { error } = await supabase.from("payroll_runs").delete().eq("id", currentRun.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll_runs"] }); qc.invalidateQueries({ queryKey: ["payroll_items"] }); toast.success(t("common.deleted")); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label={t("hr.period")} value={period} icon={CalendarCheck} tint="from-primary/10 to-primary/0" color="text-primary" />
        <StatCard label={t("hr.employeesCount")} value={(items as any[]).length} icon={Users} tint="from-violet-500/10 to-violet-500/0" color="text-violet-600" />
        <StatCard label={t("hr.totalDeductions")} value={fmt(totals.deductions)} icon={Calculator} tint="from-rose-500/10 to-rose-500/0" color="text-rose-600" />
        <StatCard label={t("hr.totalNet")} value={fmt(totals.net)} icon={Wallet} tint="from-emerald-500/10 to-emerald-500/0" color="text-emerald-600" />
      </div>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="grid gap-1.5"><Label>{t("hr.period")}</Label><Input type="month" className="rounded-full" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
        {!currentRun && <Button onClick={() => generate.mutate()} disabled={generate.isPending}><Calculator className="h-4 w-4 me-2" />{t("hr.generatePayroll")}</Button>}
        {currentRun && <>
          <Badge variant="outline" className="rounded-full">{t(`hr.runStatus.${currentRun.status}`)}</Badge>
          <Button variant="ghost" size="sm" onClick={() => del.mutate()} className="text-rose-600"><Trash2 className="h-4 w-4 me-1" />{t("hr.deletePayroll")}</Button>
        </>}
      </div>
      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("hr.employee")}</TableHead>
            <TableHead className="text-end">{t("hr.baseSalary")}</TableHead>
            <TableHead className="text-end">{t("hr.allowances")}</TableHead>
            <TableHead className="text-end">{t("hr.transportAllowance")}</TableHead>
            <TableHead className="text-end">{t("hr.insurance")}</TableHead>
            <TableHead className="text-end">{t("hr.absenceDays")}</TableHead>
            <TableHead className="text-end">{t("hr.absenceDeduction")}</TableHead>
            <TableHead className="text-end">{t("hr.penaltiesTotal")}</TableHead>
            <TableHead className="text-end">{t("hr.advanceDeduction")}</TableHead>
            <TableHead className="text-end">{t("hr.net")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(items as any[]).length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">{currentRun ? t("common.empty") : t("hr.noPayrollYet")}</TableCell></TableRow>
            ) : (items as any[]).map((it: any) => (
              <TableRow key={it.id} className="hover:bg-muted/40">
                <TableCell className="font-semibold text-primary">{it.employees?.full_name}</TableCell>
                <TableCell className="text-end tabular-nums">{fmt(Number(it.base_salary))}</TableCell>
                <TableCell className="text-end tabular-nums">{fmt(Number(it.allowances))}</TableCell>
                <TableCell className="text-end tabular-nums">{fmt(Number(it.transport_allowance))}</TableCell>
                <TableCell className="text-end tabular-nums text-rose-600">{fmt(Number(it.insurance))}</TableCell>
                <TableCell className="text-end tabular-nums">{it.absence_days ?? 0}</TableCell>
                <TableCell className="text-end tabular-nums text-rose-600">{fmt(Number(it.absence_deduction))}</TableCell>
                <TableCell className="text-end tabular-nums text-rose-600">{fmt(Number(it.penalties_total))}</TableCell>
                <TableCell className="text-end tabular-nums text-rose-600">{fmt(Number(it.advance_deduction))}</TableCell>
                <TableCell className="text-end tabular-nums font-bold text-emerald-600">{fmt(Number(it.net_salary))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
