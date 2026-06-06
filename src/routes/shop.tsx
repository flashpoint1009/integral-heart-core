import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { ShoppingCart, Store, Search, Menu as MenuIcon, X, Phone, MapPin } from "lucide-react";
import { useCart } from "@/lib/shop-cart";
import { getSiteConfigPublic } from "@/lib/api/storefront.functions";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "المتجر — اطلب أونلاين والدفع عند الاستلام" },
      { name: "description", content: "تسوّق منتجاتنا أونلاين، الدفع عند الاستلام." },
      { property: "og:title", content: "المتجر" },
      { property: "og:description", content: "تسوّق أونلاين والدفع عند الاستلام." },
    ],
  }),
  component: ShopLayout,
});

function ShopLayout() {
  const { count } = useCart();
  const fetchCfg = useServerFn(getSiteConfigPublic);
  const { data } = useQuery({ queryKey: ["site_config_public"], queryFn: () => fetchCfg() });
  const cfg = data?.config;
  const products = data?.products ?? [];
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const themeCss = useMemo(() => {
    const primary = cfg?.primary_color || "#1e3a8a";
    const secondary = cfg?.secondary_color || "#3b82f6";
    return { "--shop-primary": primary, "--shop-secondary": secondary } as React.CSSProperties;
  }, [cfg?.primary_color, cfg?.secondary_color]);

  const navItems = (cfg?.nav_items as any[]) ?? [];
  const enableSearch = cfg?.enable_search ?? true;
  const enableMenu = cfg?.enable_menu ?? true;
  const siteName = cfg?.site_name || "المتجر";

  const searchResults = useMemo(() => {
    if (!searchQ.trim()) return [];
    const q = searchQ.trim().toLowerCase();
    return (products as any[]).filter((p) =>
      (p.name_ar || "").toLowerCase().includes(q) ||
      (p.name_en || "").toLowerCase().includes(q),
    ).slice(0, 8);
  }, [searchQ, products]);

  return (
    <div className="min-h-screen bg-background" dir="rtl" style={themeCss}>
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur shadow-sm">
        <div className="mx-auto max-w-7xl flex items-center gap-2 px-4 h-16">
          {enableMenu && (
            <button onClick={() => setMenuOpen(true)} className="p-2 -ms-2 rounded-lg hover:bg-muted lg:hidden" aria-label="القائمة">
              <MenuIcon className="h-6 w-6" />
            </button>
          )}

          <Link to="/shop" className="flex items-center gap-2 font-bold text-lg shrink-0">
            {cfg?.logo_url ? (
              <img src={cfg.logo_url} alt={siteName} className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div className="h-9 w-9 rounded-lg grid place-items-center text-white" style={{ background: "var(--shop-primary)" }}>
                <Store className="h-5 w-5" />
              </div>
            )}
            <span className="hidden sm:inline">{siteName}</span>
          </Link>

          {/* Desktop nav */}
          {enableMenu && navItems.length > 0 && (
            <nav className="hidden lg:flex items-center gap-5 ms-6">
              {navItems.map((n) => (
                <a key={n.id} href={n.url} className="text-sm font-medium hover:text-[var(--shop-primary)] transition">
                  {n.label}
                </a>
              ))}
            </nav>
          )}

          {/* Search */}
          {enableSearch && (
            <div className="flex-1 max-w-md mx-auto hidden md:block relative">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={searchQ}
                  onChange={(e) => { setSearchQ(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                  placeholder="ابحث عن منتج..."
                  className="w-full h-10 ps-9 pe-3 rounded-full border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-[var(--shop-primary)]/30"
                />
              </div>
              {searchOpen && searchResults.length > 0 && (
                <div className="absolute top-12 inset-x-0 bg-card border rounded-2xl shadow-xl overflow-hidden z-40">
                  {searchResults.map((p: any) => (
                    <a key={p.id} href={`#prod-${p.id}`} onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setSearchOpen(false); document.getElementById(`prod-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                      className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer">
                      {p.image_url ? <img src={p.image_url} alt="" className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 rounded bg-muted" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.name_ar}</div>
                        <div className="text-xs" style={{ color: "var(--shop-primary)" }}>{Number(p.sale_price).toFixed(2)} ج.م</div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex-1 md:flex-none" />

          <Link to="/shop/checkout"
            className="relative inline-flex items-center gap-2 rounded-full text-white px-4 py-2 text-sm font-semibold hover:opacity-90 shrink-0"
            style={{ background: "var(--shop-primary)" }}>
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">السلة</span>
            {count > 0 && (
              <span className="absolute -top-2 -start-2 bg-destructive text-destructive-foreground text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>
        </div>

        {/* Mobile search bar */}
        {enableSearch && (
          <div className="md:hidden px-4 pb-3">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="ابحث..."
                className="w-full h-10 ps-9 pe-3 rounded-full border bg-card text-sm"
              />
            </div>
          </div>
        )}
      </header>

      {/* Side drawer */}
      {enableMenu && menuOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setMenuOpen(false)} />
          <aside className="fixed top-0 bottom-0 start-0 w-72 bg-background z-50 shadow-2xl animate-slide-in-right p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <span className="font-bold">{siteName}</span>
              <button onClick={() => setMenuOpen(false)} className="p-2 rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <nav className="space-y-1">
              <Link to="/shop" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-lg hover:bg-muted font-medium">الرئيسية</Link>
              {navItems.map((n) => (
                <a key={n.id} href={n.url} onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-lg hover:bg-muted">{n.label}</a>
              ))}
              <Link to="/shop/checkout" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-lg hover:bg-muted">السلة</Link>
            </nav>
            {(cfg?.contact_phone || cfg?.contact_address) && (
              <div className="mt-6 pt-5 border-t space-y-2 text-sm text-muted-foreground">
                {cfg?.contact_phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4" />{cfg.contact_phone}</div>}
                {cfg?.contact_address && <div className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 shrink-0" />{cfg.contact_address}</div>}
              </div>
            )}
          </aside>
        </>
      )}

      <Outlet />

      <footer className="border-t mt-16 py-8 text-center text-sm text-muted-foreground space-y-2">
        {(cfg?.contact_phone || cfg?.contact_address) && (
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            {cfg?.contact_phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{cfg.contact_phone}</span>}
            {cfg?.contact_address && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{cfg.contact_address}</span>}
          </div>
        )}
        <div>© {new Date().getFullYear()} — {siteName}</div>
      </footer>
    </div>
  );
}
