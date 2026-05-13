import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import SiteFooter from '@/components/SiteFooter';
import CookieNotice from '@/components/CookieNotice';
import PHProvider from '@/components/PosthogProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Football Cheat Sheets: Real-time Lineups & Player Stats',
  description: 'Confirmed lineups, player form dots, and statistical analysis across every major competition. The analyst\'s edge before kick-off.',
  metadataBase: new URL('https://football-cheatsheet.vercel.app'),
  openGraph: {
    title: 'Football Cheat Sheets: Real-time Lineups & Player Stats',
    description: 'Confirmed lineups, player form dots, and statistical analysis across every major competition. The analyst\'s edge before kick-off.',
    url: 'https://football-cheatsheet.vercel.app',
    siteName: 'Cheat Sheets',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Football Cheat Sheets',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Football Cheat Sheets: Real-time Lineups & Player Stats',
    description: 'Confirmed lineups, player form dots, and statistical analysis across every major competition.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body style={{ background: '#080c14', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <PHProvider>
            <div style={{ flex: 1 }}>{children}</div>
            <SiteFooter />
            <CookieNotice />
          </PHProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
