'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Bike, Heart, LayoutDashboard, LogOut, Menu, Package, ShoppingCart, User } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { stomp } from '@/lib/stomp';
import { formatPrice } from '@/lib/format';
import { useHydrated } from '@/lib/hooks';
import { isAdmin, useAuthStore } from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';
import { useUIStore } from '@/store/useUIStore';
import { useWishlistStore } from '@/store/useWishlistStore';
import SearchBox from './SearchBox';
import CategoryMenu from './CategoryMenu';

function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="QuickCart home">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-lg text-white shadow-sm">🛒</span>
      <span className="hidden font-display text-xl font-extrabold tracking-tight sm:inline">
        Quick<span className="text-brand-500">Cart</span>
      </span>
    </Link>
  );
}

function AccountMenu() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (!user) {
    return (
      <Link href="/login" className="flex h-9 w-9 items-center justify-center rounded-full bg-mint text-brand-700 hover:bg-brand-200" aria-label="Sign in">
        <User size={17} />
      </Link>
    );
  }

  const logout = async () => {
    try { await api.auth.logout(); } catch { /* cookies cleared server-side anyway */ }
    setUser(null);
    qc.removeQueries({ queryKey: ['orders'] });
    qc.removeQueries({ queryKey: ['addresses'] });
    stomp.reconnect();
    toast.success('Signed out');
    router.push('/');
  };

  const initials = user.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-xs font-bold text-white ring-2 ring-white hover:ring-brand-200"
        aria-label="Account menu"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-56 animate-fade-in rounded-xl border border-line bg-white p-2 shadow-lift">
          <div className="border-b border-line px-3 pb-2 pt-1">
            <p className="truncate text-sm font-bold">{user.fullName}</p>
            <p className="truncate text-xs text-ink-muted">{user.email}</p>
          </div>
          <Link onClick={() => setOpen(false)} href="/orders" className="mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-mint">
            <Package size={15} /> My orders
          </Link>
          {user.role === 'ROLE_DELIVERY_PARTNER' && (
            <Link onClick={() => setOpen(false)} href="/rider" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-mint">
              <Bike size={15} /> Rider app
            </Link>
          )}
          {isAdmin(user) && (
            <Link onClick={() => setOpen(false)} href="/admin/dashboard" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-mint">
              <LayoutDashboard size={15} /> Store dashboard
            </Link>
          )}
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-danger hover:bg-red-50">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const hydrated = useHydrated();
  const count = useCartStore((s) => s.items.reduce((a, i) => a + i.quantity, 0));
  const total = useCartStore((s) => s.items.reduce((a, i) => a + i.price * i.quantity, 0));
  const wishCount = useWishlistStore((s) => s.ids.length);
  const openCart = useUIStore((s) => s.openCart);
  const setCategoriesOpen = useUIStore((s) => s.setCategoriesOpen);
  const categoriesOpen = useUIStore((s) => s.categoriesOpen);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="container flex h-16 items-center gap-3 md:gap-6">
        <Logo />
        <div className="relative">
          <button
            onClick={() => setCategoriesOpen(!categoriesOpen)}
            className="flex items-center gap-2 rounded-md px-2 py-2 text-[13px] font-bold hover:bg-mint"
            aria-expanded={categoriesOpen}
          >
            <Menu size={18} />
            <span className="hidden lg:inline">All Categories</span>
          </button>
          <CategoryMenu />
        </div>
        <div className="min-w-0 flex-1">
          <Suspense fallback={<div className="h-10 w-full max-w-2xl rounded-md border border-line" />}>
            <SearchBox />
          </Suspense>
        </div>
        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <Link href="/wishlist" className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-mint hover:text-brand-700" aria-label="Wishlist">
            <Heart size={19} />
            {hydrated && wishCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{wishCount}</span>
            )}
          </Link>
          <button
            onClick={openCart}
            className={
              hydrated && count > 0
                ? 'flex h-10 items-center gap-2 rounded-lg bg-brand-500 px-3 text-white shadow-sm transition hover:bg-brand-600'
                : 'relative flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-mint hover:text-brand-700'
            }
            aria-label="Open cart"
          >
            <ShoppingCart size={19} />
            {hydrated && count > 0 && (
              <span className="flex flex-col items-start leading-none">
                <span className="text-[11px] font-bold">{count} item{count > 1 ? 's' : ''}</span>
                <span className="text-[13px] font-extrabold">{formatPrice(total)}</span>
              </span>
            )}
          </button>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
