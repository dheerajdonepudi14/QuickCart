import { create } from 'zustand';

interface UIState {
  cartOpen: boolean;
  locationOpen: boolean;
  categoriesOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  setLocationOpen: (v: boolean) => void;
  setCategoriesOpen: (v: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  cartOpen: false,
  locationOpen: false,
  categoriesOpen: false,
  openCart: () => set({ cartOpen: true }),
  closeCart: () => set({ cartOpen: false }),
  setLocationOpen: (locationOpen) => set({ locationOpen }),
  setCategoriesOpen: (categoriesOpen) => set({ categoriesOpen }),
}));
