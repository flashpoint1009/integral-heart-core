import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getSiteConfigPublic } from "@/lib/api/storefront.functions";
import { useCart } from "@/lib/shop-cart";
import { Button } from "@/components/ui/button";
import { Plus, ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/shop/")({
  component: ShopHome,
});

type Section =
  | { id: string; type: "banner"; props: { title: string; subtitle?: string; image?: string | null; cta?: string } }
  | { id: string; type: "categories"; props: { title?: string } }
  | { id: string; type: "products"; props: { title?: string; categoryId?: string | null; limit?: number } }
  | { id: string; type: "text"; props: { title?: string; body?: string } }
  | { id: string; type: "image"; props: { url: string | null; alt?: string } }
  | { id: string; type: "features"; props: { title?: string; items?: { icon: string; label: string }[] } };

const DEFAULT_SECTIONS: Section[] = [
  { id: "s2", type: "categories", props: { title: "تسوّق حسب القسم" } },
  { id: "s3", type: "products", props: { title: "أحدث المنتجات", limit: 12 } },
];

function BannerSlider({ banners }: { banners: any[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);
  if (banners.length === 0) return null;
  const b = banners[i];
  return (
    <section className="relative overflow-hidden rounded-3xl aspect-[21/9] md:aspect-[3/1] bg-muted">
      {b.image ? (
        <img src={b.image} alt={b.title ?? ""} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">لا توجد صورة</div>
      )}
      {(b.title || b.subtitle) && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-6 md:p-10 text-white">
          {b.title && <h2 className="text-2xl md:text-4xl font-extrabold drop-shadow">{b.title}</h2>}
          {b.subtitle && <p className="mt-2 text-sm md:text-lg opacity-90 drop-shadow">{b.subtitle}</p>}
        </div>
      )}
      {b.link && <a href={b.link} className="absolute inset-0" aria-label={b.title} />}
      {banners.length > 1 && (
        <>
          <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
            {banners.map((_, idx) => (
              <button key={idx} onClick={() => setI(idx)} className={`h-1.5 rounded-full transition-all ${idx === i ? "w-6 bg-white" : "w-1.5 bg-white/50"}`} />
            ))}
          </div>
          <button onClick={() => setI((i - 1 + banners.length) % banners.length)} className="absolute start-2 top-1/2 -translate-y-1/2 h-9 w-9 grid place-items-center rounded-full bg-black/40 text-white hover:bg-black/60">
            <ChevronRight className="h-5 w-5" />
          </button>
          <button onClick={() => setI((i + 1) % banners.length)} className="absolute end-2 top-1/2 -translate-y-1/2 h-9 w-9 grid place-items-center rounded-full bg-black/40 text-white hover:bg-black/60">
            <ChevronLeft className="h-5 w-5" />
          </button>
        </>
      )}
    </section>
  );
}

