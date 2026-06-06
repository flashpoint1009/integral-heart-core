import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ShoppingCart, Store } from "lucide-react";
import { useCart } from "@/lib/shop-cart";

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
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 h-16">
          <Link to="/shop" className="flex items-center gap-2 font-bold text-lg">
            <Store className="h-5 w-5 text-primary" />
            <span>المتجر</span>
          </Link>
          <Link
            to="/shop/checkout"
            className="relative inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90"
          >
            <ShoppingCart className="h-4 w-4" />
            السلة
            {count > 0 && (
              <span className="absolute -top-2 -start-2 bg-destructive text-destructive-foreground text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>
        </div>
      </header>
      <Outlet />
      <footer className="border-t mt-16 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} — جميع الحقوق محفوظة
      </footer>
    </div>
  );
}