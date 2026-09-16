'use client';

import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/sidebar';
import CommandPalette from '@/components/CommandPalette';
import NotificationBell from '@/components/NotificationBell';
import SubscriptionStatusBanner from '@/components/SubscriptionStatusBanner';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const isPublicPage =
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/pricing') ||
    (status === 'unauthenticated' && pathname === '/');

  if (isPublicPage) {
    return <main className="min-w-0 flex-1">{children}</main>;
  }

  return (
    <>
      <SubscriptionStatusBanner />
      <Sidebar />
      <main className="min-w-0 flex-1 p-6 pt-12 lg:ml-64 lg:p-8 lg:pt-14">{children}</main>
      <div className="fixed right-20 top-4 z-40">
        <CommandPalette />
      </div>
      <div className="fixed right-4 top-4 z-40">
        <NotificationBell />
      </div>
    </>
  );
}
