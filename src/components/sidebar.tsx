'use client';

import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';

// Clean, monochrome SVG outline icons (stroke="currentColor", fill="none")
const Icons = {
  dashboard: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 12a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
    </svg>
  ),
  leads: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  pipeline: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  outreach: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  email: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  whatsapp: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  calendar: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  integrations: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  proposals: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  tasks: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  activity: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  reports: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  notifications: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  automation: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  customerSuccess: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7.5A2.5 2.5 0 0117.5 10H15v2.5A2.5 2.5 0 0112.5 15H10v2.5A2.5 2.5 0 017.5 20H6a2 2 0 01-2-2v-1.5A2.5 2.5 0 016.5 14H9v-2.5A2.5 2.5 0 0111.5 9H14V6.5A2.5 2.5 0 0116.5 4H18a2 2 0 012 2v1.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 14A2.5 2.5 0 009 16.5M14 9a2.5 2.5 0 012.5 2.5" />
    </svg>
  ),
  settings: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  support: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 10a6 6 0 10-12 0v1a2 2 0 002 2h1v-3H8a4 4 0 118 0h-1v3h1a2 2 0 002-2v-1zM9 18h6" />
    </svg>
  ),
  users: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
};

const navItems = [
  { href: '/', label: 'Dashboard', icon: Icons.dashboard },
  { href: '/leads', label: 'Leads', icon: Icons.leads },
  { href: '/pipeline', label: 'Pipeline', icon: Icons.pipeline },
  { href: '/outreach', label: 'Outreach', icon: Icons.outreach },
  { href: '/email', label: 'Email', icon: Icons.email },
  { href: '/whatsapp', label: 'WhatsApp', icon: Icons.whatsapp },
  { href: '/calendar', label: 'Calendar', icon: Icons.calendar },
  { href: '/integrations', label: 'Integrations', icon: Icons.integrations },
  { href: '/proposals', label: 'Proposals', icon: Icons.proposals },
  { href: '/tasks', label: 'Tasks', icon: Icons.tasks },
  { href: '/activity', label: 'Activity', icon: Icons.activity },
  { href: '/reports', label: 'Reports', icon: Icons.reports },
  { href: '/customer-success', label: 'Customer Success', icon: Icons.customerSuccess },
  { href: '/notifications', label: 'Notifications', icon: Icons.notifications },
  { href: '/automation', label: 'Automation', icon: Icons.automation },
  { href: '/support', label: 'Support', icon: Icons.support },
  { href: '/settings', label: 'Settings', icon: Icons.settings },
];

export default function Sidebar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Do not show the CRM navigation on authentication pages.
  if (pathname.startsWith('/auth/')) {
    return null;
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden h-screen w-64 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:block">
      <div className="flex h-full flex-col p-5">
        {/* Workspace Brand Header */}
        <div className="shrink-0">
          <Link href="/" className="flex items-center space-x-3 group">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white font-black shadow-md shadow-sky-500/20 group-hover:bg-sky-500 transition">
              S
            </span>
            <div className="min-w-0">
              <span className="block truncate text-base font-bold text-gray-900 dark:text-white leading-tight">
                {session?.user?.organizationName || 'Straten CRM'}
              </span>
              <span className="block text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                Cloud CRM Platform
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Items with Outline Icons */}
        <nav className="mt-7 flex-1 space-y-1 overflow-y-auto pr-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  active
                    ? 'bg-sky-50 text-sky-700 shadow-sm dark:bg-sky-950/60 dark:text-sky-300'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-white'
                }`}
              >
                <span
                  className={`transition-colors ${
                    active
                      ? 'text-sky-600 dark:text-sky-400'
                      : 'text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300'
                  }`}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}

          {session?.user?.role === 'ADMIN' && (
            <Link
              href="/admin/users"
              className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                isActive('/admin/users')
                  ? 'bg-sky-50 text-sky-700 shadow-sm dark:bg-sky-950/60 dark:text-sky-300'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-white'
              }`}
            >
              <span
                className={`transition-colors ${
                  isActive('/admin/users')
                    ? 'text-sky-600 dark:text-sky-400'
                    : 'text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300'
                }`}
              >
                {Icons.users}
              </span>
              <span>Users & Roles</span>
            </Link>
          )}
        </nav>

        {/* SaaS Subscription Plan Callout */}
        <div className="my-2 rounded-xl bg-gradient-to-br from-sky-600 via-sky-700 to-sky-900 p-3.5 text-white shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200">
              {session?.user?.plan ? session.user.plan.replace('_', ' ') : 'Growth Pro'}
            </span>
            <span className="rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
              Active
            </span>
          </div>
          <p className="mt-1 text-[11px] text-sky-100 leading-snug">
            Monthly SaaS Subscription · Multi-user Workspace
          </p>
          <Link
            href="/settings/billing"
            className="mt-2.5 block w-full rounded-lg bg-white/95 py-1.5 text-center text-xs font-bold text-sky-950 shadow-sm hover:bg-white transition"
          >
            Manage Subscription
          </Link>
        </div>

        {/* User Profile */}
        <div className="mt-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          {status === 'loading' ? (
            <div className="text-xs text-gray-400 animate-pulse">Loading account...</div>
          ) : session?.user ? (
            <div className="flex items-center space-x-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                {session.user.name?.[0]?.toUpperCase() || 'U'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-gray-900 dark:text-white">
                  {session.user.name || 'User'}
                </p>
                <p className="truncate text-[10px] text-gray-500 dark:text-gray-400">
                  {session.user.email}
                </p>
              </div>
            </div>
          ) : (
            <Link href="/auth/signin" className="text-xs font-semibold text-sky-600 hover:underline">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
