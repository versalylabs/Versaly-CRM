'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { planHasFeature } from '@/lib/plans';

const input = 'rounded-lg border border-gray-600 px-3 py-2 text-sm';
const kes = (n: number) => `KES ${n.toLocaleString('en-US')}`;
const when = (s: string) => new Date(s).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export const STATUS_STYLE: Record<string, string> = {
  PAID: 'bg-emerald-500/15 text-emerald-300',
  PENDING: 'bg-amber-500/15 text-amber-300',
  REQUESTED: 'bg-sky-500/15 text-sky-300',
  FAILED: 'bg-red-500/15 text-red-300',
  CANCELLED: 'bg-gray-500/20 text-gray-300',
};
export const STATUS_LABEL: Record<string, string> = { PAID: 'Paid', PENDING: 'Waiting for customer', REQUESTED: 'Link sent', FAILED: 'Failed', CANCELLED: 'Cancelled' };

type Payment = { id: string; status: string; amount: number; source: string; description: string | null; mpesaReceipt: string | null; resultDesc: string | null; phone: string | null; linkToken: string | null; createdAt: string; paidAt: string | null };
type Installment = { id: string; dueDate: string; amount: number; paidAmount: number };
type Plan = { id: string; title: string; status: string; totalAmount: number; installments: Installment[] };
type Account = { id: string; type: string; shortcode: string; tillNumber: string | null; environment: string };