function ShopHome() {
  const fetchCfg = useServerFn(getSiteConfigPublic);
  const { data } = useQuery({ queryKey: ["site_config_public"], queryFn: () => fetchCfg() });
  const cfg = data?.config;
  const rawSections = Array.isArray(cfg?.sections) ? (cfg!.sections as unknown as Section[]) : [];
  const sections: Section[] = rawSections.length ? rawSections : DEFAULT_SECTIONS;
  const shape = (cfg?.card_shape as "square" | "rounded" | "circle") ?? "rounded";
  const banners = ((cfg?.banners as any[]) ?? []).filter((b) => b?.image);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const { add } = useCart();
  const cats = data?.categories ?? [];
  const products = data?.products ?? [];

  const cardCls = shape === "circle" ? "rounded-full aspect-square" : shape === "rounded" ? "rounded-2xl" : "rounded-md";
  const imgCls = shape === "circle" ? "rounded-full aspect-square" : shape === "rounded" ? "rounded-xl" : "rounded";

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 space-y-12">
      {banners.length > 0 && <BannerSlider banners={banners} />}

      {sections.map((s) => {
        if (s.type === "banner") {
          return (
            <section key={s.id}
              className="relative overflow-hidden rounded-3xl p-10 md:p-16 text-white shadow-lg min-h-[260px]"
              style={s.props.image ? { backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25)), url(${s.props.image})`, backgroundSize: "cover", backgroundPosition: "center" }
                : { background: `linear-gradient(135deg, var(--shop-primary), var(--shop-secondary))` }}>
              <h1 className="text-3xl md:text-5xl font-extrabold drop-shadow">{s.props.title}</h1>
              {s.props.subtitle && <p className="mt-3 text-lg opacity-95">{s.props.subtitle}</p>}
              {s.props.cta && (
                <a href="#products" className="inline-block mt-6 bg-white text-foreground px-6 py-3 rounded-full font-semibold shadow">
                  {s.props.cta}
                </a>
              )}
            </section>
          );
        }
        if (s.type === "categories") {
          return (
            <section key={s.id}>
              {s.props.title && <h2 className="text-2xl font-bold mb-4">{s.props.title}</h2>}
              <div className="flex gap-3 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedCat(null)}
                  className={`shrink-0 px-4 py-2 rounded-full border font-medium ${selectedCat === null ? "text-white border-transparent" : "bg-card"}`}
                  style={selectedCat === null ? { background: "var(--shop-primary)" } : undefined}
                >
                  الكل
                </button>
                {cats.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCat(c.id)}
                    className={`shrink-0 px-4 py-2 rounded-full border font-medium ${selectedCat === c.id ? "text-white border-transparent" : "bg-card"}`}
                    style={selectedCat === c.id ? { background: "var(--shop-primary)" } : undefined}
                  >
                    {c.name_ar}
                  </button>
                ))}
              </div>
            </section>
          );
        }
        if (s.type === "products") {
          const filtered = (s.props.categoryId
            ? products.filter((p: any) => p.category_id === s.props.categoryId)
            : selectedCat
              ? products.filter((p: any) => p.category_id === selectedCat)
              : products
          ).slice(0, s.props.limit ?? 24);
          return (
            <section key={s.id} id="products">
              {s.props.title && <h2 className="text-2xl font-bold mb-4">{s.props.title}</h2>}
              {filtered.length === 0 ? (
                <p className="text-muted-foreground text-center py-12">لا توجد منتجات</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filtered.map((p: any) => (
                    <div key={p.id} id={`prod-${p.id}`} className={`bg-card border ${cardCls} p-3 flex flex-col gap-2 shadow-sm hover:shadow-md transition`}>
                      <div className={`bg-muted ${imgCls} overflow-hidden flex items-center justify-center aspect-square`}>
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name_ar} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="font-semibold line-clamp-2 text-sm">{p.name_ar}</div>
                      <div className="font-bold" style={{ color: "var(--shop-primary)" }}>{Number(p.sale_price).toFixed(2)} ج.م</div>
                      <Button size="sm" style={{ background: "var(--shop-primary)" }}
                        onClick={() => { add({ product_id: p.id, name: p.name_ar, price: Number(p.sale_price), image: p.image_url }); toast.success("أُضيف إلى السلة"); }}>
                        <Plus className="h-4 w-4 me-1" /> أضف
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        }
        if (s.type === "text") {
          return (
            <section key={s.id} className="prose max-w-none">
              {s.props.title && <h2 className="text-2xl font-bold mb-2">{s.props.title}</h2>}
              {s.props.body && <p className="text-muted-foreground whitespace-pre-line">{s.props.body}</p>}
            </section>
          );
        }
        if (s.type === "image" && s.props.url) {
          return (
            <section key={s.id}>
              <img src={s.props.url} alt={s.props.alt ?? ""} className="w-full rounded-2xl" />
            </section>
          );
        }
        if (s.type === "features") {
          return (
            <section key={s.id}>
              {s.props.title && <h2 className="text-2xl font-bold mb-4 text-center">{s.props.title}</h2>}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(s.props.items ?? []).map((it, i) => (
                  <div key={i} className="bg-card border rounded-2xl p-5 text-center hover:shadow-md transition">
                    <div className="text-4xl mb-2">{it.icon}</div>
                    <div className="font-semibold text-sm">{it.label}</div>
                  </div>
                ))}
              </div>
            </section>
          );
        }
        return null;
      })}
    </main>
  );
}
