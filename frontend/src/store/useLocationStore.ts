import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StoreMatch } from '@/lib/types';

interface LocationState {
  match: StoreMatch | null;
  latitude: number | null;
  longitude: number | null;
  pincode: string | null;
  /** True once the shopper confirmed a location (vs. the silent default). */
  confirmed: boolean;
  setMatch: (m: StoreMatch, coords?: { latitude: number; longitude: number } | null, pincode?: string | null, confirmed?: boolean) => void;
  reset: () => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      match: null,
      latitude: null,
      longitude: null,
      pincode: null,
      confirmed: false,
      setMatch: (m, coords, pincode, confirmed = true) =>
        set({
          match: m,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          pincode: pincode ?? m.store.pincode,
          confirmed,
        }),
      reset: () => set({ match: null, latitude: null, longitude: null, pincode: null, confirmed: false }),
    }),
    { name: 'quick-cart-location', storage: createJSONStorage(() => localStorage) },
  ),
);

export const useStoreId = (): number | null => useLocationStore((s) => s.match?.store.id ?? null);
