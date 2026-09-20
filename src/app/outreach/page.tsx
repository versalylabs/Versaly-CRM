'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Lead = {
  id: string;
  contactName: string;
  companyName: string | null;
  email: string;
  nextFollowUp?: string | null;
};

type OutreachLog = {
  id: string;
  leadId: string;
  type: string;
  subject: string | null;
  content: string | null;
  status: string;
  sentAt: string;
  lead: Lead;
};

const TYPES = [
  { id: 'EMAIL', label: 'Email', icon: '✉️' },
  { id: 'PHONE_CALL', label: 'Phone Call', icon: '📞' },
  { id: 'WHATSAPP', label: 'WhatsApp', icon: '💬' },
  { id: 'LINKEDIN', label: 'LinkedIn', icon: 'in' },
  { id: 'INSTAGRAM', label: 'Instagram', icon: '◎' },
  { id: 'SMS', label: 'SMS', icon: '▣' },
  { id: 'OTHER', label: 'Other', icon: '•' },
];

const STATUSES = ['PENDING', 'SENT', 'OPENED', 'CLICKED', 'REPLIED', 'BOUNCED'];

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-white/10 text-slate-300 border-white/15',
  SENT: 'bg-sky-500/15 text-sky-300 border-sky-400/30',
  OPENED: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30',
  CLICKED: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  REPLIED: 'bg-green-500/15 text-green-300 border-green-400/30',
  BOUNCED: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

const glassInput =
  'w-full rounded-xl bg-[#042438] border border-white/10 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition';

