'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type ActivityEvent = {
  id: string;
  type:
    | 'lead_created'
    | 'outreach'
    | 'task_created'
    | 'task_completed'
    | 'proposal_created'
    | 'proposal_sent'
    | 'proposal_responded';
  status?: string;
  timestamp: string;
  leadId: string | null;
  leadName: string | null;
  companyName: string | null;
  title: string;
  detail: string | null;
};

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Activity' },
  { value: 'lead_created', label: 'Leads Added' },
  { value: 'outreach', label: 'Outreach Logged' },
  { value: 'task_created', label: 'Tasks Created' },
  { value: 'task_completed', label: 'Tasks Completed' },
  { value: 'proposal_created', label: 'Proposals Drafted' },
  { value: 'proposal_sent', label: 'Proposals Sent' },
  { value: 'proposal_responded', label: 'Proposals Responded' },
];

const TYPE_STYLE: Record<string, { dot: string; label: string; badge: string }> = {
  lead_created: {
    dot: 'bg-sky-400 ring-[#053048]',
    label: 'Lead',
    badge: 'border-sky-400/30 bg-sky-500/15 text-sky-300',
  },
  outreach: {
    dot: 'bg-cyan-400 ring-[#053048]',
    label: 'Outreach',
    badge: 'border-cyan-400/30 bg-cyan-500/15 text-cyan-300',
  },
  task_created: {
    dot: 'bg-amber-400 ring-[#053048]',
    label: 'Task',
    badge: 'border-amber-400/30 bg-amber-500/15 text-amber-300',
  },
  task_completed: {
    dot: 'bg-emerald-400 ring-[#053048]',
    label: 'Task Done',
    badge: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300',
  },
  proposal_created: {
    dot: 'bg-slate-400 ring-[#053048]',
    label: 'Proposal',
    badge: 'border-slate-400/30 bg-slate-500/15 text-slate-300',
  },
  proposal_sent: {
    dot: 'bg-sky-400 ring-[#053048]',
    label: 'Proposal Sent',
    badge: 'border-sky-400/30 bg-sky-500/15 text-sky-300',
  },
  proposal_responded: {
    dot: 'bg-emerald-400 ring-[#053048]',
    label: 'Proposal Response',
    badge: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300',
  },
};

function dayLabel(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function timeLabel(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(type === 'all' ? '/api/activity' : `/api/activity?type=${type}`);
      if (!r.ok) throw new Error();
      setEvents(await r.json());
    } catch {
      setError('Could not load activity. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) =>
      [e.title, e.detail, e.leadName, e.companyName].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [events, query]);

  const groups = useMemo(() => {
    const map = new Map<string, ActivityEvent[]>();
    for (const e of visible) {
      const key = dayLabel(e.timestamp);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries());
  }, [visible]);

  const todayCount = events.filter((e) => dayLabel(e.timestamp) === 'Today').length;
  const weekCount = events.filter((e) => Date.now() - new Date(e.timestamp).getTime() <= 7 * 24 * 60 * 60 * 1000).length;
  const leadEvents = events.filter((e) => e.type === 'lead_created').length;

  return (
    <div className="min-h-screen bg-[#053048] text-slate-100">
      <div className="container-custom py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Auditing & Events</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-white tracking-tight">Activity Timeline</h1>
            <p className="text-sm text-slate-400 mt-1">
              Real-time audit log of system events across leads, outreach, tasks, and proposals.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition flex items-center gap-1.5"
            >
              <span>↻</span>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        {/* Top KPI Summary Cards (React Bits Liquid Glass) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Events', value: events.length, color: 'text-white' },
            { label: 'Recorded Today', value: todayCount, color: 'text-cyan-300' },
            { label: 'Past 7 Days', value: weekCount, color: 'text-sky-300' },
            { label: 'New Leads Added', value: leadEvents, color: 'text-emerald-400' },
          ].map((item, idx) => (
            <div
              key={idx}
              className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-b from-[#073652]/70 to-[#042438]/80 p-5 shadow-[0_8px_24px_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.12)] backdrop-blur-xl"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{item.label}</p>
              <p className={`mt-2 text-2xl font-extrabold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Main Activity Timeline (React Bits Liquid Glass Panel) */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#073652]/75 via-[#062c44]/80 to-[#042438]/90 p-6 shadow-[0_12px_36px_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl space-y-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

          {/* Search & Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row items-center">
            <input
              placeholder="Search events, leads, or companies..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 w-full rounded-xl bg-[#042438] border border-white/10 px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 transition"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full sm:w-auto rounded-xl bg-[#042438] border border-white/10 px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-400 transition cursor-pointer"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-[#053048] text-white">
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <div className="text-2xl animate-pulse">⚡</div>
              <p>Loading activity stream...</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <div className="text-3xl">📂</div>
              <p className="text-sm font-semibold text-white">No activity logged yet</p>
              <p className="text-xs max-w-sm mx-auto">
                Actions you perform across leads, outreach, proposals, and tasks will automatically be recorded here.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {groups.map(([day, items]) => (
                <div key={day} className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300/90 pl-1">{day}</h3>
                  <div className="space-y-2 border-l border-white/10 ml-2 pl-4">
                    {items.map((e) => {
                      const style = TYPE_STYLE[e.type] ?? {
                        dot: 'bg-slate-400 ring-[#053048]',
                        label: e.type,
                        badge: 'border-white/10 bg-white/5 text-slate-300',
                      };

                      const content = (
                        <div className="group relative rounded-xl border border-white/5 hover:border-sky-400/30 bg-[#042438]/50 hover:bg-[#042438]/80 p-3.5 transition flex items-start gap-3">
                          <span
                            className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${style.dot} ring-4 ring-[#053048] shadow-sm`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                              <p className="text-xs font-bold text-white group-hover:text-cyan-200 transition truncate">
                                {e.title}
                              </p>
                              <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                                {timeLabel(e.timestamp)}
                              </span>
                            </div>
                            {e.detail && (
                              <p className="text-xs text-slate-300 mt-1 leading-relaxed">{e.detail}</p>
                            )}
                            <div className="mt-2 flex items-center gap-2">
                              <span
                                className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}
                              >
                                {style.label}
                              </span>
                              {e.leadName && (
                                <span className="text-[11px] text-sky-400 font-medium">
                                  {e.leadName} {e.companyName ? `(${e.companyName})` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );

                      return e.leadId ? (
                        <Link key={e.id} href={`/leads/${e.leadId}`} className="block">
                          {content}
                        </Link>
                      ) : (
                        <div key={e.id}>{content}</div>
                      );
                    })}
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
