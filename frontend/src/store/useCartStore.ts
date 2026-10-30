import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ProductCard } from '@/lib/types';

export const MAX_PER_ITEM = 20;

export interface CartItem {
  id: number;
  title: string;
  price: number;
  mrp: number;
  unitQuantity: string;
  quantity: number;
  imageUrl: string;
  darkStoreId: number;
  /** Last known stock for the item in its dark store — caps the stepper. */
  maxQuantity: number;
}

export type CartProductInput = Omit<CartItem, 'quantity'>;

export const toCartProduct = (p: ProductCard, darkStoreId: number): CartProductInput => ({
  id: p.id,
  title: p.title,
  price: Number(p.salePrice),
  mrp: Number(p.mrp),
  unitQuantity: p.unitQuantity,
  imageUrl: p.imageUrl,
  darkStoreId,
  maxQuantity: Math.min(MAX_PER_ITEM, p.stockQuantity),
});

interface CartStore {
  items: CartItem[];
  activeStoreId: number | null;
  couponCode: string | null;
  setActiveStore: (storeId: number) => boolean;
  /** Re-homes the cart to another dark store without emptying it (checkout re-quotes prices & stock). */
  moveToStore: (storeId: number) => void;
  addItem: (item: CartProductInput) => void;
  removeItem: (id: number) => void;
  deleteItem: (id: number) => void;
  setQuantity: (id: number, quantity: number) => void;
  syncStock: (stock: Record<number, number>) => void;
  setCoupon: (code: string | null) => void;
  clearCart: () => void;
  getTotal: () => number;
  getMrpTotal: () => number;
  getCount: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      activeStoreId: null,
      couponCode: null,

      /** Returns true when switching stores wiped a non-empty cart (inventory is per dark store). */
      setActiveStore: (storeId) => {
        const { activeStoreId, items } = get();
        if (activeStoreId !== null && activeStoreId !== storeId && items.length > 0) {
          set({ items: [], activeStoreId: storeId, couponCode: null });
          return true;
        }
        set({ activeStoreId: storeId });
        return false;
      },

      moveToStore: (storeId) =>
        set({ activeStoreId: storeId, items: get().items.map((i) => ({ ...i, darkStoreId: storeId })) }),

      addItem: (product) => {
        const { items, activeStoreId } = get();
        // Reset cart if user switches to a different dark store location
        if (activeStoreId && activeStoreId !== product.darkStoreId) {
          set({ items: [{ ...product, quantity: 1 }], activeStoreId: product.darkStoreId, couponCode: null });
          return;
        }
        const existing = items.find((i) => i.id === product.id);
        if (existing) {
          const cap = Math.min(MAX_PER_ITEM, product.maxQuantity);
          set({
            items: items.map((i) =>
              i.id === product.id
                ? { ...i, ...product, quantity: Math.min(cap, i.quantity + 1) }
                : i,
            ),
          });
        } else if (product.maxQuantity > 0) {
          set({ items: [...items, { ...product, quantity: 1 }], activeStoreId: product.darkStoreId });
        }
      },

      removeItem: (id) => {
        const { items } = get();
        const existing = items.find((i) => i.id === id);
        if (existing && existing.quantity > 1) {
          set({ items: items.map((i) => (i.id === id ? { ...i, quantity: i.quantity - 1 } : i)) });
        } else {
          set({ items: items.filter((i) => i.id !== id) });
        }
      },

      deleteItem: (id) => set({ items: get().items.filter((i) => i.id !== id) }),

      setQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().deleteItem(id);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.id === id ? { ...i, quantity: Math.min(quantity, Math.min(MAX_PER_ITEM, i.maxQuantity)) } : i,
          ),
        });
      },

      /** Applies authoritative stock numbers from a server quote. */
      syncStock: (stock) => {
        let changed = false;
        const items = get().items.map((i) => {
          const available = stock[i.id];
          if (available === undefined || available === i.maxQuantity) return i;
          changed = true;
          return { ...i, maxQuantity: Math.min(MAX_PER_ITEM, available) };
        });
        if (changed) set({ items });
      },

      setCoupon: (code) => set({ couponCode: code ? code.trim().toUpperCase() : null }),
      clearCart: () => set({ items: [], couponCode: null }),
      getTotal: () => get().items.reduce((acc, item) => acc + item.price * item.quantity, 0),
      getMrpTotal: () => get().items.reduce((acc, item) => acc + item.mrp * item.quantity, 0),
      getCount: () => get().items.reduce((acc, item) => acc + item.quantity, 0),
    }),
    { name: 'quick-cart-storage', storage: createJSONStorage(() => localStorage), version: 2 },
  ),
);
