'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut } from 'lucide-react';

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
  copilot: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
  inbox: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  ),
  users: (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

type NavGroup = {
  id: string;
  label: string;
  collapsible?: boolean;
  items: NavItem[];
};

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps = {}) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Define categorized navigation groups
  const navGroups: NavGroup[] = [
    {
      id: 'overview',
      label: 'Overview',
      collapsible: false,
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: Icons.dashboard },
      ],
    },
    {
      id: 'sales',
      label: 'Sales & Pipeline',
      collapsible: true,
      items: [
        { href: '/leads', label: 'Leads', icon: Icons.leads },
        { href: '/pipeline', label: 'Deals Pipeline', icon: Icons.pipeline },
        { href: '/copilot', label: 'AI Deal Copilot', icon: Icons.copilot },
        { href: '/proposals', label: 'Proposals', icon: Icons.proposals },
      ],
    },
    {
      id: 'communications',
      label: 'Communications',
      collapsible: true,
      items: [
        { href: '/inbox', label: 'Unified Inbox', icon: Icons.inbox },
        { href: '/outreach', label: 'Outreach', icon: Icons.outreach },
        { href: '/email', label: 'Email', icon: Icons.email },
        { href: '/whatsapp', label: 'WhatsApp', icon: Icons.whatsapp },
        { href: '/calendar', label: 'Calendar', icon: Icons.calendar },
      ],
    },
    {
      id: 'operations',
      label: 'Operations & Growth',
      collapsible: true,
      items: [
        { href: '/tasks', label: 'Tasks', icon: Icons.tasks },
        { href: '/activity', label: 'Activity Feed', icon: Icons.activity },
        { href: '/customer-success', label: 'Customer Success', icon: Icons.customerSuccess },
        { href: '/automation', label: 'Automation', icon: Icons.automation },
        { href: '/reports', label: 'Reports', icon: Icons.reports },
      ],
    },
    {
      id: 'workspace',
      label: 'Workspace & Config',
      collapsible: true,
      items: [
        { href: '/integrations', label: 'Integrations', icon: Icons.integrations },
        { href: '/notifications', label: 'Notifications', icon: Icons.notifications },
        { href: '/settings', label: 'Settings', icon: Icons.settings },
        ...(session?.user?.role === 'ADMIN'
          ? [{ href: '/admin/users', label: 'Users & Roles', icon: Icons.users }]
          : []),
        { href: '/support', label: 'Support Desk', icon: Icons.support },
      ],
    },
  ];

  // Accordion state: track which categories are open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    overview: true,
    sales: true,
    communications: true,
    operations: false,
    workspace: false,
  });

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // Auto-expand category when user navigates to a nested page
  useEffect(() => {
    navGroups.forEach((group) => {
      const hasActive = group.items.some((item) => isActive(item.href));
      if (hasActive && !openGroups[group.id]) {
        setOpenGroups((prev) => ({ ...prev, [group.id]: true }));
      }
    });
  }, [pathname]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Do not show the CRM navigation on authentication or public landing pages.
  if (pathname.startsWith('/auth/') || pathname === '/' || pathname === '/landing') {
    return null;
  }

  const renderContent = (isMobile = false) => (
    <div className="flex h-full flex-col p-4">
      {/* Workspace Brand Header */}
      <div className="shrink-0 pb-3 border-b border-white/10 flex items-center justify-between">
        <Link
          href="/dashboard"
          onClick={() => { if (isMobile) onCloseMobile?.(); }}
          className="flex items-center space-x-3 group min-w-0"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 text-white font-black shadow-md shadow-sky-500/25 group-hover:scale-105 transition-transform">
            V
          </span>
          <div className="min-w-0">
            <span className="block truncate text-sm font-bold text-white leading-tight">
              {session?.user?.organizationName || 'Versaly CRM'}
            </span>
            <span className="block text-[10px] font-semibold text-cyan-400">
              Cloud CRM Platform
            </span>
          </div>
        </Link>

        {isMobile && (
          <button
            onClick={onCloseMobile}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"
            aria-label="Close Navigation Menu"
          >
            ✕
          </button>
        )}
      </div>

      {/* Categorized Dropdown Navigation */}
      <nav className="mt-3 flex-1 space-y-2.5 overflow-y-auto pr-1">
        {navGroups.map((group) => {
          const isOpen = openGroups[group.id] ?? true;
          const hasActiveChild = group.items.some((item) => isActive(item.href));

          if (!group.collapsible) {
            return (
              <div key={group.id} className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => { if (isMobile) onCloseMobile?.(); }}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                        active
                          ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30 shadow-sm backdrop-blur-sm'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span className={`transition-colors ${active ? 'text-cyan-400' : 'text-gray-400 group-hover:text-gray-200'}`}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          }

          return (
            <div key={group.id} className="space-y-1">
              {/* Category Dropdown Toggle Header */}
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  hasActiveChild
                    ? 'text-cyan-300 bg-white/5'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2">
                  {hasActiveChild && <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />}
                  <span>{group.label}</span>
                </span>
                <motion.svg
                  animate={{ rotate: isOpen ? 90 : 0 }}
                  transition={{ duration: 0.18 }}
                  className="h-3.5 w-3.5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </motion.svg>
              </button>

              {/* Sub-items with Framer Motion Collapse */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden space-y-0.5 pl-1"
                  >
                    {group.items.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => { if (isMobile) onCloseMobile?.(); }}
                          className={`group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all ${
                            active
                              ? 'bg-sky-500/20 text-sky-200 border border-sky-400/30 shadow-sm backdrop-blur-sm'
                              : 'text-gray-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span className={`transition-colors ${active ? 'text-cyan-400' : 'text-gray-400 group-hover:text-gray-200'}`}>
                            {item.icon}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Platform Owner Section (Restricted strictly to isPlatformAdmin) */}
        {Boolean(session?.user?.isPlatformAdmin) && (
          <div className="pt-2 mt-2 border-t border-white/10 space-y-1">
            <span className="block px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              Platform Admin
            </span>
            <Link
              href="/platform"
              onClick={() => { if (isMobile) onCloseMobile?.(); }}
              className={`group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all ${
                isActive('/platform')
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 shadow-sm'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-emerald-400">
                <svg className="h-4.5 w-4.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </span>
              <span>Platform Console</span>
            </Link>
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { if (isMobile) onCloseMobile?.(); }}
              className="group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200 transition-all"
            >
              <span className="text-emerald-400">
                <svg className="h-4.5 w-4.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </span>
              <span>View Live Site ↗</span>
            </Link>
          </div>
        )}
      </nav>

      {/* Liquid Glass SaaS Subscription Plan Callout */}
      <div className="my-2 rounded-xl bg-gradient-to-br from-sky-600/30 via-[#073652]/80 to-sky-950/50 p-3 text-white border border-white/10 backdrop-blur-md shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
            {session?.user?.isPlatformAdmin
              ? 'Platform Master'
              : session?.user?.plan
              ? session.user.plan.replace('_', ' ')
              : 'Growth Pro'}
          </span>
          <span className="rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
            {session?.user?.isPlatformAdmin ? 'Lifetime' : 'Active'}
          </span>
        </div>
        <p className="mt-1 text-[10px] text-gray-300 leading-snug">
          {session?.user?.isPlatformAdmin
            ? 'System Owner Account · Full Platform Rights'
            : 'Multi-user SaaS Subscription'}
        </p>
        <Link
          href={session?.user?.isPlatformAdmin ? '/platform' : '/settings/billing'}
          onClick={() => { if (isMobile) onCloseMobile?.(); }}
          className="mt-2 block w-full rounded-lg bg-white/10 hover:bg-white/20 py-1 text-center text-[11px] font-bold text-white border border-white/15 transition backdrop-blur-xs"
        >
          {session?.user?.isPlatformAdmin ? 'Platform Controls' : 'Manage Subscription'}
        </Link>
      </div>

      {/* User Profile Footer & Sign Out */}
      <div className="pt-2.5 border-t border-white/10">
        {status === 'loading' ? (
          <div className="text-xs text-gray-400 animate-pulse">Loading account...</div>
        ) : session?.user ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] p-1.5 border border-white/5">
              <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-sky-500/30 to-cyan-400/20 text-xs font-black text-cyan-300 border border-cyan-400/40 shadow-inner">
                  {session.user.name?.[0]?.toUpperCase() || 'U'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white leading-tight">
                    {session.user.name || 'User'}
                  </p>
                  <p className="truncate text-[10px] text-gray-400 leading-tight">
                    {session.user.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Prominent Full-Width Sign Out Button */}
            <button
              type="button"
              onClick={async () => {
                if (isMobile) onCloseMobile?.();
                await signOut({ callbackUrl: '/' });
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-red-500/15 hover:border-red-400/40 py-2 text-center text-xs font-bold text-gray-300 hover:text-white transition-all duration-200 shadow-sm active:scale-[0.98] group"
            >
              <LogOut className="h-3.5 w-3.5 text-gray-400 group-hover:text-red-400 transition-colors" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <Link
            href="/auth/signin"
            onClick={() => { if (isMobile) onCloseMobile?.(); }}
            className="text-xs font-semibold text-cyan-400 hover:underline"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (>= lg screens) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden h-screen w-64 border-r border-white/10 bg-[#073652]/90 backdrop-blur-xl shadow-[4px_0_24px_rgba(0,0,0,0.28)] lg:block">
        {renderContent(false)}
      </aside>

      {/* Mobile & Tablet Slide-out Drawer (< lg screens) */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />

            {/* Slide-out Panel */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col border-r border-white/10 bg-[#073652] shadow-2xl"
            >
              {renderContent(true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
