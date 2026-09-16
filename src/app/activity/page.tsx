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
  { value: 'all', label: 'All activity' },
  { value: 'lead_created', label: 'Leads added' },
  { value: 'outreach', label: 'Outreach' },
  { value: 'task_created', label: 'Tasks created' },
  { value: 'task_completed', label: 'Tasks completed' },
  { value: 'proposal_created', label: 'Proposals drafted' },
  { value: 'proposal_sent', label: 'Proposals sent' },
  { value: 'proposal_responded', label: 'Proposals responded' },
];

const TYPE_STYLE: Record<string, { dot: string; label: string }> = {
  lead_created: { dot: 'bg-blue-500', label: 'Lead' },
  outreach: { dot: 'bg-purple-500', label: 'Outreach' },
  task_created: { dot: 'bg-amber-500', label: 'Task' },
  task_completed: { dot: 'bg-emerald-500', label: 'Task done' },
  proposal_created: { dot: 'bg-gray-400', label: 'Proposal' },
  proposal_sent: { dot: 'bg-indigo-500', label: 'Proposal sent' },
  proposal_responded: { dot: 'bg-pink-500', label: 'Proposal response' },
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
    <div className="min-h-screen bg-gray-50">
      <div className="container-custom py-8">
        <div className="flex flex-col gap-1 mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Activity</h1>
          <p className="text-gray-600">A live timeline of everything happening across your leads, outreach, tasks, and proposals.</p>
        </div>

        {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}

        <div className="grid gap-4 md:grid-cols-4 mb-8">
          {[
            ['Total Events', events.length],
            ['Today', todayCount],
            ['Last 7 Days', weekCount],
            ['Leads Added', leadEvents],
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-xl bg-white p-5 shadow-soft">
              <p className="text-sm text-gray-500">{k}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{v}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-3 md:flex-row mb-6">
            <input
              placeholder="Search activity or leads..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 rounded-lg border p-3"
            />
            <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border p-3">
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="py-10 text-center text-gray-500">Loading activity...</p>
          ) : groups.length === 0 ? (
            <p className="py-10 text-center text-gray-500">No activity yet. As you add leads, log outreach, create tasks, and send proposals, it'll show up here.</p>
          ) : (
            <div className="space-y-8">
              {groups.map(([day, items]) => (
                <div key={day}>
                  <h3 className="text-sm font-semibold text-gray-500 mb-4">{day}</h3>
                  <div className="space-y-1 border-l-2 border-gray-100 ml-1.5">
                    {items.map((e) => {
                      const style = TYPE_STYLE[e.type] ?? { dot: 'bg-gray-400', label: e.type };
                      const content = (
                        <div className="flex gap-3 pl-5 py-3 -ml-[5px] hover:bg-gray-50 rounded-r-lg transition-colors">
                          <span className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${style.dot} -ml-[5px] ring-4 ring-white`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="text-sm font-medium text-gray-900 truncate">{e.title}</p>
                              <span className="text-xs text-gray-400 flex-shrink-0">{timeLabel(e.timestamp)}</span>
                            </div>
                            {e.detail && <p className="text-sm text-gray-500 mt-0.5">{e.detail}</p>}
                            <span className="inline-block mt-1.5 text-xs text-gray-400">{style.label}</span>
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
