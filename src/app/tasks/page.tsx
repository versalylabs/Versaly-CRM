'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Lead = { id: string; contactName: string; companyName?: string | null; email: string };
type User = { id: string; name: string | null; email: string; role: string };
type Task = {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  completed: boolean;
  priority: string;
  createdAt: string;
  lead?: Lead | null;
  assignedToId?: string | null;
  assignedTo?: User | null;
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const dateKey = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const label = (p: string) => p.charAt(0).toUpperCase() + p.slice(1);

const glassInput =
  'w-full rounded-xl bg-[#042438] border border-white/10 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'all' | 'today' | 'upcoming' | 'overdue' | 'completed'>('all');
  const [priority, setPriority] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    leadId: '',
    dueDate: '',
    priority: 'medium',
    assignedToId: '',
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [t, l, u] = await Promise.all([fetch('/api/tasks'), fetch('/api/leads'), fetch('/api/users')]);
      if (!t.ok) throw new Error();
      const data = await t.json();
      setTasks(data);
      if (l.ok) setLeads(await l.json());
      if (u.ok) setUsers(await u.json());
    } catch {
      setError('Could not load tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        const q = search.toLowerCase();
        const matchesSearch =
          !q ||
          [t.title, t.description, t.lead?.contactName, t.lead?.companyName].some((v) =>
            v?.toLowerCase().includes(q)
          );
        const due = dateKey(t.dueDate);
        const today = todayKey();
        let matchesView = true;
        if (view === 'today') matchesView = !t.completed && due === today;
        if (view === 'upcoming') matchesView = !t.completed && !!due && due > today;
        if (view === 'overdue') matchesView = !t.completed && !!due && due < today;
        if (view === 'completed') matchesView = t.completed;
        return matchesSearch && matchesView && (!priority || t.priority === priority);
      }),
    [tasks, search, view, priority]
  );

  const counts = {
    all: tasks.filter((t) => !t.completed).length,
    today: tasks.filter((t) => !t.completed && dateKey(t.dueDate) === todayKey()).length,
    upcoming: tasks.filter((t) => !t.completed && dateKey(t.dueDate) > todayKey()).length,
    overdue: tasks.filter((t) => !t.completed && dateKey(t.dueDate) < todayKey()).length,
    completed: tasks.filter((t) => t.completed).length,
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const r = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setTasks((s) => [data, ...s]);
      setForm({ title: '', description: '', leadId: '', dueDate: '', priority: 'medium', assignedToId: '' });
      setShowForm(false);
    } catch (e: any) {
      setError(e.message || 'Failed to create task.');
    } finally {
      setSaving(false);
    }
  };

  const update = async (id: string, data: any) => {
    const old = tasks;
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...data } : t)));
    const r = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) {
      setTasks(old);
      setError('Could not update task.');
    } else {
      const updated = await r.json();
      setTasks((ts) => ts.map((t) => (t.id === id ? updated : t)));
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    const old = tasks;
    setTasks((ts) => ts.filter((t) => t.id !== id));
    const r = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      setTasks(old);
      setError('Could not delete task.');
    }
  };

  return (
    <div className="min-h-screen bg-[#053048] text-slate-100">
      <div className="container-custom py-8 space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Execution Hub</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-white tracking-tight">Tasks & Follow-ups</h1>
            <p className="text-sm text-slate-400 mt-1">
              Organize your pipeline action items, client deadlines, and scheduled outreach activities.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-sky-500/20 transition flex items-center gap-1.5"
            >
              <span>{showForm ? '✕ Close Form' : '+ New Task'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        {/* Top KPI Metrics Cards (React Bits Liquid Glass) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: 'Open Tasks', value: counts.all, color: 'text-white' },
            { label: 'Due Today', value: counts.today, color: 'text-cyan-300' },
            { label: 'Upcoming', value: counts.upcoming, color: 'text-sky-300' },
            { label: 'Overdue', value: counts.overdue, color: 'text-rose-400' },
            { label: 'Completed', value: counts.completed, color: 'text-emerald-400' },
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

        {/* Create Task Form (Liquid Glass Panel) */}
        {showForm && (
          <form
            onSubmit={createTask}
            className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#073652]/75 via-[#062c44]/80 to-[#042438]/90 p-6 shadow-[0_12px_36px_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl space-y-4"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/40 to-transparent" />

            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>📝</span>
                <span>Create New Task</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Assign an action item to a lead or team member.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Task Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Schedule discovery call with client"
                  className={glassInput}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Associated Lead</label>
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

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Assigned To</label>
                <select
                  value={form.assignedToId}
                  onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
                  className={glassInput}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id} className="bg-[#053048] text-white">
                      {u.name || u.email} · {u.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Due Date & Time</label>
                <input
                  type="datetime-local"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className={glassInput}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-300">Priority Level</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className={glassInput}
                >
                  <option value="low" className="bg-[#053048] text-white">Low Priority</option>
                  <option value="medium" className="bg-[#053048] text-white">Medium Priority</option>
                  <option value="high" className="bg-[#053048] text-white">High Priority</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-300">Notes & Instructions (Optional)</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Key deliverables, meeting links, or prospect context..."
                  className={`${glassInput} resize-none`}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-white/10">
              <button
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-sky-500/20 transition disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Task'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Tasks Container (React Bits Liquid Glass Panel) */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#073652]/75 via-[#062c44]/80 to-[#042438]/90 shadow-[0_12px_36px_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

          {/* Search & Filter Bar */}
          <div className="flex flex-col gap-3 border-b border-white/10 p-5 lg:flex-row">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks, descriptions, or leads..."
              className="flex-1 rounded-xl bg-[#042438] border border-white/10 px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 transition"
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="rounded-xl bg-[#042438] border border-white/10 px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-400 transition"
            >
              <option value="" className="bg-[#053048]">All Priorities</option>
              <option value="high" className="bg-[#053048]">High Priority</option>
              <option value="medium" className="bg-[#053048]">Medium Priority</option>
              <option value="low" className="bg-[#053048]">Low Priority</option>
            </select>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-5 py-3">
            {(['all', 'today', 'upcoming', 'overdue', 'completed'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                  view === v
                    ? 'bg-sky-500/20 text-cyan-300 border border-sky-400/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {v === 'all' ? 'All' : label(v)} ({counts[v]})
              </button>
            ))}
          </div>

          {/* Task Rows */}
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <div className="text-2xl animate-pulse">📋</div>
              <p>Loading tasks & follow-ups...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <div className="text-3xl">✓</div>
              <p className="text-sm font-semibold text-white">No tasks in this view</p>
              <p className="text-xs max-w-sm mx-auto">
                All caught up! Create a new task to keep client communications moving forward.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map((t) => {
                const overdue = !t.completed && !!t.dueDate && dateKey(t.dueDate) < todayKey();
                const priorityStyles: Record<string, string> = {
                  high: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
                  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                  low: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                };

                return (
                  <div
                    key={t.id}
                    className="group relative flex flex-col gap-4 p-5 md:flex-row md:items-center hover:bg-white/[0.02] transition"
                  >
                    <input
                      type="checkbox"
                      checked={t.completed}
                      onChange={(e) => update(t.id, { completed: e.target.checked })}
                      className="h-4 w-4 rounded border-white/20 bg-[#042438] text-sky-500 focus:ring-0 cursor-pointer"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={`font-semibold text-sm transition ${
                            t.completed ? 'text-slate-500 line-through' : 'text-white group-hover:text-cyan-200'
                          }`}
                        >
                          {t.title}
                        </p>
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            priorityStyles[t.priority] || 'bg-white/10 text-slate-300 border-white/15'
                          }`}
                        >
                          {label(t.priority)}
                        </span>
                      </div>

                      {t.description && (
                        <p className="mt-1 text-xs text-slate-300 leading-relaxed">{t.description}</p>
                      )}

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                        {t.lead && (
                          <Link
                            href={`/leads/${t.lead.id}`}
                            className="font-medium text-sky-400 hover:text-cyan-300 transition flex items-center gap-1"
                          >
                            <span>👤</span>
                            <span>{t.lead.contactName}</span>
                            {t.lead.companyName && <span>· {t.lead.companyName}</span>}
                          </Link>
                        )}
                        {t.assignedTo && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <span>Assignee:</span>
                            <span className="text-slate-200">{t.assignedTo.name || t.assignedTo.email}</span>
                          </span>
                        )}
                        {t.dueDate && (
                          <span
                            className={`flex items-center gap-1 ${
                              overdue ? 'font-semibold text-rose-400' : 'text-slate-400'
                            }`}
                          >
                            <span>📅</span>
                            <span>{new Date(t.dueDate).toLocaleString()}</span>
                            {overdue && (
                              <span className="rounded bg-rose-500/20 px-1 py-0.2 text-[10px] font-bold text-rose-300">
                                Overdue
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                      <select
                        value={t.priority}
                        onChange={(e) => update(t.id, { priority: e.target.value })}
                        className="rounded-xl border border-white/10 bg-[#042438] px-2.5 py-1 text-xs text-white focus:outline-none focus:border-sky-400 transition cursor-pointer"
                      >
                        <option value="high" className="bg-[#053048]">High</option>
                        <option value="medium" className="bg-[#053048]">Medium</option>
                        <option value="low" className="bg-[#053048]">Low</option>
                      </select>

                      <button
                        onClick={() => remove(t.id)}
                        className="rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 px-2.5 py-1 text-xs font-semibold transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
