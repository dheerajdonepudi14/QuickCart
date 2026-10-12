'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { api, HttpError } from '@/lib/api';
import { stomp } from '@/lib/stomp';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocationStore } from '@/store/useLocationStore';
import { useCartStore } from '@/store/useCartStore';
import { useUIStore } from '@/store/useUIStore';

const DEFAULT_PINCODE = '560034';

function AuthBootstrap() {
  const setUser = useAuthStore((s) => s.setUser);
  useEffect(() => {
    api.auth.me().then(setUser).catch(() => setUser(null));
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === 'success') {
      toast.success('Signed in successfully');
      stomp.reconnect();
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [setUser]);
  return null;
}

/** Makes sure a dark store is always selected (catalog is store-scoped) and keeps the cart bound to it. */
function LocationBootstrap() {
  const match = useLocationStore((s) => s.match);
  const confirmed = useLocationStore((s) => s.confirmed);
  const setMatch = useLocationStore((s) => s.setMatch);
  const setActiveStore = useCartStore((s) => s.setActiveStore);
  const setLocationOpen = useUIStore((s) => s.setLocationOpen);

  useEffect(() => {
    if (match) return;
    api.stores
      .byPincode(DEFAULT_PINCODE)
      // The first client render uses the server snapshot (match = null) before localStorage is applied,
      // so re-check the live store: never overwrite a location the shopper already confirmed.
      .then((m) => {
        if (!useLocationStore.getState().match) setMatch(m, null, DEFAULT_PINCODE, false);
      })
      .catch((e: unknown) => {
        if (e instanceof HttpError && e.status === 0) toast.error(e.message, { id: 'backend-down' });
      });
  }, [match, setMatch]);

  useEffect(() => {
    if (match && !confirmed) {
      const t = setTimeout(() => setLocationOpen(true), 1200);
      return () => clearTimeout(t);
    }
  }, [match, confirmed, setLocationOpen]);

  const storeId = match?.store.id;
  useEffect(() => {
    if (!storeId) return;
    const cleared = setActiveStore(storeId);
    if (cleared) toast.info('Your cart was cleared because you switched to a different dark store.');
  }, [storeId, setActiveStore]);
  return null;
}

export default function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: (count, err) => !(err instanceof HttpError && err.status >= 400 && err.status < 500) && count < 2,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AuthBootstrap />
      <LocationBootstrap />
      {children}
      <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: 'Mulish, sans-serif' } }} />
    </QueryClientProvider>
  );
}
