'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/sidebar';
import CommandPalette from '@/components/CommandPalette';
import NotificationBell from '@/components/NotificationBell';
import SubscriptionStatusBanner from '@/components/SubscriptionStatusBanner';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isPublicPage =
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/landing') ||
    pathname === '/';

  if (isPublicPage) {
    return <main className="min-w-0 flex-1">{children}</main>;
  }

  return (
    <>
      <SubscriptionStatusBanner />
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      {/* Mobile Top Navigation Bar (< lg screens) */}
      <header className="fixed top-0 inset-x-0 z-20 flex h-14 items-center justify-between border-b border-white/10 bg-[#073652]/95 px-4 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Open Navigation Menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-sky-600 to-cyan-400 text-xs font-black text-white">
              V
            </span>
            <span className="text-xs font-bold text-white truncate max-w-[140px]">
              {session?.user?.organizationName || 'Versaly CRM'}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <CommandPalette />
          <NotificationBell />
        </div>
      </header>

      {/* Desktop Fixed Fast Action Tools (>= lg screens) */}
      <div className="hidden lg:block fixed right-20 top-4 z-40">
        <CommandPalette />
      </div>
      <div className="hidden lg:block fixed right-4 top-4 z-40">
        <NotificationBell />
      </div>

      <main className="min-w-0 flex-1 p-3 pt-16 sm:p-5 sm:pt-18 lg:ml-64 lg:p-8 lg:pt-14">
        {children}
      </main>
    </>
  );
}
