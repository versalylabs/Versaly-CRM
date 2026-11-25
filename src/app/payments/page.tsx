'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { planHasFeature } from '@/lib/plans';
import { SANDBOX_PASSKEY, SANDBOX_SHORTCODE } from '@/lib/mpesaConstants';
import { STATUS_LABEL, STATUS_STYLE } from '@/components/payments/LeadPayments';

const input = 'rounded-lg border border-gray-600 px-3 py-2 text-sm';
const kes = (n: number) => `KES ${Math.round(n).toLocaleString('en-US')}`;
const when = (s: string) => new Date(s).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const TABS = [
  ['overview', 'Overview'],
  ['transactions', 'Transactions'],
  ['unmatched', 'Unmatched'],
  ['plans', 'Instalments'],
  ['settings', 'M-Pesa settings'],
] as const;
type Tab = (typeof TABS)[number][0];

export default function PaymentsPage() {
  return (
    <Suspense fallback={null}>
      <Payments />
    </Suspense>
  );
}

function Payments() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'overview') as Tab;
  const [summary, setSummary] = useState<any>(null);
  const loadSummary = useCallback(
    () => fetch('/api/payments/summary').then((r) => (r.ok ? r.json() : { error: true })).catch(() => ({ error: true })).then(setSummary),
    []
  );
  useEffect(() => { loadSummary(); }, [loadSummary, tab]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-white">Payments</h1>
        <p className="mt-1 text-sm text-gray-400">M-Pesa payments from your customers, matched to the right person automatically.</p>
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-white/10">
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => router.push(`/payments?tab=${key}`)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === key ? 'border-brand-orange text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>
            {label}{key === 'unmatched' && summary?.unmatched ? <span className="ml-1.5 rounded-full bg-brand-orange px-1.5 text-xs text-white">{summary.unmatched}</span> : null}
          </button>
        ))}
      </nav>
      {summary?.error && (
        <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-200">
          Payments could not be loaded. <button onClick={loadSummary} className="font-semibold underline">Try again</button>
        </p>
      )}
      {summary && !summary.error && !summary.connected && tab !== 'settings' && (
        <div className="rounded-2xl border border-brand-orange/40 bg-brand-orange/10 p-5">
          <p className="font-semibold text-white">Connect your Paybill or Till to start collecting</p>
          <p className="mt-1 text-sm text-gray-300">Use Safaricom&apos;s free sandbox to try it first. No real money moves until you switch to production.</p>
          <button onClick={() => router.push('/payments?tab=settings')} className="btn-primary mt-3 px-5 py-2 text-sm">Set up M-Pesa</button>
        </div>
      )}
      {tab === 'overview' && <Overview s={summary} />}
      {tab === 'transactions' && <Transactions />}
      {tab === 'unmatched' && <Unmatched onChange={loadSummary} />}
      {tab === 'plans' && <PlansTab />}
      {tab === 'settings' && <Settings onChange={loadSummary} />}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-gray-700 p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function Overview({ s }: { s: any }) {
  if (!s || s.error) return s ? null : <p className="text-sm text-gray-400">Loading…</p>;
  const buckets: Array<[string, string]> = [['current', 'Not yet due'], ['1-30', '1–30 days late'], ['31-60', '31–60 days'], ['61-90', '61–90 days'], ['90+', 'Over 90 days']];
  const max = Math.max(1, ...buckets.map(([k]) => s.ageing[k]));
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Received today" value={kes(s.today.amount)} sub={`${s.today.count} payment${s.today.count === 1 ? '' : 's'}`} />
        <Stat label="Received this month" value={kes(s.month.amount)} sub={`${s.month.count} payment${s.month.count === 1 ? '' : 's'}`} />
        <Stat label="Outstanding (instalments)" value={kes(s.outstanding)} sub={`${kes(s.overdue)} overdue`} />
        <Stat label="Waiting to be matched" value={String(s.unmatched)} sub={s.unmatched ? 'See the Unmatched tab' : 'All payments matched'} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-700 p-5">
          <h2 className="text-base font-bold text-white">Debtor ageing</h2>
          <div className="mt-4 space-y-3">
            {buckets.map(([k, label]) => (
              <div key={k} className="text-sm">
                <div className="flex justify-between text-gray-300"><span>{label}</span><span>{kes(s.ageing[k])}</span></div>
                <div className="mt-1 h-2 rounded-full bg-white/10"><div className={`h-2 rounded-full ${k === 'current' ? 'bg-emerald-500' : 'bg-brand-orange'}`} style={{ width: `${(s.ageing[k] / max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-gray-700">
          <h2 className="border-b border-white/10 p-5 text-base font-bold text-white">Customers with overdue instalments</h2>
          {s.debtors.length ? (
            <div className="divide-y divide-white/10">
              {s.debtors.map((d: any) => (
                <Link key={d.leadId} href={`/leads/${d.leadId}`} className="flex justify-between gap-3 p-4 text-sm hover:bg-white/5">
                  <span><span className="font-semibold text-white">{d.name}</span>{d.company && <span className="text-gray-400"> · {d.company}</span>}<span className="block text-xs text-gray-500">Oldest due {new Date(d.oldestDue).toLocaleDateString('en-KE')}</span></span>
                  <span className="text-right text-red-300">{kes(d.overdue)}<span className="block text-xs text-gray-500">of {kes(d.outstanding)}</span></span>
                </Link>
              ))}
            </div>
          ) : <p className="p-5 text-sm text-gray-400">Nobody is behind on an instalment.</p>}
        </section>
      </div>
    </div>
  );
}

function Transactions() {
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    fetch(`/api/payments${status ? `?status=${status}` : ''}`).then((r) => (r.ok ? r.json() : { payments: [] })).then((d) => setRows(d.payments));
  }, [status]);
  return (
    <section className="rounded-2xl border border-gray-700">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <a href={`/api/payments?format=csv${status ? `&status=${status}` : ''}`} className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-200">Export CSV for your accountant</a>
      </div>
      {!rows ? <p className="p-5 text-sm text-gray-400">Loading…</p> : rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="p-3">Date</th><th className="p-3">Customer</th><th className="p-3">Amount</th><th className="p-3">Receipt</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="p-3 text-gray-300">{when(p.paidAt || p.createdAt)}</td>
                  <td className="p-3">{p.lead ? <Link href={`/leads/${p.lead.id}`} className="font-semibold text-white hover:underline">{p.lead.contactName}</Link> : <span className="text-amber-300">Unmatched{p.payerName ? ` · ${p.payerName}` : ''}</span>}</td>
                  <td className="p-3 font-semibold text-white">{kes(p.amount)}</td>
                  <td className="p-3 font-mono text-xs text-gray-300">{p.mpesaReceipt || '—'}</td>
                  <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[p.status] || ''}`}>{STATUS_LABEL[p.status] || p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="p-5 text-sm text-gray-400">No payments yet.</p>}
    </section>
  );
}

function Unmatched({ onChange }: { onChange: () => void }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const load = useCallback(() => fetch('/api/payments?view=unmatched').then((r) => (r.ok ? r.json() : { payments: [] })).then((d) => setRows(d.payments)), []);
  useEffect(() => { load(); }, [load]);
  return (
    <section className="rounded-2xl border border-gray-700">
      <p className="border-b border-white/10 p-4 text-sm text-gray-400">These payments reached your Paybill or Till but did not match a customer by account number, phone or amount. Choose who paid.</p>
      {!rows ? <p className="p-5 text-sm text-gray-400">Loading…</p> : rows.length ? (
        <div className="divide-y divide-white/10">
          {rows.map((p) => <UnmatchedRow key={p.id} p={p} onDone={() => { load(); onChange(); }} />)}
        </div>
      ) : <p className="p-5 text-sm text-gray-400">Nothing to match. Every payment has found its customer.</p>}
    </section>
  );
}

function UnmatchedRow({ p, onDone }: { p: any; onDone: () => void }) {
  const [q, setQ] = useState(p.payerName || '');
  const [leads, setLeads] = useState<any[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (q.trim().length < 2) return setLeads([]);
    const t = setTimeout(() => fetch(`/api/leads?search=${encodeURIComponent(q.trim())}`).then((r) => (r.ok ? r.json() : [])).then((d) => setLeads((Array.isArray(d) ? d : d.leads || []).slice(0, 6))), 250);
    return () => clearTimeout(t);
  }, [q]);
  async function assign(leadId: string) {
    const r = await fetch(`/api/payments/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId }) });
    if (!r.ok) return setError((await r.json()).error || 'Could not assign.');
    onDone();
  }
  return (
    <div className="grid gap-3 p-4 text-sm md:grid-cols-[1fr_1.2fr]">
      <div>
        <p className="font-semibold text-white">{kes(p.amount)} <span className="font-normal text-gray-400">· {when(p.paidAt || p.createdAt)}</span></p>
        <p className="text-xs text-gray-400">Receipt {p.mpesaReceipt || '—'}{p.payerName ? ` · ${p.payerName}` : ''}{p.accountRef ? ` · account "${p.accountRef}"` : ''}{p.phone ? ` · ${p.phone}` : ''}</p>
      </div>
      <div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers by name, phone or email" className={`w-full ${input}`} />
        {leads.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {leads.map((l) => <button key={l.id} onClick={() => assign(l.id)} className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs text-gray-200 hover:border-brand-orange">{l.contactName}{l.companyName ? ` · ${l.companyName}` : ''}</button>)}
          </div>
        )}
        {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
      </div>
    </div>
  );
}

function PlansTab() {
  const { data: session } = useSession();
  const [plans, setPlans] = useState<any[] | null>(null);
  useEffect(() => { fetch('/api/payments/plans').then((r) => (r.ok ? r.json() : { plans: [] })).then((d) => setPlans(d.plans)); }, []);
  if (!session?.user?.isPlatformAdmin && !planHasFeature(session?.user?.plan, 'instalment_plans')) {
    return <div className="rounded-2xl border border-dashed border-gray-600 p-6 text-sm text-gray-400">Instalment plans, automatic reminders and debtor ageing are included from the Growth Pro plan. <Link href="/settings/billing" className="font-semibold text-brand-orange">See plans</Link></div>;
  }
  return (
    <section className="rounded-2xl border border-gray-700">
      <p className="border-b border-white/10 p-4 text-sm text-gray-400">Create a plan from a customer&apos;s page (Payments tab). Reminders go out by email or WhatsApp 3 days before, on the due date, and when late.</p>
      {!plans ? <p className="p-5 text-sm text-gray-400">Loading…</p> : plans.length ? (
        <div className="divide-y divide-white/10">
          {plans.map((p) => {
            const paid = p.installments.reduce((s: number, i: any) => s + i.paidAmount, 0);
            const next = p.installments.find((i: any) => i.paidAmount < i.amount);
            return (
              <Link key={p.id} href={`/leads/${p.lead.id}`} className="block p-4 text-sm hover:bg-white/5">
                <div className="flex flex-wrap justify-between gap-2">
                  <span><span className="font-semibold text-white">{p.lead.contactName}</span><span className="text-gray-400"> · {p.title}</span></span>
                  <span className="text-gray-300">{kes(paid)} of {kes(p.totalAmount)} <span className="ml-2 text-xs text-gray-500">{p.status.toLowerCase()}</span></span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/10"><div className="h-1.5 rounded-full bg-brand-orange" style={{ width: `${Math.min(100, (paid / p.totalAmount) * 100)}%` }} /></div>
                {next && p.status === 'ACTIVE' && <p className="mt-1 text-xs text-gray-500">Next: {kes(next.amount - next.paidAmount)} due {new Date(next.dueDate).toLocaleDateString('en-KE')}</p>}
              </Link>
            );
          })}
        </div>
      ) : <p className="p-5 text-sm text-gray-400">No instalment plans yet.</p>}
    </section>
  );
}

function Settings({ onChange }: { onChange: () => void }) {
  const { data: session } = useSession();
  const canReconcile = Boolean(session?.user?.isPlatformAdmin || planHasFeature(session?.user?.plan, 'mpesa_reconciliation'));
  const isManager = session?.user?.role === 'ADMIN' || session?.user?.role === 'MANAGER';
  const [accounts, setAccounts] = useState<any[] | null>(null);
  const blank = { label: '', type: 'PAYBILL', environment: 'sandbox', shortcode: '', tillNumber: '', consumerKey: '', consumerSecret: '', passkey: '' };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => fetch('/api/payments/accounts').then((r) => (r.ok ? r.json() : { accounts: [] })).then((d) => setAccounts(d.accounts)), []);
  useEffect(() => { load(); }, [load]);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await fetch('/api/payments/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: d.error || 'Could not connect.' });
    setF(blank);
    setMsg({ ok: true, text: 'Connected. Safaricom accepted your credentials.' });
    load();
    onChange();
  }
  async function act(id: string, body: object) {
    setMsg(null);
    const r = await fetch(`/api/payments/accounts/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json();
    setMsg({ ok: r.ok, text: r.ok ? d.message || 'Done. Safaricom will now send payments made to this number straight to VersalyLabs.' : d.error });
    load();
  }
  async function remove(id: string) {
    if (!confirm('Disconnect this M-Pesa account? Past payments stay in your records.')) return;
    await fetch(`/api/payments/accounts?id=${id}`, { method: 'DELETE' });
    load();
    onChange();
  }

  return (
    <div className="space-y-6">
      {msg && <p className={`rounded-lg p-3 text-sm ${msg.ok ? 'bg-emerald-500/10 text-emerald-200' : 'bg-red-500/10 text-red-200'}`}>{msg.text}</p>}
      <section className="rounded-2xl border border-gray-700">
        <h2 className="border-b border-white/10 p-5 text-base font-bold text-white">Connected accounts</h2>
        {!accounts ? <p className="p-5 text-sm text-gray-400">Loading…</p> : accounts.length ? (
          <div className="divide-y divide-white/10">
            {accounts.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
                <div>
                  <p className="font-semibold text-white">{a.label} <span className={`ml-2 rounded px-2 py-0.5 text-xs ${a.environment === 'sandbox' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{a.environment}</span></p>
                  <p className="text-xs text-gray-400">{a.type === 'TILL' ? `Till ${a.tillNumber} (store ${a.shortcode})` : `Paybill ${a.shortcode}`} · {a.c2bRegisteredAt ? 'Auto-matching on' : 'Auto-matching not set up'}</p>
                </div>
                {isManager && (
                  <div className="flex flex-wrap gap-2">
                    {canReconcile && !a.c2bRegisteredAt && <button onClick={() => act(a.id, { action: 'register' })} className="btn-primary px-3 py-1.5 text-xs">Turn on auto-matching</button>}
                    {canReconcile && a.environment === 'sandbox' && <button onClick={() => act(a.id, { action: 'simulate', amount: 100 })} className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs text-gray-200">Send a test payment (KES 100)</button>}
                    <button onClick={() => remove(a.id)} className="px-2 py-1.5 text-xs text-gray-400 hover:text-red-300">Disconnect</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : <p className="p-5 text-sm text-gray-400">No M-Pesa account connected yet.</p>}
        {!canReconcile && <p className="border-t border-white/10 p-4 text-xs text-gray-400">Automatic matching of payments made straight to your Paybill or Till is included from the Starter plan. <Link href="/settings/billing" className="font-semibold text-brand-orange">Upgrade</Link></p>}
      </section>

      {isManager ? (
        <section className="rounded-2xl border border-gray-700 p-5">
          <h2 className="text-base font-bold text-white">Connect a Paybill or Till</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-400">
            <li>Sign in at <a href="https://developer.safaricom.co.ke" target="_blank" rel="noreferrer" className="text-brand-orange">developer.safaricom.co.ke</a> and create an app with <strong>M-Pesa Express</strong> and <strong>C2B</strong>. Copy its consumer key and secret.</li>
            <li>Start with <strong>sandbox</strong> and the test shortcode to try everything without real money.</li>
            <li>When Safaricom approves your app for production (&quot;Go Live&quot;), connect again with your real shortcode and the passkey Safaricom emails you.</li>
          </ol>
          <form onSubmit={connect} className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-gray-300">Type
              <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={`mt-1 w-full ${input}`}><option value="PAYBILL">Paybill</option><option value="TILL">Till (Buy Goods)</option></select>
            </label>
            <label className="block text-sm text-gray-300">Environment
              <select value={f.environment} onChange={(e) => setF({ ...f, environment: e.target.value })} className={`mt-1 w-full ${input}`}><option value="sandbox">Sandbox (testing)</option><option value="production">Production (real money)</option></select>
            </label>
            <label className="block text-sm text-gray-300">{f.type === 'TILL' ? 'Store (head office) number' : 'Paybill number'}
              <input required value={f.shortcode} onChange={(e) => setF({ ...f, shortcode: e.target.value })} className={`mt-1 w-full ${input}`} />
            </label>
            {f.type === 'TILL' ? (
              <label className="block text-sm text-gray-300">Till number customers pay
                <input required value={f.tillNumber} onChange={(e) => setF({ ...f, tillNumber: e.target.value })} className={`mt-1 w-full ${input}`} />
              </label>
            ) : (
              <label className="block text-sm text-gray-300">Name in VersalyLabs <span className="text-gray-500">(optional)</span>
                <input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Main Paybill" className={`mt-1 w-full ${input}`} />
              </label>
            )}
            <label className="block text-sm text-gray-300">Consumer key<input required value={f.consumerKey} onChange={(e) => setF({ ...f, consumerKey: e.target.value })} autoComplete="off" className={`mt-1 w-full ${input}`} /></label>
            <label className="block text-sm text-gray-300">Consumer secret<input required type="password" value={f.consumerSecret} onChange={(e) => setF({ ...f, consumerSecret: e.target.value })} autoComplete="new-password" className={`mt-1 w-full ${input}`} /></label>
            <label className="block text-sm text-gray-300 sm:col-span-2">Passkey (Lipa na M-Pesa Online)<input required type="password" value={f.passkey} onChange={(e) => setF({ ...f, passkey: e.target.value })} autoComplete="new-password" className={`mt-1 w-full ${input}`} /></label>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <button disabled={busy} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">{busy ? 'Checking with Safaricom…' : 'Connect'}</button>
              {f.environment === 'sandbox' && <button type="button" onClick={() => setF({ ...f, type: 'PAYBILL', shortcode: SANDBOX_SHORTCODE, passkey: SANDBOX_PASSKEY, label: 'Sandbox test Paybill' })} className="text-sm text-brand-orange">Fill in Safaricom&apos;s test shortcode and passkey</button>}
            </div>
            <p className="text-xs text-gray-500 sm:col-span-2">Your keys are checked with Safaricom, then stored encrypted. Only admins and managers can see this page.</p>
          </form>
        </section>
      ) : <p className="text-sm text-gray-400">Ask a workspace admin or manager to connect M-Pesa.</p>}
    </div>
  );
}
