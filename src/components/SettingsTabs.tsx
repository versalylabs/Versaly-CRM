'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

/** One tab bar for every settings page, so each setting is reachable from any of them. */
const TABS: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: '/settings', label: 'Profile' },
  { href: '/admin/users', label: 'Team', adminOnly: true },
  { href: '/settings/pipeline', label: 'Pipeline' },
  { href: '/settings/custom-fields', label: 'Custom fields' },
  { href: '/settings/lead-capture', label: 'Lead capture' },
  { href: '/settings/integrations', label: 'Email & WhatsApp' },
  { href: '/settings/messaging', label: 'Messaging & SMS' },
  { href: '/settings/invoicing', label: 'Invoicing' },
  { href: '/integrations', label: 'Developer API' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/settings/billing', label: 'Billing' },
];

export default function SettingsTabs() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  return (
    <nav aria-label="Settings" className="mb-6 flex gap-1 overflow-x-auto border-b border-white/10 pb-px">
      {TABS.filter((t) => !t.adminOnly || isAdmin).map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
              active ? 'border-brand-orange text-white' : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
