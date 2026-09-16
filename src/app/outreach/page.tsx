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
  PENDING: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-50 text-blue-700',
  OPENED: 'bg-cyan-50 text-cyan-700',
  CLICKED: 'bg-purple-50 text-purple-700',
  REPLIED: 'bg-green-50 text-green-700',
  BOUNCED: 'bg-red-50 text-red-700',
};

function label(value: string) {
  return value.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function localDateTime(value: string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
    leadId: '', type: 'EMAIL', status: 'SENT', subject: '', content: '',
    sentAt: localDateTime(new Date().toISOString()), nextFollowUp: '',
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

  useEffect(() => { load(); }, [load]);

  const filteredLogs = useMemo(() => logs.filter((log) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [log.lead.contactName, log.lead.companyName || '', log.lead.email, log.subject || '', log.content || '']
      .some((value) => value.toLowerCase().includes(query));
    return matchesSearch && (!typeFilter || log.type === typeFilter) && (!statusFilter || log.status === statusFilter);
  }), [logs, search, typeFilter, statusFilter]);

  const summary = useMemo(() => ({
    total: logs.length,
    sent: logs.filter((log) => ['SENT', 'OPENED', 'CLICKED', 'REPLIED'].includes(log.status)).length,
    replied: logs.filter((log) => log.status === 'REPLIED').length,
    followUps: leads.filter((lead) => lead.nextFollowUp && new Date(lead.nextFollowUp) <= new Date()).length,
  }), [logs, leads]);

  async function saveOutreach(e: React.FormEvent) {
    e.preventDefault();
    if (!form.leadId) { setError('Please choose a lead before saving the outreach activity.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/outreach', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, sentAt: new Date(form.sentAt).toISOString(), nextFollowUp: form.nextFollowUp || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save outreach activity');
      setShowForm(false);
      setForm({ leadId: '', type: 'EMAIL', status: 'SENT', subject: '', content: '', sentAt: localDateTime(new Date().toISOString()), nextFollowUp: '' });
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to save outreach activity.');
    } finally { setSaving(false); }
  }

  async function updateStatus(id: string, status: string) {
    const previous = logs;
    setLogs((current) => current.map((log) => log.id === id ? { ...log, status } : log));
    try {
      const res = await fetch(`/api/outreach/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
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
    <div className="min-h-screen bg-gray-50">
      <div className="container-custom py-8 !max-w-none">
        <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Unified Communication History</h1>
            <p className="mt-1 text-sm text-gray-500">View Email, WhatsApp, calls, and manually logged conversations in one lead-centered history.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/email" className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">✉ Compose Email</Link>
            <Link href="/whatsapp" className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">💬 Send WhatsApp</Link>
            <button onClick={() => setShowForm((value) => !value)} className="btn-primary whitespace-nowrap">
              {showForm ? 'Close Form' : '+ Log Communication'}
            </button>
          </div>
        </div>

        <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['All Communications', summary.total, 'text-gray-900'],
            ['Email', channelSummary.email, 'text-blue-600'],
            ['WhatsApp', channelSummary.whatsapp, 'text-emerald-600'],
            ['Replies Received', channelSummary.replied, 'text-green-600'],
            ['Follow-ups Due', summary.followUps, 'text-amber-600'],
          ].map(([title, value, color]) => (
            <div key={String(title)} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
              <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {error && <div className="mb-5 flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><button onClick={() => setError('')} className="font-medium">Dismiss</button></div>}

        {showForm && (
          <form onSubmit={saveOutreach} className="mb-7 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5"><h2 className="text-lg font-semibold text-gray-800">Log Outreach Activity</h2><p className="mt-1 text-sm text-gray-500">Record a message, call, social-media contact, or other interaction.</p></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div><label className="mb-1 block text-xs font-medium text-gray-500">Lead *</label><select required value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="">Select a lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.contactName}{lead.companyName ? ` — ${lead.companyName}` : ''}</option>)}</select></div>
              <div><label className="mb-1 block text-xs font-medium text-gray-500">Outreach Type *</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">{TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select></div>
              <div><label className="mb-1 block text-xs font-medium text-gray-500">Status *</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">{STATUSES.map((status) => <option key={status}>{label(status)}</option>)}</select></div>
              <div><label className="mb-1 block text-xs font-medium text-gray-500">Date & Time</label><input type="datetime-local" value={form.sentAt} onChange={(e) => setForm({ ...form, sentAt: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs font-medium text-gray-500">Next Follow-up</label><input type="datetime-local" value={form.nextFollowUp} onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs font-medium text-gray-500">Subject</label><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Real estate marketing proposal" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
            </div>
            <div className="mt-4"><label className="mb-1 block text-xs font-medium text-gray-500">Notes / Message</label><textarea rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="What did you send or discuss? What happened next?" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></div>
            <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium">Cancel</button><button disabled={saving} className="btn-primary disabled:opacity-60">{saving ? 'Saving...' : 'Save Outreach'}</button></div>
          </form>
        )}

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-100 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="font-semibold text-gray-800">Outreach History</h2><p className="mt-1 text-sm text-gray-500">{filteredLogs.length} activity {filteredLogs.length === 1 ? 'record' : 'records'} shown</p></div>
            <div className="flex flex-col gap-2 sm:flex-row"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads or messages..." className="rounded-lg border border-gray-200 px-3 py-2 text-sm" /><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="">All types</option>{TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="">All statuses</option>{STATUSES.map((status) => <option key={status}>{label(status)}</option>)}</select></div>
          </div>

          {loading ? <div className="p-10 text-center text-sm text-gray-500">Loading outreach activity...</div> : filteredLogs.length === 0 ? (
            <div className="p-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl">📬</div><h3 className="mt-4 text-lg font-semibold text-gray-800">No outreach activity yet</h3><p className="mx-auto mt-2 max-w-md text-sm text-gray-500">Start tracking emails, calls, WhatsApp messages, and social-media outreach to build a complete prospect history.</p>{leads.length > 0 ? <button onClick={() => setShowForm(true)} className="btn-primary mt-5">Log Your First Outreach</button> : <Link href="/leads" className="btn-primary mt-5 inline-block">Add a Lead First</Link>}</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredLogs.map((log) => {
                const type = TYPES.find((item) => item.id === log.type);
                return <div key={log.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">{type?.icon || '•'}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link href={`/leads/${log.lead.id}`} className="font-semibold text-gray-800 hover:text-accent-600">{log.lead.contactName}</Link><span className="text-xs text-gray-400">{type?.label || label(log.type)}</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[log.status] || STATUS_STYLES.PENDING}`}>{label(log.status)}</span></div><p className="mt-1 truncate text-sm text-gray-600">{log.subject || log.content || 'No additional notes recorded.'}</p><p className="mt-1 text-xs text-gray-400">{log.lead.companyName || log.lead.email} · {formatDate(log.sentAt)}</p></div></div>
                  <div className="flex shrink-0 items-center gap-2"><select value={log.status} onChange={(e) => updateStatus(log.id, e.target.value)} className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs">{STATUSES.map((status) => <option key={status}>{label(status)}</option>)}</select><button onClick={() => deleteLog(log.id)} className="rounded-lg border border-red-100 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50">Delete</button></div>
                </div>;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
