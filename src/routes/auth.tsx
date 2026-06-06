import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LanguageToggle } from "@/components/app/language-toggle";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Sparkles, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — ERP System" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("auth.welcomeBack"));
    navigate({ to: "/", replace: true });
  };

  const onSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("auth.welcome"));
    navigate({ to: "/", replace: true });
  };

  const onGoogle = async () => {
    setBusy(true);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) {
      setBusy(false);
      toast.error(r.error.message);
      return;
    }
    if (!r.redirected) navigate({ to: "/", replace: true });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="absolute top-4 end-4 z-20">
        <LanguageToggle />
      </div>

      {/* Hero panel */}
      <div
        className="relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute -top-32 -end-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 start-0 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md font-bold text-xl ring-1 ring-white/20">
            E
          </div>
          <span className="text-lg font-bold tracking-tight">{t("app.name")}</span>
        </div>

        <div className="relative space-y-6 max-w-md">
          <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight tracking-tight">
            {t("auth.heroTitle", "إدارة متجرك بذكاء وسهولة")}
          </h1>
          <p className="text-white/75 text-lg leading-relaxed">
            {t("auth.heroDesc", "نظام متكامل لإدارة المخزون والمبيعات والمشتريات مع تقارير لحظية")}
          </p>

          <div className="space-y-3 pt-4">
            {[
              { icon: BarChart3, label: t("auth.feature1", "تقارير لحظية ودقيقة") },
              { icon: Sparkles, label: t("auth.feature2", "نقاط بيع سهلة الاستخدام") },
              { icon: ShieldCheck, label: t("auth.feature3", "صلاحيات وأمان متقدم") },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <f.icon className="h-4 w-4" />
                </div>
                <span className="text-white/90 text-sm font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} {t("app.name")}</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center gap-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white font-bold"
              style={{ background: "var(--gradient-brand)" }}
            >
              E
            </div>
            <span className="text-lg font-bold">{t("app.name")}</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">
              {tab === "signin" ? t("auth.welcomeBack") : t("auth.welcome")}
            </h2>
            <p className="text-muted-foreground">
              {tab === "signin" ? t("auth.signInDesc") : t("auth.createAccountDesc")}
            </p>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
            <TabsList className="grid w-full grid-cols-2 h-11 rounded-full bg-muted p-1">
              <TabsTrigger value="signin" className="rounded-full data-[state=active]:shadow-sm">{t("auth.signIn")}</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-full data-[state=active]:shadow-sm">{t("auth.signUp")}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4 mt-6">
              <form onSubmit={onSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <Button type="submit" className="w-full h-11 rounded-xl font-semibold shadow-md" disabled={busy}>
                  {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  {t("auth.signIn")}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4 mt-6">
              <form onSubmit={onSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">{t("auth.fullName")}</Label>
                  <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-email">{t("auth.email")}</Label>
                  <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-password">{t("auth.password")}</Label>
                  <Input id="su-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <Button type="submit" className="w-full h-11 rounded-xl font-semibold shadow-md" disabled={busy}>
                  {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  {t("auth.signUp")}
                </Button>
                <p className="text-xs text-center text-muted-foreground">{t("auth.firstUserAdmin")}</p>
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground tracking-wider">{t("auth.or")}</span>
            </div>
          </div>

          <Button variant="outline" className="w-full h-11 rounded-xl font-medium" onClick={onGoogle} disabled={busy}>
            <svg className="me-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {t("auth.continueWithGoogle")}
          </Button>
        </div>
      </div>
    </div>
  );
}