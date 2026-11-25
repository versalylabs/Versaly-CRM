'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { planHasFeature } from '@/lib/plans';
import type { LineItem } from '@/lib/quotes';
import LineItemsEditor, { blankLine, toDraft, toItems, type DraftLine } from '@/components/documents/LineItemsEditor';

type Lead = { id: string; contactName: string; companyName?: string | null; phone?: string | null };
type Quote = {
  id: string; leadId: string; title: string; description?: string | null; value?: number | null; status: string; number?: string | null;
  items?: LineItem[] | null; validUntil?: string | null; terms?: string | null; shareToken?: string | null; acceptedName?: string | null;
  acceptedAt?: string | null; createdAt: string; lead: Lead; invoice?: { id: string; number: string } | null;
};

const input = 'rounded-lg border border-gray-600 bg-transparent px-3 py-2 text-sm text-white';
const kes = (n?: number | null) => `KES ${(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const STATUS: Record<string, [string, string]> = {
  draft: ['Draft', 'bg-gray-500/20 text-gray-300'],
  sent: ['Sent', 'bg-sky-500/15 text-sky-300'],
  accepted: ['Accepted', 'bg-emerald-500/15 text-emerald-300'],
  rejected: ['Declined', 'bg-red-500/15 text-red-300'],
};

export default function QuotesPage() {
  const { data: session } = useSession();
  const canInvoice = Boolean(session?.user?.isPlatformAdmin || planHasFeature(session?.user?.plan, 'invoicing'));
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Quote | 'new' | null>(null);

  const load = useCallback(async () => {
    try {
      const [q, l] = await Promise.all([fetch('/api/proposals'), fetch('/api/leads')]);
      if (!q.ok || !l.ok) throw new Error();
      setQuotes(await q.json());
      setLeads(await l.json());
    } catch {
      setError('Could not load quotes. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const link = (q: Quote) => (q.shareToken ? `${window.location.origin}/q/${q.shareToken}` : '');

  async function patch(q: Quote, body: object) {
    const r = await fetch(`/api/proposals/${q.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Could not update the quote.');
    await load();
  }

  async function share(q: Quote, how: 'copy' | 'whatsapp') {
    setError('');
    try {
      if (q.status === 'draft') await patch(q, { status: 'sent' });
      const url = link(q);
      if (how === 'copy') { await navigator.clipboard.writeText(url); setNotice(`Link to ${q.number} copied. Send it to your client to accept online.`); }
      else window.open(`https://wa.me/${(q.lead.phone || '').replace(/\D/g, '').replace(/^0/, '254')}?text=${encodeURIComponent(`Hi ${q.lead.contactName.split(' ')[0]}, here is your quote ${q.number}: ${url}`)}`, '_blank');
    } catch (e: any) { setError(e.message); }
  }

  async function invoice(q: Quote) {
    setError('');
    const r = await fetch(`/api/proposals/${q.id}/invoice`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setError(d.error || 'Could not create the invoice.');
    setNotice(`Invoice ${d.invoice.number} created as a draft. Review and send it from Invoices.`);
    load();
  }

  async function remove(q: Quote) {
    if (!confirm(`Delete ${q.number || q.title}?`)) return;
    const r = await fetch(`/api/proposals/${q.id}`, { method: 'DELETE' });
    if (r.ok) load(); else setError('Could not delete the quote.');
  }

  const visible = useMemo(() => quotes.filter((q) => (filter === 'all' || q.status === filter)
    && [q.number, q.title, q.lead?.contactName, q.lead?.companyName].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase())), [quotes, filter, query]);
  const quoted = quotes.filter((q) => q.status !== 'rejected').reduce((s, q) => s + (q.value || 0), 0);
  const won = quotes.filter((q) => q.status === 'accepted').reduce((s, q) => s + (q.value || 0), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Quotes</h1>
          <p className="mt-1 text-sm text-gray-400">Itemised quotes with VAT that clients accept online, then turn into invoices.</p>
        </div>
        <button onClick={() => setEditing('new')} className="btn-primary px-5 py-2.5 text-sm">+ New quote</button>
      </div>
      {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      {notice && <p className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-700 p-4"><p className="text-sm text-gray-400">Open and won quotes</p><p className="text-xl font-bold text-white">{kes(quoted)}</p></div>
        <div className="rounded-2xl border border-gray-700 p-4"><p className="text-sm text-gray-400">Accepted</p><p className="text-xl font-bold text-white">{kes(won)}</p></div>
        <div className="rounded-2xl border border-gray-700 p-4"><p className="text-sm text-gray-400">Waiting for the client</p><p className="text-xl font-bold text-white">{quotes.filter((q) => q.status === 'sent').length}</p></div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search quotes or customers" className={`min-w-[220px] flex-1 ${input}`} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className={input}>
          <option value="all">All statuses</option>
          {Object.entries(STATUS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      <section className="divide-y divide-white/10 rounded-2xl border border-gray-700">
        {loading ? <p className="p-5 text-sm text-gray-400">Loading…</p> : visible.length ? visible.map((q) => (
          <div key={q.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div className="min-w-0">
              <p className="font-semibold text-white">{q.number && <span className="mr-2 text-gray-400">{q.number}</span>}{q.title}</p>
              <p className="text-xs text-gray-400">
                <Link href={`/leads/${q.leadId}`} className="hover:underline">{q.lead?.contactName}{q.lead?.companyName ? ` · ${q.lead.companyName}` : ''}</Link>
                {q.acceptedName && <> · accepted by {q.acceptedName}</>}
                {q.invoice && <> · <Link href="/invoices" className="text-brand-orange hover:underline">invoice {q.invoice.number}</Link></>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-white">{kes(q.value)}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[q.status]?.[1] || ''}`}>{STATUS[q.status]?.[0] || q.status}</span>
              {q.shareToken && <>
                <button onClick={() => share(q, 'copy')} className="rounded-lg border border-gray-600 px-2.5 py-1 text-xs text-gray-200">Copy client link</button>
                <button onClick={() => share(q, 'whatsapp')} className="rounded-lg border border-emerald-700 px-2.5 py-1 text-xs text-emerald-300">WhatsApp</button>
                {q.status !== 'draft' && <a href={`/q/${q.shareToken}`} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-600 px-2.5 py-1 text-xs text-gray-200">View / PDF</a>}
              </>}
              {canInvoice && q.items?.length && !q.invoice && q.status !== 'rejected' ? <button onClick={() => invoice(q)} className="rounded-lg border border-brand-orange/60 px-2.5 py-1 text-xs text-brand-orange">Create invoice</button> : null}
              {!q.acceptedAt && <button onClick={() => setEditing(q)} className="px-2 py-1 text-xs text-gray-400 hover:text-white">Edit</button>}
              <button onClick={() => remove(q)} className="px-2 py-1 text-xs text-gray-500 hover:text-red-300">Delete</button>
            </div>
          </div>
        )) : <p className="p-5 text-sm text-gray-400">No quotes yet.</p>}
      </section>

      {editing && <QuoteEditor quote={editing === 'new' ? null : editing} leads={leads} onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); setNotice(msg); load(); }} />}
    </div>
  );
}

function QuoteEditor({ quote, leads, onClose, onSaved }: { quote: Quote | null; leads: Lead[]; onClose: () => void; onSaved: (msg: string) => void }) {
  // Older proposals without line items open as one line carrying their value (no VAT), so totals don't change.
  const start = quote?.items?.length ? toDraft(quote.items) : quote?.value ? [{ ...blankLine(), description: quote.title, unitPrice: String(quote.value), taxType: 'D' as const }] : [blankLine()];
  const [lines, setLines] = useState<DraftLine[]>(start);
  const [f, setF] = useState({ leadId: quote?.leadId || '', title: quote?.title || '', validUntil: quote?.validUntil?.slice(0, 10) || new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), terms: quote?.terms || quote?.description || '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(send: boolean) {
    setBusy(true);
    setError('');
    const body = { ...f, items: toItems(lines), ...(send ? { status: 'sent' } : quote ? {} : { status: 'draft' }) };
    const r = await fetch(quote ? `/api/proposals/${quote.id}` : '/api/proposals', { method: quote ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(d.error || 'Could not save the quote.');
    onSaved(send ? `Quote ${d.number || ''} saved and marked sent. Use "Copy client link" to share it.` : `Quote ${d.number || ''} saved as a draft.`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="my-8 w-full max-w-4xl space-y-4 rounded-2xl border border-gray-700 bg-ink-850 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{quote ? `Edit ${quote.number || 'quote'}` : 'New quote'}</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-gray-300">Customer
            <select value={f.leadId} onChange={(e) => setF({ ...f, leadId: e.target.value })} className={`mt-1 w-full ${input}`}>
              <option value="">Choose a customer…</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.contactName}{l.companyName ? ` · ${l.companyName}` : ''}</option>)}
            </select>
          </label>
          <label className="block text-sm text-gray-300">Title<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Website redesign" className={`mt-1 w-full ${input}`} /></label>
        </div>
        <LineItemsEditor lines={lines} onChange={setLines} />
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <label className="block text-sm text-gray-300">Valid until<input type="date" value={f.validUntil} onChange={(e) => setF({ ...f, validUntil: e.target.value })} className={`mt-1 w-full ${input}`} /></label>
          <label className="block text-sm text-gray-300">Notes and terms<textarea rows={3} value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value })} placeholder="e.g. 50% deposit to start, balance on delivery." className={`mt-1 w-full ${input}`} /></label>
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button disabled={busy} onClick={() => save(false)} className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-200 disabled:opacity-50">Save draft</button>
          <button disabled={busy} onClick={() => save(true)} className="btn-primary px-5 py-2 text-sm disabled:opacity-50">{busy ? 'Saving…' : 'Save and send'}</button>
        </div>
      </div>
    </div>
  );
}
