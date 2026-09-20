'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  href?: string | null;
  read: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/notifications', { cache: 'no-store' });
      const d = await r.json();
      setItems(d.notifications || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const mark = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, read: true }),
    });
    load();
  };

  const markAll = async () => {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    load();
  };

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-[#053048] text-slate-100">
      <div className="container-custom py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Activity Alerts</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-white tracking-tight">Notifications</h1>
            <p className="text-sm text-slate-400 mt-1">
              Stay on top of updates across proposals, inbound leads, outreach replies, and assigned tasks.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={markAll}
              disabled={unreadCount === 0}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 hover:text-white transition disabled:opacity-40"
            >
              Mark all as read
            </button>
          </div>
        </div>

        {/* Notifications Container (React Bits Liquid Glass Panel) */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#073652]/75 via-[#062c44]/80 to-[#042438]/90 p-6 shadow-[0_12px_36px_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl space-y-4">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <div className="text-2xl animate-pulse">🔔</div>
              <p>Loading notification feed...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <div className="text-3xl">✓</div>
              <p className="text-sm font-semibold text-white">You&apos;re all caught up</p>
              <p className="text-xs max-w-sm mx-auto">
                No new unread alerts or pending notifications at this time.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((n) => (
                <div
                  key={n.id}
                  className={`group relative overflow-hidden rounded-xl border p-4 transition-all duration-200 backdrop-blur-md ${
                    n.read
                      ? 'border-white/5 bg-[#042438]/40 hover:bg-[#042438]/70'
                      : 'border-sky-400/30 bg-gradient-to-r from-sky-500/10 via-[#073652]/70 to-[#042438]/80 shadow-[0_4px_16px_rgba(56,189,248,0.1)]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {!n.read && (
                          <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shrink-0" />
                        )}
                        <h2 className="font-bold text-white text-xs group-hover:text-cyan-200 transition">
                          {n.title}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed pl-4">{n.message}</p>
                      <p className="text-[11px] text-slate-500 font-mono pl-4">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pl-4">
                      {n.href && (
                        <Link
                          onClick={() => mark(n.id)}
                          href={n.href}
                          className="px-3 py-1.5 rounded-lg border border-sky-400/30 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 text-xs font-semibold transition"
                        >
                          View Link
                        </Link>
                      )}
                      {!n.read && (
                        <button
                          onClick={() => mark(n.id)}
                          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 hover:text-white transition"
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