/** The "Payments" tab on a lead: request money by M-Pesa, share a pay link, and manage instalment plans. */
export default function LeadPayments({ leadId, phone, paymentRef }: { leadId: string; phone?: string | null; paymentRef?: string | null }) {
  const { data: session } = useSession();
  const canPlans = Boolean(session?.user?.isPlatformAdmin || planHasFeature(session?.user?.plan, 'instalment_plans'));
  const [payments, setPayments] = useState<Payment[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [form, setForm] = useState({ amount: '', phone: phone || '', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [watching, setWatching] = useState<string | null>(null);
  const [ref, setRef] = useState(paymentRef || '');

  const load = useCallback(async () => {
    const [p, pl, a] = await Promise.all([
      fetch(`/api/payments?leadId=${leadId}`).then((r) => (r.ok ? r.json() : { payments: [] })),
      fetch(`/api/payments/plans?leadId=${leadId}`).then((r) => (r.ok ? r.json() : { plans: [] })),
      fetch('/api/payments/accounts').then((r) => (r.ok ? r.json() : { accounts: [] })),
    ]);
    setPayments(p.payments || []);
    setPlans(pl.plans || []);
    setAccounts(a.accounts || []);
    const withRef = (p.payments || []).find((x: any) => x.accountRef);
    if (withRef) setRef((current) => current || withRef.accountRef);
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  // Live status for a prompt we just sent: poll until the customer answers (about 3 minutes max).
  useEffect(() => {
    if (!watching) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      const r = await fetch(`/api/payments/${watching}`);
      const d = r.ok ? await r.json() : null;
      if (!d?.payment || d.payment.status !== 'PENDING' || tries > 45) {
        clearInterval(timer);
        setWatching(null);
        load();
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [watching, load]);

  async function request(method: 'stk' | 'link') {
    setBusy(true);
    setError('');
    setLink('');
    try {
      const r = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId, amount: form.amount, phone: form.phone, description: form.description, method }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Request failed');
      if (method === 'link') setLink(d.link);
      else setWatching(d.payment.id);
      setForm({ ...form, amount: '', description: '' });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    await fetch(`/api/payments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel' }) });
    load();
  }

  const account = accounts?.[0];
  const paid = payments.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);

  if (accounts && !accounts.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-600 p-6 text-center">
        <p className="font-semibold text-white">Collect payments by M-Pesa</p>
        <p className="mt-1 text-sm text-gray-400">Connect your Paybill or Till once, then send payment prompts and links from any customer.</p>
        <Link href="/payments?tab=settings" className="btn-primary mt-4 inline-block px-5 py-2 text-sm">Connect M-Pesa</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-700 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">Request a payment</h3>
            <p className="mt-1 text-sm text-gray-400">
              {account?.type === 'TILL' ? `Customers can also pay Till ${account.tillNumber}.` : account ? `Customers can also pay Paybill ${account.shortcode}${ref ? `, account ${ref}` : ''}.` : ''}
              {account?.environment === 'sandbox' && <span className="ml-2 rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">Sandbox: no real money</span>}
            </p>
          </div>
          <p className="text-sm text-gray-300">Received so far: <strong className="text-white">{kes(paid)}</strong></p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm text-gray-300">Amount (KES)
            <input type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={`mt-1 w-full ${input}`} />
          </label>
          <label className="block text-sm text-gray-300">Customer&apos;s M-Pesa number
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0712 345 678" className={`mt-1 w-full ${input}`} />
          </label>
          <label className="block text-sm text-gray-300">What is it for? <span className="text-gray-500">(optional)</span>
            <input value={form.description} maxLength={60} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Deposit" className={`mt-1 w-full ${input}`} />
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        {watching && <p className="mt-3 text-sm text-amber-200">Prompt sent. Waiting for the customer to enter their M-Pesa PIN…</p>}
        {link && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-white/5 p-3 text-sm">
            <code className="break-all text-gray-200">{link}</code>
            <button onClick={() => navigator.clipboard.writeText(link)} className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-200">Copy</button>
            <a href={`https://wa.me/${(form.phone || phone || '').replace(/\D/g, '').replace(/^0/, '254')}?text=${encodeURIComponent(`Here is your M-Pesa payment link: ${link}`)}`} target="_blank" rel="noreferrer" className="rounded border border-emerald-600 px-2 py-1 text-xs text-emerald-300">Send on WhatsApp</a>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled={busy || !form.amount} onClick={() => request('stk')} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">{busy ? 'Sending…' : 'Send M-Pesa prompt'}</button>
          <button disabled={busy || !form.amount} onClick={() => request('link')} className="rounded-lg border border-gray-600 px-4 py-2.5 text-sm text-gray-200 disabled:opacity-50">Create pay link</button>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-700">
        <h3 className="border-b border-white/10 p-4 text-base font-bold text-white">Payments</h3>
        {payments.length ? (
          <div className="divide-y divide-white/10">
            {payments.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-semibold text-white">{kes(p.amount)} {p.description && <span className="font-normal text-gray-400">· {p.description}</span>}</p>
                  <p className="text-xs text-gray-400">{when(p.paidAt || p.createdAt)}{p.mpesaReceipt ? ` · Receipt ${p.mpesaReceipt}` : ''}{p.status !== 'PAID' && p.resultDesc ? ` · ${p.resultDesc}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[p.status] || ''}`}>{STATUS_LABEL[p.status] || p.status}</span>
                  {['REQUESTED', 'PENDING'].includes(p.status) && <button onClick={() => cancel(p.id)} className="text-xs text-gray-400 hover:text-red-300">Cancel</button>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-5 text-sm text-gray-400">No payments yet.</p>
        )}
      </section>

      {canPlans ? <Plans leadId={leadId} plans={plans} onChange={load} /> : (
        <div className="rounded-2xl border border-dashed border-gray-600 p-5 text-sm text-gray-400">
          Instalment plans with automatic reminders are included from the Growth Pro plan. <Link href="/settings/billing" className="font-semibold text-brand-orange">See plans</Link>
        </div>
      )}
    </div>
  );
}

function Plans({ leadId, plans, onChange }: { leadId: string; plans: Plan[]; onChange: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ title: '', total: '', deposit: '', count: '3', frequency: 'monthly', firstDue: today });
  const [error, setError] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const r = await fetch('/api/payments/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId, ...f }) });
    const d = await r.json();
    if (!r.ok) return setError(d.error || 'Could not create the plan.');
    setShow(false);
    setF({ ...f, title: '', total: '', deposit: '' });
    onChange();
  }
  async function cancel(id: string) {
    if (!confirm('Cancel this plan? Reminders stop and it leaves the outstanding totals.')) return;
    await fetch(`/api/payments/plans/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel' }) });
    onChange();
  }

  return (
    <section className="rounded-2xl border border-gray-700 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white">Instalment plans</h3>
          <p className="mt-1 text-sm text-gray-400">Payments are applied to the oldest instalment first. Reminders go out 3 days before, on the day, and when late.</p>
        </div>
        {!show && <button onClick={() => setShow(true)} className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-200">+ New plan</button>}
      </div>
      {show && (
        <form onSubmit={create} className="mt-4 grid gap-3 rounded-xl bg-white/5 p-4 sm:grid-cols-3">
          <label className="block text-sm text-gray-300 sm:col-span-3">Plan name<input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Plot 14 balance" className={`mt-1 w-full ${input}`} /></label>
          <label className="block text-sm text-gray-300">Total (KES)<input required type="number" min="1" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} className={`mt-1 w-full ${input}`} /></label>
          <label className="block text-sm text-gray-300">Deposit (KES)<input type="number" min="0" value={f.deposit} onChange={(e) => setF({ ...f, deposit: e.target.value })} placeholder="0" className={`mt-1 w-full ${input}`} /></label>
          <label className="block text-sm text-gray-300">Number of instalments<input required type="number" min="1" max="120" value={f.count} onChange={(e) => setF({ ...f, count: e.target.value })} className={`mt-1 w-full ${input}`} /></label>
          <label className="block text-sm text-gray-300">Every
            <select value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })} className={`mt-1 w-full ${input}`}><option value="monthly">Month</option><option value="weekly">Week</option></select>
          </label>
          <label className="block text-sm text-gray-300">First payment due<input required type="date" value={f.firstDue} onChange={(e) => setF({ ...f, firstDue: e.target.value })} className={`mt-1 w-full ${input}`} /></label>
          <div className="flex items-end gap-2">
            <button className="btn-primary px-4 py-2 text-sm">Create plan</button>
            <button type="button" onClick={() => setShow(false)} className="px-3 py-2 text-sm text-gray-400">Cancel</button>
          </div>
          {error && <p className="text-sm text-red-300 sm:col-span-3">{error}</p>}
        </form>
      )}
      <div className="mt-4 space-y-4">
        {plans.map((p) => {
          const paid = p.installments.reduce((s, i) => s + i.paidAmount, 0);
          return (
            <div key={p.id} className="rounded-xl border border-gray-700 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-white">{p.title} <span className="ml-2 text-xs font-normal text-gray-400">{p.status.toLowerCase()}</span></p>
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  {kes(paid)} of {kes(p.totalAmount)}
                  {p.status === 'ACTIVE' && <button onClick={() => cancel(p.id)} className="text-xs text-gray-400 hover:text-red-300">Cancel plan</button>}
                </div>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-brand-orange" style={{ width: `${Math.min(100, (paid / p.totalAmount) * 100)}%` }} /></div>
              <div className="mt-3 grid gap-1 text-xs">
                {p.installments.map((i) => {
                  const done = i.paidAmount >= i.amount;
                  const late = !done && new Date(i.dueDate) < new Date(new Date().toDateString());
                  return (
                    <div key={i.id} className="flex justify-between text-gray-400">
                      <span>{new Date(i.dueDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span className={done ? 'text-emerald-300' : late ? 'text-red-300' : ''}>{kes(i.amount)}{i.paidAmount > 0 && !done ? ` (${kes(i.paidAmount)} paid)` : ''}{done ? ' · paid' : late ? ' · late' : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!plans.length && !show && <p className="text-sm text-gray-400">No instalment plans for this customer.</p>}
      </div>
    </section>
  );
}