function label(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function localDateTime(value: string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function OutreachPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [logs, setLogs] = useState<OutreachLog[]>([]);
  const [channelSummary, setChannelSummary] = useState({ email: 0, whatsapp: 0, replied: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    leadId: '',
    type: 'EMAIL',
    status: 'SENT',
    subject: '',
    content: '',
    sentAt: localDateTime(new Date().toISOString()),
    nextFollowUp: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [leadRes, logRes] = await Promise.all([
        fetch('/api/leads', { cache: 'no-store' }),
        fetch('/api/communications?limit=500', { cache: 'no-store' }),
      ]);
      const leadData = await leadRes.json();
      const logData = await logRes.json();
      if (!leadRes.ok || !logRes.ok) throw new Error(logData.error || 'Failed to load outreach data');
      setLeads(Array.isArray(leadData) ? leadData : []);
      setLogs(Array.isArray(logData.logs) ? logData.logs : []);
      setChannelSummary({
        email: Number(logData.summary?.email || 0),
        whatsapp: Number(logData.summary?.whatsapp || 0),
        replied: Number(logData.summary?.replied || 0),
      });
    } catch {
      setError('Could not load your outreach activity. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredLogs = useMemo(
    () =>
      logs.filter((log) => {
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          [
            log.lead.contactName,
            log.lead.companyName || '',
            log.lead.email,
            log.subject || '',
            log.content || '',
          ].some((value) => value.toLowerCase().includes(query));
        return (
          matchesSearch &&
          (!typeFilter || log.type === typeFilter) &&
          (!statusFilter || log.status === statusFilter)
        );
      }),
    [logs, search, typeFilter, statusFilter]
  );

  const summary = useMemo(
    () => ({
      total: logs.length,
      sent: logs.filter((log) => ['SENT', 'OPENED', 'CLICKED', 'REPLIED'].includes(log.status)).length,
      replied: logs.filter((log) => log.status === 'REPLIED').length,
      followUps: leads.filter((lead) => lead.nextFollowUp && new Date(lead.nextFollowUp) <= new Date()).length,
    }),
    [logs, leads]
  );

  async function saveOutreach(e: React.FormEvent) {
    e.preventDefault();
    if (!form.leadId) {
      setError('Please choose a lead before saving the outreach activity.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          sentAt: new Date(form.sentAt).toISOString(),
          nextFollowUp: form.nextFollowUp || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save outreach activity');
      setShowForm(false);
      setForm({
        leadId: '',
        type: 'EMAIL',
        status: 'SENT',
        subject: '',
        content: '',
        sentAt: localDateTime(new Date().toISOString()),
        nextFollowUp: '',
      });
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to save outreach activity.');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    const previous = logs;
    setLogs((current) => current.map((log) => (log.id === id ? { ...log, status } : log)));
    try {
      const res = await fetch(`/api/outreach/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setLogs(previous);
      setError('Could not update the outreach status.');
    }
  }

  async function deleteLog(id: string) {
    if (!confirm('Delete this outreach activity?')) return;
    const previous = logs;
    setLogs((current) => current.filter((log) => log.id !== id));
    try {
      const res = await fetch(`/api/outreach/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      setLogs(previous);
      setError('Could not delete the outreach activity.');
    }
  }

  return (
    <div className="min-h-screen bg-[#053048] text-slate-100">
      <div className="container-custom py-8 space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Multi-Channel Log</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-white tracking-tight">Communication History</h1>
            <p className="text-sm text-slate-400 mt-1">
              Centralized record of email, WhatsApp, phone calls, and manual touchpoints across all leads.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/email"
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 hover:text-white transition flex items-center gap-1.5"
            >
              <span>✉️</span>
              <span>Compose Email</span>
            </Link>
            <Link
              href="/whatsapp"
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 hover:text-white transition flex items-center gap-1.5"
            >
              <span>💬</span>
              <span>WhatsApp</span>
            </Link>
            <button
              onClick={() => setShowForm((value) => !value)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-sky-500/20 transition"
            >
              {showForm ? '✕ Close Form' : '+ Log Outreach'}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="font-bold hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Top KPI Metrics Cards (React Bits Liquid Glass) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: 'All Communications', value: summary.total, color: 'text-white' },
            { label: 'Email Messages', value: channelSummary.email, color: 'text-cyan-300' },
            { label: 'WhatsApp Chats', value: channelSummary.whatsapp, color: 'text-emerald-400' },
            { label: 'Replies Received', value: channelSummary.replied, color: 'text-sky-300' },
            { label: 'Follow-ups Due', value: summary.followUps, color: 'text-amber-400' },
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

        {/* Log Outreach Activity Form (Liquid Glass Panel) */}
        {showForm && (
          <form
            onSubmit={saveOutreach}
            className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#073652]/75 via-[#062c44]/80 to-[#042438]/90 p-6 shadow-[0_12px_36px_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl space-y-4"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/40 to-transparent" />

            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>📝</span>
                <span>Log Outreach Touchpoint</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Record a call, message, social touch, or meeting note with a lead.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Lead *</label>
                <select
                  required
                  value={form.leadId}
                  onChange={(e) => setForm({ ...form, leadId: e.target.value })}
                  className={glassInput}
                >
                  <option value="">Select a lead...</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id} className="bg-[#053048] text-white">
                      {lead.contactName}
                      {lead.companyName ? ` — ${lead.companyName}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Channel Type *</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className={glassInput}
                >
                  {TYPES.map((type) => (
                    <option key={type.id} value={type.id} className="bg-[#053048] text-white">
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Status *</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className={glassInput}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status} className="bg-[#053048] text-white">
                      {label(status)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Date & Time</label>
                <input
                  type="datetime-local"
                  value={form.sentAt}
                  onChange={(e) => setForm({ ...form, sentAt: e.target.value })}
                  className={glassInput}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Next Follow-up Date</label>
                <input
                  type="datetime-local"
                  value={form.nextFollowUp}
                  onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value })}
                  className={glassInput}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Subject Line / Topic</label>
                <input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="e.g. Discussed Q4 contract renewal"
                  className={glassInput}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Conversation Notes / Content</label>
              <textarea
                rows={3}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="What was discussed? What next step was agreed upon?"
                className={`${glassInput} resize-none`}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-sky-500/20 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Record'}
              </button>
            </div>
          </form>
        )}

        {/* History List (Liquid Glass Panel) */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#073652]/75 via-[#062c44]/80 to-[#042438]/90 shadow-[0_12px_36px_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

          {/* Search & Filter Bar */}
          <div className="flex flex-col gap-3 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Outreach History</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {filteredLogs.length} activity {filteredLogs.length === 1 ? 'entry' : 'entries'} shown
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search leads, subjects, or notes..."
                className="rounded-xl bg-[#042438] border border-white/10 px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 transition"
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-xl bg-[#042438] border border-white/10 px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-400 transition cursor-pointer"
              >
                <option value="" className="bg-[#053048]">All Channels</option>
                {TYPES.map((type) => (
                  <option key={type.id} value={type.id} className="bg-[#053048]">
                    {type.label}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl bg-[#042438] border border-white/10 px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-400 transition cursor-pointer"
              >
                <option value="" className="bg-[#053048]">All Statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status} className="bg-[#053048]">
                    {label(status)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <div className="text-2xl animate-pulse">📡</div>
              <p>Loading communication records...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <div className="text-3xl">📬</div>
              <p className="text-sm font-semibold text-white">No outreach activity found</p>
              <p className="text-xs max-w-sm mx-auto">
                Start tracking emails, WhatsApp chats, calls, and follow-ups to build complete prospect timelines.
              </p>
              {leads.length > 0 ? (
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow transition inline-block"
                >
                  Log Your First Outreach
                </button>
              ) : (
                <Link
                  href="/leads"
                  className="mt-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow transition inline-block"
                >
                  Add a Lead First
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredLogs.map((log) => {
                const type = TYPES.find((item) => item.id === log.type);
                return (
                  <div
                    key={log.id}
                    className="group relative flex flex-col gap-4 p-5 hover:bg-white/[0.02] transition lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex min-w-0 gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-white">
                        {type?.icon || '•'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/leads/${log.lead.id}`}
                            className="font-bold text-white text-xs group-hover:text-cyan-200 transition hover:underline"
                          >
                            {log.lead.contactName}
                          </Link>
                          <span className="text-[11px] text-slate-400">
                            {type?.label || label(log.type)}
                          </span>
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                              STATUS_STYLES[log.status] || STATUS_STYLES.PENDING
                            }`}
                          >
                            {label(log.status)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-300">
                          {log.subject || log.content || 'No additional notes recorded.'}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {log.lead.companyName || log.lead.email} · {formatDate(log.sentAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 self-start lg:self-center">
                      <select
                        value={log.status}
                        onChange={(e) => updateStatus(log.id, e.target.value)}
                        className="rounded-xl border border-white/10 bg-[#042438] px-2.5 py-1 text-xs text-white focus:outline-none focus:border-sky-400 transition cursor-pointer"
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status} className="bg-[#053048]">
                            {label(status)}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => deleteLog(log.id)}
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
