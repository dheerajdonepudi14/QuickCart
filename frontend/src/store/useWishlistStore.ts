import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface WishlistState {
  ids: number[];
  toggle: (id: number) => boolean;
  has: (id: number) => boolean;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) => {
        const exists = get().ids.includes(id);
        set({ ids: exists ? get().ids.filter((x) => x !== id) : [...get().ids, id] });
        return !exists;
      },
      has: (id) => get().ids.includes(id),
    }),
    { name: 'quick-cart-wishlist', storage: createJSONStorage(() => localStorage) },
  ),
);
