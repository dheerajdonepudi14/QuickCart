import type { Metadata, Viewport } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import Providers from './providers';
import SiteChrome from '@/components/layout/SiteChrome';

export const metadata: Metadata = {
  title: { default: 'QuickCart — Groceries delivered in 10 minutes', template: '%s · QuickCart' },
  description:
    'Fresh fruits & vegetables, dairy, snacks, beverages, brews, skin care, grooming and farm supplies from your nearest dark store — delivered in minutes.',
};

export const viewport: Viewport = { themeColor: '#22A04B', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800&family=Raleway:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
