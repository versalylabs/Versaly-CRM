'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

type Item = {
  id: string;
  title: string;
  message: string;
  href?: string | null;
  read: boolean;
  createdAt: string;
};

export default function NotificationBell() {
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      await fetch('/api/notifications/alerts', { method: 'POST' });
      const res = await fetch('/api/notifications?limit=8');
      if (res.ok) {
        const data = await res.json();
        setItems(data.notifications || data || []);
      }
    } catch {}
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) load();
        }}
        className={`relative flex items-center justify-center rounded-xl p-2.5 transition-all duration-200 border ${
          open
            ? 'bg-sky-500/20 border-sky-400/40 text-sky-200 shadow-[0_0_15px_rgba(56,189,248,0.25)]'
            : 'bg-[#042438]/80 hover:bg-[#073652]/80 border-white/10 hover:border-white/20 text-slate-300 hover:text-white'
        }`}
        aria-label="Notifications"
        title="Notifications"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white shadow-[0_0_8px_rgba(244,63,94,0.6)]">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* React Bits Inspired Liquid Glass Notification Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 z-50 mt-2 w-96 max-w-[92vw] overflow-hidden rounded-2xl border border-sky-400/30 bg-gradient-to-b from-[#083c5d]/95 via-[#062e48]/95 to-[#042438]/98 p-4 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),0_0_25px_0_rgba(56,189,248,0.2),inset_0_1px_1px_0_rgba(255,255,255,0.25)] backdrop-blur-2xl"
          >
            {/* Top Specular Light Refraction Line (Liquid Glass effect) */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
            
            {/* Subtle Ambient Glow */}
            <div className="pointer-events-none absolute -top-16 -right-16 h-36 w-36 rounded-full bg-sky-500/15 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-36 w-36 rounded-full bg-cyan-500/10 blur-2xl" />

            {/* Panel Header */}
            <div className="relative mb-3 flex items-center justify-between pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-wide">Notifications</span>
                {unread > 0 && (
                  <span className="rounded-full bg-sky-500/20 border border-sky-400/30 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                    {unread} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/notifications"
                  onClick={() => setOpen(false)}
                  className="text-xs font-medium text-sky-400 hover:text-sky-300 transition hover:underline"
                >
                  View all →
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-white text-xs p-1 rounded-lg hover:bg-white/10 transition"
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Notification Items List */}
            <div className="relative max-h-[380px] space-y-2 overflow-y-auto pr-1">
              {items.length === 0 ? (
                <div className="py-10 text-center text-slate-400 space-y-2">
                  <span className="text-2xl block">✨</span>
                  <p className="text-xs font-semibold text-white">You are all caught up</p>
                  <p className="text-[11px] text-slate-400">No pending notifications or alerts.</p>
                </div>
              ) : (
                items.map((n) => (
                  <Link
                    key={n.id}
                    href={n.href || '/notifications'}
                    onClick={() => setOpen(false)}
                    className={`group relative block rounded-xl p-3 transition-all duration-200 border backdrop-blur-md overflow-hidden ${
                      !n.read
                        ? 'bg-gradient-to-r from-sky-500/15 via-[#073652]/75 to-[#062c44]/80 border-sky-400/40 hover:border-sky-300/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]'
                        : 'bg-[#052b42]/70 hover:bg-[#073652]/80 border-white/[0.08] hover:border-white/20 shadow-sm'
                    }`}
                  >
                    {/* Item Card Specular Top Line */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-xs text-white group-hover:text-cyan-200 transition flex items-center gap-1.5">
                        {!n.read && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
                        )}
                        <span>{n.title}</span>
                      </div>
                      {n.createdAt && (
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-300 leading-relaxed group-hover:text-slate-200 transition">
                      {n.message}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
