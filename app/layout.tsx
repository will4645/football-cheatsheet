import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import SiteFooter from '@/components/SiteFooter';
import CookieNotice from '@/components/CookieNotice';
import PHProvider from '@/components/PosthogProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Football Cheat Sheets: Real-time Lineups & Player Stats',
  description: 'Confirmed lineups, player form dots, and statistical analysis across every major competition. The analyst\'s edge before kick-off.',
  metadataBase: new URL('https://cheatsheets.co.uk'),
  openGraph: {
    title: 'Football Cheat Sheets: Real-time Lineups & Player Stats',
    description: 'Confirmed lineups, player form dots, and statistical analysis across every major competition. The analyst\'s edge before kick-off.',
    url: 'https://cheatsheets.co.uk',
    siteName: 'Cheat Sheets',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Football Cheat Sheets: Real-time Lineups & Player Stats',
    description: 'Confirmed lineups, player form dots, and statistical analysis across every major competition.',
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
