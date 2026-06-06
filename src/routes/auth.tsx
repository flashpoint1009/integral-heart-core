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
    <div className="relative min-h-screen overflow-hidden bg-[#070b1c] text-white">
      {/* Animated aurora background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -start-40 h-[520px] w-[520px] rounded-full bg-indigo-500/40 blur-[140px] animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 end-[-160px] h-[460px] w-[460px] rounded-full bg-fuchsia-500/30 blur-[140px] animate-[pulse_10s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-160px] start-1/3 h-[520px] w-[520px] rounded-full bg-cyan-400/30 blur-[140px] animate-[pulse_12s_ease-in-out_infinite]" />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <div className="absolute top-4 end-4 z-30">
        <LanguageToggle />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md animate-[fade-in_0.6s_ease-out]">
          {/* Brand */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-400 via-fuchsia-400 to-cyan-300 blur-xl opacity-70" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-cyan-400 text-white font-bold text-2xl shadow-2xl ring-1 ring-white/30">
                E
              </div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold tracking-tight">{t("app.name")}</div>
              <div className="text-xs text-white/60 mt-1">{t("app.tagline")}</div>
            </div>
          </div>

          {/* Glass card */}
          <div
            className="relative rounded-3xl border border-white/15 bg-white/[0.06] p-7 shadow-[0_20px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
          >
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-white/10 to-transparent" />

            <div className="relative space-y-6">
              <div className="space-y-1 text-center">
                <h2 className="text-2xl font-bold tracking-tight">
                  {tab === "signin" ? t("auth.welcomeBack") : t("auth.welcome")}
                </h2>
                <p className="text-sm text-white/60">
                  {tab === "signin" ? t("auth.signInDesc") : t("auth.createAccountDesc")}
                </p>
              </div>

              <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
                <TabsList className="grid w-full grid-cols-2 h-11 rounded-full bg-white/10 border border-white/10 p-1">
                  <TabsTrigger
                    value="signin"
                    className="rounded-full text-white/70 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow"
                  >
                    {t("auth.signIn")}
                  </TabsTrigger>
                  <TabsTrigger
                    value="signup"
                    className="rounded-full text-white/70 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow"
                  >
                    {t("auth.signUp")}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="space-y-4 mt-6">
                  <form onSubmit={onSignIn} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-white/80">{t("auth.email")}</Label>
                      <Input
                        id="email" type="email" required value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/40 focus-visible:ring-white/40"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="password" className="text-white/80">{t("auth.password")}</Label>
                      <Input
                        id="password" type="password" required minLength={6} value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11 rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/40 focus-visible:ring-white/40"
                      />
                    </div>
                    <Button
                      type="submit" disabled={busy}
                      className="w-full h-11 rounded-xl font-semibold text-white border-0 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-cyan-400 shadow-lg shadow-indigo-500/30 hover:shadow-fuchsia-500/40 hover:opacity-95 transition-all"
                    >
                      {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                      {t("auth.signIn")}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="space-y-4 mt-6">
                  <form onSubmit={onSignUp} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-white/80">{t("auth.fullName")}</Label>
                      <Input
                        id="name" required value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="h-11 rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/40 focus-visible:ring-white/40"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="su-email" className="text-white/80">{t("auth.email")}</Label>
                      <Input
                        id="su-email" type="email" required value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/40 focus-visible:ring-white/40"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="su-password" className="text-white/80">{t("auth.password")}</Label>
                      <Input
                        id="su-password" type="password" required minLength={6} value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11 rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/40 focus-visible:ring-white/40"
                      />
                    </div>
                    <Button
                      type="submit" disabled={busy}
                      className="w-full h-11 rounded-xl font-semibold text-white border-0 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-cyan-400 shadow-lg shadow-indigo-500/30 hover:opacity-95 transition-all"
                    >
                      {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                      {t("auth.signUp")}
                    </Button>
                    <p className="text-xs text-center text-white/50">{t("auth.firstUserAdmin")}</p>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/15" /></div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="px-3 text-white/50 tracking-[0.2em] bg-transparent">{t("auth.or")}</span>
                </div>
              </div>

              <Button
                variant="outline" onClick={onGoogle} disabled={busy}
                className="w-full h-11 rounded-xl font-medium border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
              >
                <svg className="me-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                {t("auth.continueWithGoogle")}
              </Button>

              {/* Trust strip */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                {[
                  { icon: ShieldCheck, label: t("auth.feature3", "أمان") },
                  { icon: Sparkles, label: t("auth.feature2", "سهولة") },
                  { icon: BarChart3, label: t("auth.feature1", "تقارير") },
                ].map((f) => (
                  <div key={f.label} className="flex flex-col items-center gap-1 text-[11px] text-white/60">
                    <f.icon className="h-4 w-4 text-white/80" />
                    <span>{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] text-white/40">© {new Date().getFullYear()} {t("app.name")}</p>
        </div>
      </div>
    </div>
  );
}