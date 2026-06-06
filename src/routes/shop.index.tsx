import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getSiteConfigPublic } from "@/lib/api/storefront.functions";
import { useCart } from "@/lib/shop-cart";
import { Button } from "@/components/ui/button";
import { Plus, ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/shop/")({
  component: ShopHome,
});

type Section =
  | { id: string; type: "banner"; props: { title: string; subtitle?: string; image?: string; cta?: string } }
  | { id: string; type: "categories"; props: { title?: string } }
  | { id: string; type: "products"; props: { title?: string; categoryId?: string | null; limit?: number } }
  | { id: string; type: "text"; props: { title?: string; body?: string } }
  | { id: string; type: "image"; props: { url: string; alt?: string } };

const DEFAULT_SECTIONS: Section[] = [
  { id: "s1", type: "banner", props: { title: "أهلاً بك في متجرنا", subtitle: "اطلب أونلاين والدفع عند الاستلام", cta: "تسوّق الآن" } },
  { id: "s2", type: "categories", props: { title: "تسوّق حسب القسم" } },
  { id: "s3", type: "products", props: { title: "أحدث المنتجات", limit: 12 } },
];

function ShopHome() {
  const fetchCfg = useServerFn(getSiteConfigPublic);
  const { data } = useQuery({ queryKey: ["site_config_public"], queryFn: () => fetchCfg() });
  const cfg = data?.config;
  const rawSections = Array.isArray(cfg?.sections) ? (cfg!.sections as unknown as Section[]) : [];
  const sections: Section[] = rawSections.length ? rawSections : DEFAULT_SECTIONS;
  const shape = (cfg?.card_shape as "square" | "rounded" | "circle") ?? "rounded";
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const { add } = useCart();
  const cats = data?.categories ?? [];
  const products = data?.products ?? [];

  const cardCls = shape === "circle" ? "rounded-full aspect-square" : shape === "rounded" ? "rounded-2xl" : "rounded-md";
  const imgCls = shape === "circle" ? "rounded-full aspect-square" : shape === "rounded" ? "rounded-xl" : "rounded";

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 space-y-12">
      {sections.map((s) => {
        if (s.type === "banner") {
          return (
            <section
              key={s.id}
              className="relative overflow-hidden rounded-3xl p-10 md:p-16 text-primary-foreground shadow-lg"
              style={{ background: cfg?.primary_color ? `linear-gradient(135deg, ${cfg.primary_color}, color-mix(in oklab, ${cfg.primary_color} 70%, black))` : "var(--gradient-hero)" }}
            >
              <h1 className="text-3xl md:text-5xl font-extrabold">{s.props.title}</h1>
              {s.props.subtitle && <p className="mt-3 text-lg opacity-90">{s.props.subtitle}</p>}
              {s.props.cta && (
                <a href="#products" className="inline-block mt-6 bg-background text-foreground px-6 py-3 rounded-full font-semibold">
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
                  className={`shrink-0 px-4 py-2 rounded-full border font-medium ${selectedCat === null ? "bg-primary text-primary-foreground border-primary" : "bg-card"}`}
                >
                  الكل
                </button>
                {cats.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCat(c.id)}
                    className={`shrink-0 px-4 py-2 rounded-full border font-medium ${selectedCat === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-card"}`}
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
                    <div key={p.id} className={`bg-card border ${cardCls} p-3 flex flex-col gap-2 shadow-sm hover:shadow-md transition`}>
                      <div className={`bg-muted ${imgCls} overflow-hidden flex items-center justify-center aspect-square`}>
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name_ar} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="font-semibold line-clamp-2 text-sm">{p.name_ar}</div>
                      <div className="text-primary font-bold">{Number(p.sale_price).toFixed(2)} ج.م</div>
                      <Button size="sm" onClick={() => { add({ product_id: p.id, name: p.name_ar, price: Number(p.sale_price), image: p.image_url }); toast.success("أُضيف إلى السلة"); }}>
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
        if (s.type === "image") {
          return (
            <section key={s.id}>
              <img src={s.props.url} alt={s.props.alt ?? ""} className="w-full rounded-2xl" />
            </section>
          );
        }
        return null;
      })}
    </main>
  );
}