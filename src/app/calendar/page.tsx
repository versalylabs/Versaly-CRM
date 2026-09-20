'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Users,
  Phone,
  RotateCw,
  Home,
  Pin,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User as UserIcon,
  Plus,
} from 'lucide-react';

type Lead = { id: string; contactName: string; companyName?: string | null; email: string };
type User = { id: string; name: string | null; email: string; role: string };
type Event = {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  startAt: string;
  endAt?: string | null;
  location?: string | null;
  completed: boolean;
  reminderAt?: string | null;
  lead?: Lead | null;
  assignedTo?: User | null;
  assignedToId?: string | null;
};

const types = ['MEETING', 'CALL', 'FOLLOW_UP', 'PROPERTY_VIEWING', 'OTHER'];

function EventTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'MEETING':
      return <Users className="h-4 w-4 text-sky-400" />;
    case 'CALL':
      return <Phone className="h-4 w-4 text-emerald-400" />;
    case 'FOLLOW_UP':
      return <RotateCw className="h-4 w-4 text-amber-400" />;
    case 'PROPERTY_VIEWING':
      return <Home className="h-4 w-4 text-cyan-400" />;
    default:
      return <Pin className="h-4 w-4 text-slate-400" />;
  }
}

const fmt = (v?: string | null) =>
  v ? new Date(v).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const localInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const glassInput =
  'w-full rounded-xl bg-[#042438] border border-white/10 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition';

