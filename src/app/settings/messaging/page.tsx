'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import SettingsTabs from '@/components/SettingsTabs';
import { planHasFeature } from '@/lib/plans';

const input = 'rounded-lg border border-gray-600 px-3 py-2 text-sm';
const kes = (n: number) => `KES ${Math.round(n).toLocaleString('en-US')}`;

export default function MessagingSettingsPage() {
  return (
    <Suspense fallback={null}>
      <Messaging />
    </Suspense>
  );
}

function Messaging() {
  const { data: session } = useSession();
  const params = useSearchParams();
  const isManager = session?.user?.role === 'ADMIN' || session?.user?.role === 'MANAGER';
  const [s, setS] = useState<any>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(
    params.get('payment') === 'success' ? { ok: true, text: 'Payment received. Your SMS credits have been added.' } : params.get('payment') ? { ok: false, text: 'The payment did not go through. You have not been charged for credits.' } : null
  );
  const load = useCallback(() => fetch('/api/messaging/settings').then((r) => (r.ok ? r.json() : null)).then(setS), []);
  useEffect(() => { load(); }, [load]);

  async function save(body: object, ok = 'Saved.') {
    const r = await fetch('/api/messaging/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setMsg({ ok: r.ok, text: r.ok ? ok : d.error || 'Could not save.' });
    load();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <SettingsTabs />
      <div>
        <h1 className="text-2xl font-bold text-white">Messaging & SMS</h1>
        <p className="mt-1 text-sm text-gray-400">How your team shares the inbox, your WhatsApp templates and costs, and SMS credits.</p>
      </div>
      {msg && <p className={`rounded-lg p-3 text-sm ${msg.ok ? 'bg-emerald-500/10 text-emerald-200' : 'bg-red-500/10 text-red-200'}`}>{msg.text}</p>}
      {!s ? <p className="text-sm text-gray-400">Loading…</p> : (
        <>
          <TeamInbox s={s} canEdit={isManager} save={save} />
          {planHasFeature(session?.user?.plan, 'whatsapp') || session?.user?.isPlatformAdmin ? <WhatsApp s={s} canEdit={isManager} save={save} onChange={load} setMsg={setMsg} /> : (
            <section className="rounded-2xl border border-dashed border-gray-600 p-5 text-sm text-gray-400">WhatsApp Business is included from Growth Pro. <Link href="/settings/billing" className="font-semibold text-brand-orange">See plans</Link></section>
          )}
          <Sms s={s} canEdit={isManager} save={save} setMsg={setMsg} />
        </>
      )}
    </div>
  );
}

function TeamInbox({ s, canEdit, save }: { s: any; canEdit: boolean; save: (b: object, ok?: string) => void }) {
  const [sla, setSla] = useState(s.inbox.slaMinutes ? String(s.inbox.slaMinutes) : '');
  return (
    <section className="space-y-4 rounded-2xl border border-gray-700 p-5">
      <h2 className="text-base font-bold text-white">Team inbox</h2>
      <label className="flex items-start gap-3 text-sm text-gray-300">
        <input type="checkbox" disabled={!canEdit} checked={s.inbox.autoAssign} onChange={(e) => save({ autoAssign: e.target.checked })} className="mt-1" />
        <span><strong className="text-white">Share new conversations fairly (round-robin)</strong><br />Each new conversation goes to the teammate with the fewest open ones.</span>
      </label>
      <div className="text-sm text-gray-300">
        <p><strong className="text-white">Reply-time target</strong></p>
        <p className="mt-1 text-gray-400">If a customer waits longer than this, the conversation is marked urgent, the owner and managers are notified, and the &quot;Customer waiting past reply-time target&quot; automation runs.</p>
        <div className="mt-2 flex items-center gap-2">
          <select disabled={!canEdit} value={sla} onChange={(e) => setSla(e.target.value)} className={input}>
            <option value="">No target</option>
            {[15, 30, 60, 120, 240, 480, 1440].map((m) => <option key={m} value={m}>{m < 60 ? `${m} minutes` : m === 1440 ? '24 hours' : `${m / 60} hour${m === 60 ? '' : 's'}`}</option>)}
          </select>
          {canEdit && <button onClick={() => save({ slaMinutes: sla || null })} className="btn-primary px-4 py-2 text-sm">Save</button>}
        </div>
      </div>
    </section>
  );
}

declare global { interface Window { FB?: any; fbAsyncInit?: () => void } }

function WhatsApp({ s, canEdit, save, onChange, setMsg }: { s: any; canEdit: boolean; save: (b: object, ok?: string) => void; onChange: () => void; setMsg: (m: any) => void }) {
  const [es, setEs] = useState<{ enabled: boolean; appId?: string; configId?: string } | null>(null);
  const [templates, setTemplates] = useState<any[] | null>(null);
  const [tplError, setTplError] = useState('');
  const [waba, setWaba] = useState(s.whatsapp?.wabaId || '');
  const [form, setForm] = useState({ name: '', category: 'UTILITY', language: 'en', body: '', examples: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch('/api/whatsapp/embedded-signup').then((r) => r.json()).then(setEs).catch(() => setEs({ enabled: false })); }, []);
  const loadTemplates = useCallback(() => fetch('/api/whatsapp/templates').then((r) => r.json()).then((d) => { setTemplates(d.templates || []); setTplError(d.error || ''); }), []);
  useEffect(() => { if (s.whatsapp?.connected) loadTemplates(); }, [s.whatsapp?.connected, loadTemplates]);

  // Meta's Embedded Signup: the popup returns a one-time code; the account IDs arrive as a window message.
  function connectWithFacebook() {
    if (!window.FB || !es?.configId) return;
    let ids: { wabaId?: string; phoneNumberId?: string } = {};
    const onMessage = (event: MessageEvent) => {
      if (!/facebook\.com$/.test(new URL(event.origin).hostname)) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') ids = { wabaId: data.data.waba_id, phoneNumberId: data.data.phone_number_id };
      } catch { /* not ours */ }
    };
    window.addEventListener('message', onMessage);
    window.FB.login(async (res: any) => {
      window.removeEventListener('message', onMessage);
      const code = res?.authResponse?.code;
      if (!code) return setMsg({ ok: false, text: 'WhatsApp connection was cancelled.' });
      setBusy(true);
      const r = await fetch('/api/whatsapp/embedded-signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, ...ids }) });
      const d = await r.json().catch(() => ({}));
      setBusy(false);
      setMsg({ ok: r.ok, text: r.ok ? `WhatsApp connected: ${d.name} (${d.number}).` : d.error });
      onChange();
    }, { config_id: es.configId, response_type: 'code', override_default_response_type: true, extras: { setup: {}, sessionInfoVersion: '3' } });
  }

  async function createTpl(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch('/api/whatsapp/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, examples: form.examples.split('|').map((x) => x.trim()).filter(Boolean) }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg({ ok: r.ok, text: r.ok ? d.message : d.error });
    if (r.ok) { setForm({ ...form, name: '', body: '', examples: '' }); loadTemplates(); }
  }

  const wa = s.whatsapp;
  const placeholders = new Set(form.body.match(/\{\{\d+\}\}/g) || []).size;
  return (
    <section className="space-y-5 rounded-2xl border border-gray-700 p-5">
      {es?.enabled && (
        <Script src="https://connect.facebook.net/en_US/sdk.js" strategy="lazyOnload" onLoad={() => window.FB?.init({ appId: es.appId, autoLogAppEvents: true, xfbml: false, version: 'v21.0' })} />
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">WhatsApp Business</h2>
          <p className="mt-1 text-sm text-gray-400">{wa?.connected ? <>Connected: <strong className="text-white">{wa.name}</strong> ({wa.number})</> : 'Not connected yet.'}</p>
        </div>
        {canEdit && (es?.enabled ? (
          <button disabled={busy} onClick={connectWithFacebook} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">{wa?.connected ? 'Reconnect with Facebook' : 'Connect with Facebook'}</button>
        ) : !wa?.connected && (
          <Link href="/settings/integrations" className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-200">Set up WhatsApp</Link>
        ))}
      </div>

      {wa?.connected && (
        <>
          {!wa.embedded && (
            <div className="text-sm text-gray-300">
              <p><strong className="text-white">WhatsApp Business Account ID</strong> <span className="text-gray-500">(needed for templates; in Meta Business Manager → WhatsApp Accounts)</span></p>
              <div className="mt-2 flex gap-2"><input disabled={!canEdit} value={waba} onChange={(e) => setWaba(e.target.value)} className={`w-64 ${input}`} />{canEdit && <button onClick={() => save({ wabaId: waba })} className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-200">Save</button>}</div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-bold text-white">This month&apos;s WhatsApp messages</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-4">
              {(['service', 'utility', 'marketing', 'authentication'] as const).map((c) => (
                <div key={c} className="rounded-xl bg-white/5 p-3 text-sm">
                  <p className="capitalize text-gray-400">{c === 'service' ? 'Replies (free)' : c}</p>
                  <p className="text-lg font-bold text-white">{s.usage.counts[c] || 0}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-400">Estimated Meta charges: <strong className="text-white">{kes(s.usage.estimateKes)}</strong>. Meta bills you directly; replies within 24 hours of a customer&apos;s message are free. Rates are approximate.</p>
          </div>

          <div>
            <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-white">Message templates</h3><button onClick={loadTemplates} className="text-xs text-gray-400 hover:text-white">Refresh</button></div>
            <p className="mt-1 text-xs text-gray-400">WhatsApp only lets you message a customer after 24 hours of silence with a template Meta has approved.</p>
            {tplError && <p className="mt-2 text-sm text-amber-200">{tplError}</p>}
            <div className="mt-3 divide-y divide-white/10 rounded-xl border border-gray-700">
              {templates?.length ? templates.map((t) => (
                <div key={`${t.name}-${t.language}`} className="flex flex-wrap justify-between gap-2 p-3 text-sm">
                  <div className="min-w-0"><p className="font-semibold text-white">{t.name} <span className="text-xs font-normal text-gray-500">{t.language} · {t.category}</span></p><p className="truncate text-xs text-gray-400">{t.body}</p></div>
                  <span className={`self-center rounded-full px-2.5 py-1 text-xs font-semibold ${t.status === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-300' : t.status === 'REJECTED' ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300'}`}>{t.status.toLowerCase()}</span>
                </div>
              )) : <p className="p-3 text-sm text-gray-400">{templates ? 'No templates yet.' : 'Loading…'}</p>}
            </div>
            {canEdit && (
              <form onSubmit={createTpl} className="mt-4 grid gap-3 rounded-xl bg-white/5 p-4 sm:grid-cols-3">
                <label className="block text-sm text-gray-300">Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="payment_reminder" className={`mt-1 w-full ${input}`} /></label>
                <label className="block text-sm text-gray-300">Type<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={`mt-1 w-full ${input}`}><option value="UTILITY">Utility (reminders, updates)</option><option value="MARKETING">Marketing (offers)</option></select></label>
                <label className="block text-sm text-gray-300">Language<select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className={`mt-1 w-full ${input}`}><option value="en">English</option><option value="sw">Kiswahili</option></select></label>
                <label className="block text-sm text-gray-300 sm:col-span-3">Message<textarea required rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Hi {{1}}, your payment of KES {{2}} is due on {{3}}." className={`mt-1 w-full ${input}`} /></label>
                {placeholders > 0 && <label className="block text-sm text-gray-300 sm:col-span-3">Example values, separated by | ({placeholders} needed)<input required value={form.examples} onChange={(e) => setForm({ ...form, examples: e.target.value })} placeholder="Jane | 2,500 | 30 Nov" className={`mt-1 w-full ${input}`} /></label>}
                <div className="sm:col-span-3"><button disabled={busy} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">Submit for Meta approval</button></div>
              </form>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Sms({ s, canEdit, save, setMsg }: { s: any; canEdit: boolean; save: (b: object, ok?: string) => void; setMsg: (m: any) => void }) {
  const [sender, setSender] = useState(s.sms.senderId || '');
  const [busy, setBusy] = useState<number | null>(null);
  async function buy(credits: number) {
    setBusy(credits);
    const r = await fetch('/api/sms/credits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credits }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.url) window.location.href = d.url;
    else { setBusy(null); setMsg({ ok: false, text: d.error || 'Could not start the payment.' }); }
  }
  if (!s.sms.allowed) {
    return <section className="rounded-2xl border border-dashed border-gray-600 p-5 text-sm text-gray-400">Bulk SMS and SMS reminders are included from the Starter plan. <Link href="/settings/billing" className="font-semibold text-brand-orange">See plans</Link></section>;
  }
  return (
    <section className="space-y-4 rounded-2xl border border-gray-700 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">SMS credits</h2>
          <p className="mt-1 text-sm text-gray-400">1 credit = 1 SMS of up to 160 characters. Used for bulk SMS from Leads, SMS replies in the inbox, and as the fallback for payment reminders.</p>
        </div>
        <p className="text-right"><span className="block text-xs text-gray-400">Balance</span><span className="text-2xl font-bold text-white">{s.sms.credits.toLocaleString('en-US')}</span></p>
      </div>
      {!s.sms.available && <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200">SMS sending is being switched on by VersalyLabs. You can buy credits now; they won&apos;t expire.</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        {s.sms.packs.map((p: any) => (
          <button key={p.credits} disabled={busy !== null} onClick={() => buy(p.credits)} className="rounded-xl border border-gray-600 p-4 text-left hover:border-brand-orange disabled:opacity-50">
            <span className="block text-lg font-bold text-white">{p.credits.toLocaleString('en-US')} SMS</span>
            <span className="text-sm text-gray-300">{kes(p.priceKes)} · {(p.priceKes / p.credits).toFixed(2)} per SMS</span>
            <span className="mt-2 block text-xs text-brand-orange">{busy === p.credits ? 'Opening payment…' : 'Buy with M-Pesa or card'}</span>
          </button>
        ))}
      </div>
      <div className="text-sm text-gray-300">
        <p><strong className="text-white">Sender name</strong> <span className="text-gray-500">(shown instead of a number)</span></p>
        {s.sms.canSetSenderId ? (
          <div className="mt-2 flex gap-2"><input disabled={!canEdit} value={sender} maxLength={11} onChange={(e) => setSender(e.target.value)} placeholder="ACMELTD" className={`w-48 ${input}`} />{canEdit && <button onClick={() => save({ senderId: sender }, 'Sender name saved. It works once Africa\'s Talking approves it.')} className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-200">Save</button>}</div>
        ) : <p className="mt-1 text-gray-400">Your own sender name is included in Enterprise. Until then, messages come from the VersalyLabs sender.</p>}
      </div>
      {s.sms.ledger.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-white">Recent activity</h3>
          <div className="mt-2 divide-y divide-white/10 text-sm">
            {s.sms.ledger.map((l: any) => (
              <div key={l.id} className="flex justify-between py-2 text-gray-300"><span>{l.note || l.reason.toLowerCase()} <span className="text-xs text-gray-500">{new Date(l.createdAt).toLocaleString('en-KE')}</span></span><span className={l.change > 0 ? 'text-emerald-300' : 'text-gray-400'}>{l.change > 0 ? '+' : ''}{l.change}</span></div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
