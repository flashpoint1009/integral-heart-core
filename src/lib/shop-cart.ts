import { useEffect, useState, useCallback } from "react";

export type CartItem = { product_id: string; name: string; price: number; image: string | null; qty: number };

const KEY = "shop_cart_v1";

function read(): CartItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

function write(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("shop_cart_change"));
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    setItems(read());
    const h = () => setItems(read());
    window.addEventListener("shop_cart_change", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("shop_cart_change", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  const add = useCallback((it: Omit<CartItem, "qty">, qty = 1) => {
    const cur = read();
    const idx = cur.findIndex((x) => x.product_id === it.product_id);
    if (idx >= 0) cur[idx].qty += qty;
    else cur.push({ ...it, qty });
    write(cur);
  }, []);
  const remove = useCallback((id: string) => write(read().filter((x) => x.product_id !== id)), []);
  const setQty = useCallback((id: string, qty: number) => {
    const cur = read().map((x) => (x.product_id === id ? { ...x, qty: Math.max(1, qty) } : x));
    write(cur);
  }, []);
  const clear = useCallback(() => write([]), []);
  const total = items.reduce((s, x) => s + x.price * x.qty, 0);
  const count = items.reduce((s, x) => s + x.qty, 0);
  return { items, add, remove, setQty, clear, total, count };
}