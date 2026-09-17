'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type SearchItem = {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  href: string;
  icon: string;
};

const QUICK_ACTIONS: SearchItem[] = [
  { id: 'quick-new-lead', type: 'Quick action', title: 'Create new lead', subtitle: 'Open the leads workspace', href: '/leads', icon: '➕' },
  { id: 'quick-new-task', type: 'Quick action', title: 'Create new task', subtitle: 'Open task management', href: '/tasks', icon: '➕' },
  { id: 'quick-new-event', type: 'Quick action', title: 'Schedule event', subtitle: 'Open calendar scheduling', href: '/calendar', icon: '📅' },
  { id: 'quick-new-proposal', type: 'Quick action', title: 'Create proposal', subtitle: 'Open proposals', href: '/proposals', icon: '📋' },
  { id: 'quick-log-outreach', type: 'Quick action', title: 'Log outreach', subtitle: 'Open outreach workspace', href: '/outreach', icon: '📝' },
  { id: 'quick-compose-email', type: 'Quick action', title: 'Compose email', subtitle: 'Open email center', href: '/email', icon: '✉️' },
  { id: 'quick-compose-whatsapp', type: 'Quick action', title: 'Compose WhatsApp message', subtitle: 'Open WhatsApp workspace', href: '/whatsapp', icon: '💬' },
  { id: 'quick-automation', type: 'Quick action', title: 'Manage automation workflows', subtitle: 'Open follow-up sequences and workflow rules', href: '/automation', icon: '⚡' },
];

export default function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const visibleItems = useMemo(() => {
    if (!query.trim()) return QUICK_ACTIONS;
    return results;
  }, [query, results]);

  const close = () => {
    setOpen(false);
    setQuery('');
    setResults([]);
    setActiveIndex(0);
  };

  const select = (item: SearchItem) => {
    close();
    router.push(item.href);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === 'Escape' && open) close();
      if (!open) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((value) => Math.min(value + 1, Math.max(visibleItems.length - 1, 0)));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((value) => Math.max(value - 1, 0));
      }
      if (event.key === 'Enter' && visibleItems[activeIndex]) {
        event.preventDefault();
        select(visibleItems[activeIndex]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, visibleItems, activeIndex]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      setActiveIndex(0);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();
        setResults(Array.isArray(data.results) ? data.results : []);
        setActiveIndex(0);
      } catch (error: any) {
        if (error?.name !== 'AbortError') setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  if (pathname.startsWith('/auth/') || pathname === '/' || pathname === '/landing') return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden min-w-[260px] items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow-sm hover:bg-gray-50 lg:flex"
        aria-label="Open global search"
      >
        <span>🔎 Search CRM...</span>
        <kbd className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs">Ctrl K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 pt-[10vh]" onMouseDown={close}>
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Global search"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
              <span>🔎</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search leads, tasks, proposals, calendar, outreach, users, pages..."
                className="min-w-0 flex-1 border-0 bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400"
              />
              {loading && <span className="text-xs text-gray-500">Searching...</span>}
              <kbd className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500">Esc</kbd>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {!query.trim() && <div className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Quick actions</div>}
              {query.trim() && visibleItems.length > 0 && <div className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Search results</div>}

              {visibleItems.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => select(item)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${index === activeIndex ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg">{item.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">{item.title}</span>
                    {item.subtitle && <span className="block truncate text-xs text-gray-500">{item.subtitle}</span>}
                  </span>
                  <span className="hidden rounded bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-500 sm:block">{item.type}</span>
                </button>
              ))}

              {query.trim() && !loading && visibleItems.length === 0 && (
                <div className="px-6 py-10 text-center">
                  <div className="text-3xl">🔎</div>
                  <p className="mt-3 font-medium text-gray-900">No matching CRM records</p>
                  <p className="mt-1 text-sm text-gray-500">Try a lead name, company, task, proposal, event, user, or page.</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2 text-xs text-gray-500">
              <span>↑ ↓ to navigate • Enter to open</span>
              <span>Esc to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
