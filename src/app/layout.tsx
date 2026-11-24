import './globals.css';
import type { Metadata } from 'next';
import { Inter, Quicksand } from 'next/font/google';
import Providers from '@/components/providers';
import AppShell from '@/components/AppShell';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

// Brand font for the logo and headings.
const quicksand = Quicksand({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-quicksand',
  display: 'swap',
});

// Icons and the link-preview image come from src/app (favicon.ico, icon.svg, apple-icon.png, opengraph-image.png).
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'https://versaly-crm.vercel.app'),
  title: {
    default: 'VersalyLabs CRM: leads, WhatsApp and follow-ups in one place',
    template: '%s | VersalyLabs CRM',
  },
  description: 'The CRM for Kenyan sales teams: manage leads, your pipeline and WhatsApp and email conversations, with automatic follow-ups.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.className} ${inter.variable} ${quicksand.variable} dark`} style={{ colorScheme: 'dark' }}>
      <body className="flex min-h-screen bg-ink-850 text-brand-cream">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}