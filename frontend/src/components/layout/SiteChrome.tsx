'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import TopBar from './TopBar';
import Header from './Header';
import Footer from './Footer';
import CartDrawer from './CartDrawer';
import LocationModal from './LocationModal';
import QuickCartAssistant from '../chat/QuickCartAssistant';

export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const isAdmin = pathname.startsWith('/admin');
  const isAuth = pathname === '/login' || pathname === '/register';

  if (isAdmin) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <Header />
      <main className={`min-w-0 flex-1 transition-[padding-right] duration-300 ${assistantOpen ? 'xl:pr-[410px]' : ''}`}>{children}</main>
      {!isAuth && <div className={`transition-[padding-right] duration-300 ${assistantOpen ? 'xl:pr-[410px]' : ''}`}><Footer /></div>}
      <CartDrawer />
      <LocationModal />
      <QuickCartAssistant open={assistantOpen} onOpenChange={setAssistantOpen} />
    </div>
  );
}
