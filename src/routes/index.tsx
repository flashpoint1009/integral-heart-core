import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Sparkles, ShieldCheck, Zap, BarChart3, Boxes, ShoppingCart,
  Users, Truck, Cloud, Smartphone, Globe, CheckCircle2, Star,
  TrendingUp, Layers, Lock, Bell, MapPin, Receipt
} from "lucide-react";
import heroImage from "@/assets/storhup-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StorHup — نظام إدارة الأعمال السحابي الأذكى" },
      { name: "description", content: "StorHup منصة ERP متكاملة: مبيعات، مخزون، نقاط بيع، مندوبين، وذكاء أعمال لحظي. ابدأ تشغيل شركتك في دقائق." },
      { property: "og:title", content: "StorHup — أذكى منصة لإدارة أعمالك" },
      { property: "og:description", content: "نظام ERP عربي سحابي يجمع المبيعات والمخزون ونقاط البيع والمندوبين في لوحة واحدة." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-[#050816] text-white antialiased">
      {/* Aurora background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -right-32 h-[520px] w-[520px] rounded-full bg-cyan-500/20 blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -left-40 h-[600px] w-[600px] rounded-full bg-indigo-600/25 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-[420px] w-[420px] rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(56,189,248,0.08),_transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
          }}
        />
      </div>

      {/* Nav */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled ? "backdrop-blur-xl bg-[#050816]/70 border-b border-white/5" : ""
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-600 grid place-items-center shadow-[0_0_30px_rgba(34,211,238,0.4)] group-hover:shadow-[0_0_45px_rgba(34,211,238,0.7)] transition-shadow">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">StorHup</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/70">
            <a href="#features" className="hover:text-white transition">المميزات</a>
            <a href="#modules" className="hover:text-white transition">الوحدات</a>
            <a href="#pricing" className="hover:text-white transition">الأسعار</a>
            <a href="#faq" className="hover:text-white transition">الأسئلة</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="hidden sm:inline-flex items-center rounded-lg px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/5 transition"
            >
              تسجيل الدخول
            </Link>
            <Link
              to="/auth"
              className="group relative inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-400 to-indigo-500 px-4 py-2 text-sm font-semibold text-[#050816] shadow-[0_0_20px_rgba(34,211,238,0.45)] hover:shadow-[0_0_35px_rgba(34,211,238,0.8)] transition-all"
            >
              ابدأ مجاناً
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-36 pb-24 md:pt-44 md:pb-32">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-4 py-1.5 text-xs text-cyan-300 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
            </span>
            الإصدار 2026 متاح الآن — مدعوم بالذكاء الاصطناعي
          </div>

          <h1 className="mt-8 text-5xl md:text-7xl font-black leading-[1.05] tracking-tight">
            أدِر شركتك بالكامل
            <br />
            <span className="bg-gradient-to-l from-cyan-300 via-sky-200 to-indigo-300 bg-clip-text text-transparent">
              من لوحة واحدة ذكية
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg md:text-xl text-white/65 leading-relaxed">
            <span className="font-semibold text-white">StorHup</span> منصة ERP سحابية متكاملة تجمع
            المبيعات والمخزون ونقاط البيع والمندوبين والتقارير في تجربة واحدة سريعة، أنيقة، وعربية أصيلة.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth"
              className="group relative inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-7 py-3.5 text-base font-bold text-[#050816] shadow-[0_0_40px_rgba(34,211,238,0.5)] hover:shadow-[0_0_60px_rgba(34,211,238,0.9)] transition-all hover:scale-[1.02]"
            >
              جرّب المنصة مجاناً
              <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-7 py-3.5 text-base font-semibold text-white/90 backdrop-blur hover:bg-white/10 transition"
            >
              شاهد العرض التوضيحي
            </a>
          </div>

          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-white/50">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> بدون بطاقة ائتمان</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> إعداد في دقائق</span>
            <span className="hidden sm:flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> دعم عربي 24/7</span>
          </div>

          {/* Hero image */}
          <div className="relative mt-16 mx-auto max-w-6xl">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-cyan-500/30 via-indigo-500/30 to-fuchsia-500/30 blur-2xl opacity-70" />
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
              <img
                src={heroImage}
                alt="StorHup dashboard"
                width={1920}
                height={1080}
                className="w-full h-auto"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050816] via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="relative py-16 border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-7xl px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { v: "+5,200", l: "شركة تثق بنا" },
            { v: "+18M", l: "فاتورة سنوياً" },
            { v: "99.99%", l: "زمن تشغيل" },
            { v: "4.9/5", l: "تقييم العملاء" },
          ].map((s, i) => (
            <div key={i} className="space-y-1">
              <div className="text-3xl md:text-4xl font-black bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">
                {s.v}
              </div>
              <div className="text-sm text-white/50">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              <Zap className="h-3.5 w-3.5 text-cyan-300" /> مميزات صُممت لتفوز
            </div>
            <h2 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight">
              كل ما تحتاجه إدارتك،
              <span className="bg-gradient-to-l from-cyan-300 to-indigo-300 bg-clip-text text-transparent"> في مكان واحد</span>
            </h2>
            <p className="mt-4 text-white/60">قوة المؤسسات الكبرى، بساطة تطبيق على هاتفك.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { i: BarChart3, t: "ذكاء أعمال لحظي", d: "لوحات تنفيذية، توقعات مبيعات بالذكاء الاصطناعي، وتقارير ربحية بضغطة زر." },
              { i: Boxes, t: "مخزون متعدد المستودعات", d: "تتبع كل قطعة بالباركود، تحويلات لحظية، وتنبيهات نفاد ذكية." },
              { i: ShoppingCart, t: "نقاط بيع POS فائقة السرعة", d: "واجهة بيع لمسية، طباعة فواتير، ودعم كامل للأجهزة الطرفية." },
              { i: Users, t: "إدارة المندوبين الميدانيين", d: "تتبع GPS، خطط زيارات، وتسجيل أوامر بيع مباشرة من المتجر." },
              { i: Truck, t: "مشتريات وموردين", d: "أوامر شراء، مرتجعات، وتقييم أداء الموردين تلقائياً." },
              { i: Receipt, t: "محاسبة وفواتير", d: "فواتير إلكترونية، ضرائب، وتسويات بنكية متوافقة." },
              { i: Bell, t: "إشعارات فورية", d: "تنبيهات Push تصل لك حتى لو الشاشة مقفلة، عبر كل الأجهزة." },
              { i: MapPin, t: "خرائط حية", d: "شاهد مندوبيك وعملاءك على الخريطة لحظة بلحظة." },
              { i: Lock, t: "أمان مصرفي", d: "تشفير متقدم، صلاحيات دقيقة لكل دور، ونسخ احتياطي تلقائي." },
            ].map((f, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 backdrop-blur transition-all hover:border-cyan-400/40 hover:-translate-y-1"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-cyan-500/10 via-transparent to-indigo-500/10" />
                <div className="relative">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/20 to-indigo-500/20 border border-cyan-400/30 mb-4">
                    <f.i className="h-6 w-6 text-cyan-300" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{f.t}</h3>
                  <p className="text-sm text-white/60 leading-relaxed">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules showcase */}
      <section id="modules" className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-950/60 via-[#0a1030]/60 to-cyan-950/40 backdrop-blur-xl p-10 md:p-16">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-3 py-1 text-xs text-cyan-300 mb-5">
                  <Layers className="h-3.5 w-3.5" /> منصة مرنة
                </div>
                <h2 className="text-4xl md:text-5xl font-bold leading-tight">
                  وحدات تعمل معاً،
                  <br />
                  <span className="bg-gradient-to-l from-cyan-300 to-indigo-300 bg-clip-text text-transparent">كنظام واحد متناغم</span>
                </h2>
                <p className="mt-5 text-white/65 leading-relaxed">
                  فعّل ما تحتاجه فقط. كل وحدة تتكامل تلقائياً مع الباقي — بدون إعدادات معقدة، بدون تكرار للبيانات.
                </p>
                <ul className="mt-6 space-y-3">
                  {["مبيعات وفواتير", "مخزون ومستودعات", "نقاط بيع POS", "مندوبين ميداني", "مشتريات وموردين", "موارد بشرية", "متجر إلكتروني", "تقارير وذكاء أعمال"].map((m, i) => (
                    <li key={i} className="flex items-center gap-3 text-white/80">
                      <CheckCircle2 className="h-5 w-5 text-cyan-300 shrink-0" />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { i: TrendingUp, c: "from-cyan-500/30 to-cyan-500/5", t: "+47%", l: "نمو المبيعات" },
                  { i: Boxes, c: "from-indigo-500/30 to-indigo-500/5", t: "12,400", l: "صنف مخزون" },
                  { i: ShoppingCart, c: "from-fuchsia-500/30 to-fuchsia-500/5", t: "98%", l: "رضا العملاء" },
                  { i: Globe, c: "from-emerald-500/30 to-emerald-500/5", t: "24/7", l: "متصل دائماً" },
                ].map((s, i) => (
                  <div key={i} className={`rounded-2xl border border-white/10 bg-gradient-to-br ${s.c} p-6 backdrop-blur`}>
                    <s.i className="h-7 w-7 text-white/90 mb-3" />
                    <div className="text-3xl font-black">{s.t}</div>
                    <div className="text-xs text-white/60 mt-1">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why us */}
      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-6 grid md:grid-cols-3 gap-6">
          {[
            { i: Cloud, t: "سحابي 100%", d: "اعمل من أي مكان، أي جهاز، بدون تثبيت." },
            { i: Smartphone, t: "تطبيق PWA", d: "ثبّته على هاتفك واستخدمه حتى بدون إنترنت." },
            { i: ShieldCheck, t: "ملتزم بالأنظمة", d: "متوافق مع الفوترة الإلكترونية والضرائب الخليجية." },
          ].map((b, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 hover:bg-white/[0.06] transition">
              <b.i className="h-8 w-8 text-cyan-300 mb-4" />
              <h3 className="text-xl font-bold mb-2">{b.t}</h3>
              <p className="text-white/60">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonial */}
      <section className="relative py-24">
        <div className="mx-auto max-w-4xl px-6">
          <div className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.01] p-10 md:p-14 text-center backdrop-blur-xl">
            <div className="flex justify-center gap-1 mb-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-amber-300 text-amber-300" />
              ))}
            </div>
            <p className="text-2xl md:text-3xl font-medium leading-relaxed text-white/90">
              "بعد StorHup، اختفت ملفات الإكسل وفوضى التقارير. أصبحت أعرف ربحية كل منتج، كل فرع، كل مندوب — لحظياً."
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-cyan-400 to-indigo-500" />
              <div className="text-right">
                <div className="font-bold">أحمد المالكي</div>
                <div className="text-sm text-white/50">المدير التنفيذي — مجموعة الخليج التجارية</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section id="pricing" className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-14">
            <h2 className="text-4xl md:text-5xl font-bold">باقات بسيطة، قيمة هائلة</h2>
            <p className="mt-3 text-white/60">ابدأ مجاناً، وارتقِ حين تكبر.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: "البداية", p: "0", d: "للأعمال الصغيرة", f: ["مستخدم واحد", "حتى 100 فاتورة/شهر", "مخزون أساسي", "دعم بريد"], h: false },
              { n: "الاحترافي", p: "299", d: "الأكثر شيوعاً", f: ["10 مستخدمين", "فواتير غير محدودة", "POS + مندوبين", "تقارير متقدمة", "دعم أولوية"], h: true },
              { n: "المؤسسات", p: "حسب الطلب", d: "للشركات الكبرى", f: ["مستخدمون غير محدود", "وحدات مخصصة", "API كامل", "مدير حساب مخصص", "SLA 99.99%"], h: false },
            ].map((p, i) => (
              <div
                key={i}
                className={`relative rounded-2xl p-8 border backdrop-blur transition-all hover:-translate-y-1 ${
                  p.h
                    ? "border-cyan-400/50 bg-gradient-to-b from-cyan-500/10 to-indigo-500/5 shadow-[0_0_40px_rgba(34,211,238,0.25)]"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                {p.h && (
                  <div className="absolute -top-3 right-6 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 px-3 py-1 text-xs font-bold text-[#050816]">
                    الأكثر شعبية
                  </div>
                )}
                <div className="text-sm text-white/60">{p.n}</div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-black">{p.p}</span>
                  {p.p !== "حسب الطلب" && <span className="text-white/50 text-sm">ر.س/شهر</span>}
                </div>
                <div className="mt-1 text-sm text-white/50">{p.d}</div>
                <ul className="mt-6 space-y-3">
                  {p.f.map((x, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-white/80">
                      <CheckCircle2 className="h-4 w-4 text-cyan-300 shrink-0" /> {x}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/auth"
                  className={`mt-8 inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-bold transition ${
                    p.h
                      ? "bg-gradient-to-r from-cyan-400 to-indigo-500 text-[#050816] hover:shadow-[0_0_30px_rgba(34,211,238,0.6)]"
                      : "border border-white/15 text-white hover:bg-white/5"
                  }`}
                >
                  ابدأ الآن
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-28">
        <div className="mx-auto max-w-5xl px-6">
          <div className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-indigo-900/60 via-[#0a1030] to-cyan-900/40 p-12 md:p-20 text-center">
            <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-cyan-400/30 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-indigo-500/30 blur-3xl" />
            <div className="relative">
              <h2 className="text-4xl md:text-6xl font-black tracking-tight">
                جاهز لتحوّل
                <br />
                <span className="bg-gradient-to-l from-cyan-300 to-indigo-300 bg-clip-text text-transparent">طريقة عملك؟</span>
              </h2>
              <p className="mt-5 text-white/70 max-w-xl mx-auto">
                انضم لآلاف الشركات التي ضاعفت إنتاجيتها مع StorHup. التجربة مجانية بالكامل.
              </p>
              <Link
                to="/auth"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-8 py-4 text-base font-bold text-[#050816] shadow-[0_0_50px_rgba(34,211,238,0.6)] hover:shadow-[0_0_70px_rgba(34,211,238,0.9)] transition-all hover:scale-[1.03]"
              >
                ابدأ تجربتك المجانية
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/5 py-10">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/50">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-cyan-400 to-indigo-600 grid place-items-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span>© {new Date().getFullYear()} StorHup. جميع الحقوق محفوظة.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-white transition">الخصوصية</a>
            <a href="#" className="hover:text-white transition">الشروط</a>
            <a href="#" className="hover:text-white transition">تواصل</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
