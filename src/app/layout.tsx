import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Providers from '@/components/providers';
import AppShell from '@/components/AppShell';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Versaly CRM — Modern Subscription Platform',
  description: 'High-velocity cloud CRM with visual pipeline, automated outreach, and multi-tenant workspaces.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.className} dark`} style={{ colorScheme: 'dark' }}>
      <body className="flex min-h-screen bg-[#14213d] text-[#e5e5e5]">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}