export default function CalendarPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'MEETING',
    startAt: localInput(new Date(Date.now() + 3600000)),
    endAt: '',
    location: '',
    reminderAt: '',
    leadId: '',
    assignedToId: '',
  });

  const canAssign = session?.user?.role === 'ADMIN' || session?.user?.role === 'MANAGER';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [e, l, u] = await Promise.all([fetch('/api/calendar'), fetch('/api/leads'), fetch('/api/users')]);
      if (!e.ok) throw new Error('Could not load calendar.');
      setEvents(await e.json());
      if (l.ok) setLeads(await l.json());
      if (u.ok) setUsers(await u.json());
    } catch (err: any) {
      setError(err.message || 'Could not load calendar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => (filter === 'ALL' ? events : events.filter((e) => e.type === filter)),
    [events, filter]
  );

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const r = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setEvents((s) => [...s, d].sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt)));
      setShow(false);
      setForm({
        title: '',
        description: '',
        type: 'MEETING',
        startAt: localInput(new Date(Date.now() + 3600000)),
        endAt: '',
        location: '',
        reminderAt: '',
        leadId: '',
        assignedToId: '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to schedule event.');
    } finally {
      setSaving(false);
    }
  };

  const complete = async (ev: Event) => {
    const old = events;
    setEvents((s) => s.map((x) => (x.id === ev.id ? { ...x, completed: !x.completed } : x)));
    const r = await fetch(`/api/calendar/${ev.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !ev.completed }),
    });
    if (!r.ok) {
      setEvents(old);
      setError('Could not update event.');
    } else {
      const d = await r.json();
      setEvents((s) => s.map((x) => (x.id === ev.id ? d : x)));
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    const old = events;
    setEvents((s) => s.filter((e) => e.id !== id));
    const r = await fetch(`/api/calendar/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      setEvents(old);
      setError('Could not delete event.');
    }
  };

  const upcoming = events.filter((e) => !e.completed && new Date(e.startAt) >= new Date()).length;
  const today = events.filter(
    (e) => new Date(e.startAt).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="min-h-screen bg-[#053048] text-slate-100">
      <div className="container-custom py-8 space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Time & Engagements</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-white tracking-tight">Calendar & Scheduling</h1>
            <p className="text-sm text-slate-400 mt-1">
              Coordinate discovery meetings, client review calls, and site visits with integrated prospect context.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShow((v) => !v)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-sky-500/20 transition flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>{show ? '✕ Close Form' : 'Schedule Event'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        {/* Top KPI Metrics Cards (React Bits Liquid Glass) */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Upcoming Events', value: upcoming, color: 'text-cyan-300' },
            { label: 'Scheduled Today', value: today, color: 'text-white' },
            { label: 'Completed Events', value: events.filter((e) => e.completed).length, color: 'text-emerald-400' },
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

        {/* Schedule Event Form (Liquid Glass Panel) */}
        {show && (
          <form
            onSubmit={create}
            className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#073652]/75 via-[#062c44]/80 to-[#042438]/90 p-6 shadow-[0_12px_36px_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl space-y-4"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/40 to-transparent" />

            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-cyan-300" />
                <span>Schedule New Event</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Book a calendar event tied to an account or lead.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Event Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Discovery demo call"
                  className={glassInput}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Event Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className={glassInput}
                >
                  {types.map((t) => (
                    <option key={t} value={t} className="bg-[#053048] text-white">
                      {t.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Start Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={form.startAt}
                  onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                  className={glassInput}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">End Date & Time</label>
                <input
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                  className={glassInput}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Location / Meeting URL</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Google Meet, Zoom link, or Office"
                  className={glassInput}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Reminder Time</label>
                <input
                  type="datetime-local"
                  value={form.reminderAt}
                  onChange={(e) => setForm({ ...form, reminderAt: e.target.value })}
                  className={glassInput}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Attach Lead</label>
                <select
                  value={form.leadId}
                  onChange={(e) => setForm({ ...form, leadId: e.target.value })}
                  className={glassInput}
                >
                  <option value="">No lead attached</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id} className="bg-[#053048] text-white">
                      {l.contactName} {l.companyName ? ` — ${l.companyName}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {canAssign && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Assigned Team Member</label>
                  <select
                    value={form.assignedToId}
                    onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
                    className={glassInput}
                  >
                    <option value="">Assign to me</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id} className="bg-[#053048] text-white">
                        {u.name || u.email} · {u.role}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-300">Agenda & Notes</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Agenda topics, client prerequisites, or discussion notes..."
                  className={`${glassInput} resize-none`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShow(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-sky-500/20 transition disabled:opacity-50"
              >
                {saving ? 'Scheduling...' : 'Schedule Event'}
              </button>
            </div>
          </form>
        )}

        {/* Events Container (React Bits Liquid Glass Panel) */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#073652]/75 via-[#062c44]/80 to-[#042438]/90 shadow-[0_12px_36px_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

          {/* Type Filter Pills */}
          <div className="flex flex-wrap gap-2 border-b border-white/10 p-5">
            {['ALL', ...types].map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                  filter === t
                    ? 'bg-sky-500/20 text-cyan-300 border border-sky-400/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {t === 'ALL' ? 'All Events' : t.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Event Items */}
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <div className="text-2xl animate-pulse">📅</div>
              <p>Loading calendar events...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-cyan-300">
                <CalendarIcon className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-white">No events scheduled</p>
              <p className="text-xs max-w-sm mx-auto">
                Schedule a meeting, call, viewing, or follow-up to keep your schedule organized.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map((ev) => (
                <div
                  key={ev.id}
                  className="group relative flex flex-col gap-4 p-5 hover:bg-white/[0.02] transition md:flex-row md:items-start"
                >
                  <input
                    type="checkbox"
                    checked={ev.completed}
                    onChange={() => complete(ev)}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-[#042438] text-sky-500 focus:ring-0 cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-1.5">
                        <EventTypeIcon type={ev.type} />
                      </span>
                      <p
                        className={`font-semibold text-sm transition ${
                          ev.completed ? 'text-slate-500 line-through' : 'text-white group-hover:text-cyan-200'
                        }`}
                      >
                        {ev.title}
                      </p>
                      <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                        {ev.type.replace('_', ' ')}
                      </span>
                    </div>

                    {ev.description && (
                      <p className="mt-1 text-xs text-slate-300 leading-relaxed">{ev.description}</p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1 text-cyan-300/80">
                        <Clock className="h-3 w-3 text-cyan-400" />
                        <span>{fmt(ev.startAt)}</span>
                        {ev.endAt && <span>→ {fmt(ev.endAt)}</span>}
                      </span>
                      {ev.location && (
                        <span className="inline-flex items-center gap-1 text-slate-300">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          <span>{ev.location}</span>
                        </span>
                      )}
                      {ev.lead && (
                        <Link
                          href={`/leads/${ev.lead.id}`}
                          className="inline-flex items-center gap-1 font-medium text-sky-400 hover:text-cyan-300 transition hover:underline"
                        >
                          <UserIcon className="h-3 w-3" />
                          <span>
                            {ev.lead.contactName} {ev.lead.companyName ? `· ${ev.lead.companyName}` : ''}
                          </span>
                        </Link>
                      )}
                      {ev.assignedTo && (
                        <span className="text-slate-400">
                          Assigned: <strong className="text-slate-300">{ev.assignedTo.name || ev.assignedTo.email}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => remove(ev.id)}
                    className="rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 px-2.5 py-1 text-xs font-semibold transition shrink-0 self-start"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
