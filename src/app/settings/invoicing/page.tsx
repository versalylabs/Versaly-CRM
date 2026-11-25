'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import SettingsTabs from '@/components/SettingsTabs';

const input = 'rounded-lg border border-gray-600 bg-transparent px-3 py-2 text-sm text-white';

/** Business details printed on quotes and invoices, and the KRA eTIMS connection. */
export default function InvoicingSettingsPage() {
  const { data: session } = useSession();
  const canEdit = session?.user?.role === 'ADMIN' || session?.user?.role === 'MANAGER';
  const [f, setF] = useState<any>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => fetch('/api/settings/invoicing').then((r) => r.json()).then((d) => setF({ ...d, etimsEnv: d.etimsEnv || '' }));
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch('/api/settings/invoicing', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, etimsEnv: f.etimsEnv || null }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg({ ok: r.ok, text: r.ok ? 'Saved.' : d.error || 'Could not save.' });
    load();
  }
  async function connect() {
    setBusy(true);
    const r = await fetch('/api/settings/invoicing', { method: 'POST' });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg({ ok: r.ok, text: r.ok ? d.message : d.error || 'Could not connect to KRA.' });
    load();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <SettingsTabs />
      <div>
        <h1 className="text-2xl font-bold text-white">Invoicing</h1>
        <p className="mt-1 text-sm text-gray-400">What appears on your quotes and invoices, and your KRA eTIMS connection.</p>
      </div>
      {msg && <p className={`rounded-lg p-3 text-sm ${msg.ok ? 'bg-emerald-500/10 text-emerald-200' : 'bg-red-500/10 text-red-200'}`}>{msg.text}</p>}
      {!f ? <p className="text-sm text-gray-400">Loading…</p> : (
        <form onSubmit={save} className="space-y-6">
          <section className="grid gap-3 rounded-2xl border border-gray-700 p-5 sm:grid-cols-2">
            <h2 className="text-base font-bold text-white sm:col-span-2">Business details</h2>
            <label className="block text-sm text-gray-300">Registered business name<input disabled={!canEdit} value={f.legalName || ''} placeholder={f.name} onChange={(e) => setF({ ...f, legalName: e.target.value })} className={`mt-1 w-full ${input}`} /></label>
            <label className="block text-sm text-gray-300">KRA PIN<input disabled={!canEdit} value={f.kraPin || ''} placeholder="P051234567X" onChange={(e) => setF({ ...f, kraPin: e.target.value })} className={`mt-1 w-full ${input}`} /></label>
            <label className="block text-sm text-gray-300 sm:col-span-2">Address<textarea disabled={!canEdit} rows={2} value={f.businessAddress || ''} onChange={(e) => setF({ ...f, businessAddress: e.target.value })} className={`mt-1 w-full ${input}`} /></label>
            <label className="block text-sm text-gray-300 sm:col-span-2">Footer on every document <span className="text-gray-500">(payment terms, bank or M-Pesa details)</span><textarea disabled={!canEdit} rows={3} value={f.invoiceFooter || ''} onChange={(e) => setF({ ...f, invoiceFooter: e.target.value })} className={`mt-1 w-full ${input}`} /></label>
          </section>

          <section className="grid gap-3 rounded-2xl border border-gray-700 p-5 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <h2 className="text-base font-bold text-white">KRA eTIMS</h2>
              <p className="mt-1 text-sm text-gray-400">
                Register your invoices with KRA directly from VersalyLabs (OSCU). You need your KRA PIN, the branch ID (usually 00) and the
                device serial number KRA issued when you registered for eTIMS on the KRA iTax/eTIMS portal. Start with the sandbox.
              </p>
              <p className="mt-2 text-sm">{f.etimsReady ? <span className="text-emerald-300">Connected to KRA ({f.etimsEnv}).</span> : <span className="text-gray-400">Not connected.</span>}</p>
            </div>
            <label className="block text-sm text-gray-300">Environment
              <select disabled={!canEdit} value={f.etimsEnv} onChange={(e) => setF({ ...f, etimsEnv: e.target.value })} className={`mt-1 w-full ${input}`}>
                <option value="">Off</option><option value="sandbox">Sandbox (testing)</option><option value="production">Production</option>
              </select>
            </label>
            <label className="block text-sm text-gray-300">Branch ID<input disabled={!canEdit} value={f.etimsBranchId || '00'} onChange={(e) => setF({ ...f, etimsBranchId: e.target.value })} className={`mt-1 w-full ${input}`} /></label>
            <label className="block text-sm text-gray-300">Device serial number<input disabled={!canEdit} value={f.etimsDeviceSerial || ''} onChange={(e) => setF({ ...f, etimsDeviceSerial: e.target.value })} className={`mt-1 w-full ${input}`} /></label>
          </section>

          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">Save</button>
              {f.etimsEnv && f.kraPin && f.etimsDeviceSerial && !f.etimsReady && <button type="button" disabled={busy} onClick={connect} className="rounded-lg border border-brand-orange/60 px-4 py-2.5 text-sm text-brand-orange disabled:opacity-50">Connect to KRA eTIMS</button>}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
