import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';
import Providers from '@/components/providers';
import AppShell from '@/components/AppShell';

const inter = Inter({ subsets: ['latin'] });

const glorase = localFont({
  src: [
    {
      path: '../../public/fonts/Glorase.woff',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Glorase-Italic.woff',
      weight: '400',
      style: 'italic',
    },
  ],
  variable: '--font-glorase',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Versaly CRM — Modern Subscription Platform',
  description: 'High-velocity cloud CRM with visual pipeline, automated outreach, and multi-tenant workspaces.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
    shortcut: '/favicon.ico',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.className} ${glorase.variable} dark`} style={{ colorScheme: 'dark' }}>
      <body className="flex min-h-screen bg-[#14213d] text-[#e5e5e5]">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}