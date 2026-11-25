'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PlanGate from '@/components/PlanGate';
import LineItemsEditor, { blankLine, toItems, type DraftLine } from '@/components/documents/LineItemsEditor';

type Lead = { id: string; contactName: string; companyName?: string | null; phone?: string | null };
type Inv = {
  id: string; number: string; kind: string; status: string; displayStatus: string; total: number; amountPaid: number; dueDate: string | null;
  issueDate: string; shareToken: string; etimsStatus: string; etimsError: string | null; leadId: string; lead: Lead; originalId: string | null;
};

const input = 'rounded-lg border border-gray-600 bg-transparent px-3 py-2 text-sm text-white';
const kes = (n: number) => `KES ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const BADGE: Record<string, [string, string]> = {
  DRAFT: ['Draft', 'bg-gray-500/20 text-gray-300'],
  SENT: ['Sent', 'bg-sky-500/15 text-sky-300'],
  PART_PAID: ['Part-paid', 'bg-amber-500/15 text-amber-300'],
  OVERDUE: ['Overdue', 'bg-red-500/15 text-red-300'],
  PART_PAID_OVERDUE: ['Part-paid, overdue', 'bg-red-500/15 text-red-300'],
  PAID: ['Paid', 'bg-emerald-500/15 text-emerald-300'],
  VOID: ['Void', 'bg-gray-500/20 text-gray-400'],
  ISSUED: ['Credit note', 'bg-violet-500/15 text-violet-300'],
};

export default function InvoicesPage() {
  return (
    <PlanGate feature="invoicing">
      <Invoices />
    </PlanGate>
  );
}

function Invoices() {
  const [rows, setRows] = useState<Inv[] | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState('open');
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [i, l] = await Promise.all([fetch('/api/invoices'), fetch('/api/leads')]);
    setRows(i.ok ? (await i.json()).invoices : []);
    if (l.ok) setLeads(await l.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(inv: Inv, url: string, method: string, body?: object, ok?: string) {
    setBusy(inv.id);
    setMsg(null);
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setMsg({ ok: false, text: d.error || 'Something went wrong.' }); return null; }
    if (ok) setMsg({ ok: true, text: ok });
    await load();
    return d;
  }

  async function share(inv: Inv, how: 'copy' | 'whatsapp') {
    if (inv.status === 'DRAFT' && !(await act(inv, `/api/invoices/${inv.id}`, 'PATCH', { action: 'send' }))) return;
    const url = `${window.location.origin}/i/${inv.shareToken}`;
    if (how === 'copy') { await navigator.clipboard.writeText(url); setMsg({ ok: true, text: `Link to ${inv.number} copied. The customer can view, download and pay it.` }); }
    else window.open(`https://wa.me/${(inv.lead.phone || '').replace(/\D/g, '').replace(/^0/, '254')}?text=${encodeURIComponent(`Hi ${inv.lead.contactName.split(' ')[0]}, here is invoice ${inv.number} for ${kes(inv.total)}. View and pay by M-Pesa: ${url}`)}`, '_blank');
  }

  const now = Date.now();
  const open = (r: Inv) => r.kind === 'INVOICE' && !['PAID', 'VOID'].includes(r.displayStatus);
  const visible = useMemo(() => (rows || []).filter((r) => {
    const okFilter = filter === 'all' || (filter === 'open' ? open(r) : filter === 'overdue' ? r.displayStatus.includes('OVERDUE') : filter === 'paid' ? r.displayStatus === 'PAID' : r.kind === 'CREDIT_NOTE');
    return okFilter && [r.number, r.lead.contactName, r.lead.companyName].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase());
  }), [rows, filter, query]); // eslint-disable-line react-hooks/exhaustive-deps
  const outstanding = (rows || []).filter(open).reduce((s, r) => s + Math.max(0, r.total - r.amountPaid), 0);
  const overdue = (rows || []).filter((r) => r.displayStatus.includes('OVERDUE')).reduce((s, r) => s + Math.max(0, r.total - r.amountPaid), 0);
  const paidMonth = (rows || []).filter((r) => r.displayStatus === 'PAID' && new Date(r.issueDate).getMonth() === new Date(now).getMonth()).reduce((s, r) => s + r.total, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Invoices</h1>
          <p className="mt-1 text-sm text-gray-400">Invoices your customers can pay by M-Pesa, registered with KRA eTIMS. <Link href="/settings/invoicing" className="text-brand-orange">Invoice settings</Link></p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary px-5 py-2.5 text-sm">+ New invoice</button>
      </div>
      {msg && <p className={`rounded-lg p-3 text-sm ${msg.ok ? 'bg-emerald-500/10 text-emerald-200' : 'bg-red-500/10 text-red-200'}`}>{msg.text}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-700 p-4"><p className="text-sm text-gray-400">Outstanding</p><p className="text-xl font-bold text-white">{kes(outstanding)}</p></div>
        <div className="rounded-2xl border border-gray-700 p-4"><p className="text-sm text-gray-400">Overdue</p><p className="text-xl font-bold text-red-300">{kes(overdue)}</p></div>
        <div className="rounded-2xl border border-gray-700 p-4"><p className="text-sm text-gray-400">Paid (issued this month)</p><p className="text-xl font-bold text-white">{kes(paidMonth)}</p></div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by number or customer" className={`min-w-[220px] flex-1 ${input}`} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className={input}>
          <option value="open">Unpaid</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="credit">Credit notes</option><option value="all">All</option>
        </select>
      </div>

      <section className="divide-y divide-white/10 rounded-2xl border border-gray-700">
        {!rows ? <p className="p-5 text-sm text-gray-400">Loading…</p> : visible.length ? visible.map((r) => {
          const [label, style] = BADGE[r.displayStatus] || [r.displayStatus, ''];
          const working = busy === r.id;
          return (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-semibold text-white">{r.number} <span className="font-normal text-gray-400">· <Link href={`/leads/${r.leadId}`} className="hover:underline">{r.lead.contactName}{r.lead.companyName ? `, ${r.lead.companyName}` : ''}</Link></span></p>
                <p className="text-xs text-gray-400">
                  {r.kind === 'INVOICE' ? `Due ${r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-KE') : '—'}` : 'Credit note'}
                  {r.amountPaid > 0 && r.kind === 'INVOICE' && ` · ${kes(r.amountPaid)} received`}
                  {' · '}<span className={r.etimsStatus === 'SUBMITTED' ? 'text-emerald-300' : r.etimsStatus === 'FAILED' ? 'text-red-300' : ''}>{r.etimsStatus === 'SUBMITTED' ? 'eTIMS ✓' : r.etimsStatus === 'FAILED' ? `eTIMS failed: ${r.etimsError || ''}` : 'Not on eTIMS'}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-white">{kes(r.total)}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{label}</span>
                {r.status !== 'VOID' && <>
                  <button disabled={working} onClick={() => share(r, 'copy')} className="rounded-lg border border-gray-600 px-2.5 py-1 text-xs text-gray-200">{r.status === 'DRAFT' ? 'Send & copy link' : 'Copy link'}</button>
                  <button disabled={working} onClick={() => share(r, 'whatsapp')} className="rounded-lg border border-emerald-700 px-2.5 py-1 text-xs text-emerald-300">WhatsApp</button>
                  {r.status !== 'DRAFT' && <a href={`/i/${r.shareToken}`} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-600 px-2.5 py-1 text-xs text-gray-200">View / PDF</a>}
                  {r.status !== 'DRAFT' && r.etimsStatus !== 'SUBMITTED' && <button disabled={working} onClick={() => act(r, `/api/invoices/${r.id}/etims`, 'POST', {}, `${r.number} registered with KRA eTIMS.`)} className="rounded-lg border border-brand-orange/60 px-2.5 py-1 text-xs text-brand-orange">{working ? 'Sending…' : r.etimsStatus === 'FAILED' ? 'Retry eTIMS' : 'Send to eTIMS'}</button>}
                  {r.kind === 'INVOICE' && r.status !== 'DRAFT' && <button disabled={working} onClick={() => confirm(`Issue a credit note for the whole of ${r.number}?`) && act(r, `/api/invoices/${r.id}/credit-note`, 'POST', {}, `Credit note issued for ${r.number}.`)} className="px-2 py-1 text-xs text-gray-400 hover:text-white">Credit note</button>}
                  {r.kind === 'INVOICE' && r.amountPaid === 0 && r.etimsStatus !== 'SUBMITTED' && <button disabled={working} onClick={() => confirm(`Void ${r.number}?`) && act(r, `/api/invoices/${r.id}`, 'PATCH', { action: 'void' }, `${r.number} voided.`)} className="px-2 py-1 text-xs text-gray-500 hover:text-red-300">Void</button>}
                </>}
              </div>
            </div>
          );
        }) : <p className="p-5 text-sm text-gray-400">No invoices here.</p>}
      </section>

      {creating && <NewInvoice leads={leads} onClose={() => setCreating(false)} onSaved={(n) => { setCreating(false); setMsg({ ok: true, text: `Invoice ${n} created as a draft.` }); load(); }} />}
    </div>
  );
}

function NewInvoice({ leads, onClose, onSaved }: { leads: Lead[]; onClose: () => void; onSaved: (number: string) => void }) {
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [f, setF] = useState({ leadId: '', dueDate: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10), notes: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setError('');
    const r = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, items: toItems(lines) }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(d.error || 'Could not create the invoice.');
    onSaved(d.invoice.number);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="my-8 w-full max-w-4xl space-y-4 rounded-2xl border border-gray-700 bg-ink-850 p-6">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-white">New invoice</h2><button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white">✕</button></div>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <label className="block text-sm text-gray-300">Customer
            <select value={f.leadId} onChange={(e) => setF({ ...f, leadId: e.target.value })} className={`mt-1 w-full ${input}`}>
              <option value="">Choose a customer…</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.contactName}{l.companyName ? ` · ${l.companyName}` : ''}</option>)}
            </select>
          </label>
          <label className="block text-sm text-gray-300">Due date<input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} className={`mt-1 w-full ${input}`} /></label>
        </div>
        <LineItemsEditor lines={lines} onChange={setLines} />
        <label className="block text-sm text-gray-300">Notes<textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className={`mt-1 w-full ${input}`} /></label>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm text-gray-400">Cancel</button><button disabled={busy} onClick={save} className="btn-primary px-5 py-2 text-sm disabled:opacity-50">{busy ? 'Saving…' : 'Create draft'}</button></div>
      </div>
    </div>
  );
}
