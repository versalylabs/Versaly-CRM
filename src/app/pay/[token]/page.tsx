'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Info = {
  business: string;
  amount: number;
  description: string | null;
  status: string;
  resultDesc: string | null;
  receipt: string | null;
  paybill: { number: string; account: string | null } | null;
  till: string | null;
};

/** Public page a customer opens from a payment link: enter an M-Pesa number, approve the prompt, done. */
export default function PayPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [missing, setMissing] = useState(false);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const r = await fetch(`/api/pay/${token}`, { cache: 'no-store' });
    if (!r.ok) return setMissing(true);
    setInfo(await r.json());
  }
  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // While the prompt is on the customer's phone, check every 4 seconds.
  useEffect(() => {
    if (info?.status !== 'PENDING') return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [info?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await fetch(`/api/pay/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(d.error || 'Something went wrong. Please try again.');
    load();
  }

  const amount = info ? `KES ${info.amount.toLocaleString('en-US')}` : '';
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-ink-500 bg-ink-800 p-6 text-brand-cream shadow-xl">
        {missing ? (
          <p className="text-center">This payment link is not valid any more. Please ask the business for a new one.</p>
        ) : !info ? (
          <p className="text-center text-sm opacity-70">Loading…</p>
        ) : (
          <>
            <p className="text-sm opacity-70">Pay {info.business}</p>
            <p className="mt-1 text-3xl font-bold text-white">{amount}</p>
            {info.description && <p className="mt-1 text-sm opacity-80">{info.description}</p>}

            {info.status === 'PAID' ? (
              <div className="mt-6 rounded-xl bg-emerald-500/15 p-4 text-center">
                <p className="text-lg font-semibold text-emerald-300">Payment received. Thank you!</p>
                {info.receipt && <p className="mt-1 text-sm opacity-80">M-Pesa receipt {info.receipt}</p>}
              </div>
            ) : info.status === 'PENDING' ? (
              <div className="mt-6 rounded-xl bg-amber-500/15 p-4 text-center">
                <p className="font-semibold text-amber-200">Check your phone</p>
                <p className="mt-1 text-sm opacity-80">Enter your M-Pesa PIN on the prompt to pay {amount}. This page updates by itself.</p>
              </div>
            ) : (
              <form onSubmit={pay} className="mt-6 space-y-3">
                {info.status !== 'REQUESTED' && info.resultDesc && <p className="text-sm text-amber-200">The last attempt did not go through ({info.resultDesc}). You can try again.</p>}
                <label className="block text-sm">Your M-Pesa number
                  <input required inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" className="mt-1 w-full rounded-lg border border-ink-500 bg-ink-900 px-3 py-3 text-base text-white" />
                </label>
                {error && <p className="text-sm text-red-300">{error}</p>}
                <button disabled={busy} className="w-full rounded-lg bg-brand-orange py-3 font-semibold text-white disabled:opacity-60">{busy ? 'Sending prompt…' : `Pay ${amount} with M-Pesa`}</button>
              </form>
            )}

            {info.status !== 'PAID' && (info.paybill || info.till) && (
              <p className="mt-5 border-t border-ink-500 pt-4 text-xs opacity-70">
                Or pay directly: {info.paybill ? <>Paybill <strong>{info.paybill.number}</strong>{info.paybill.account && <>, account <strong>{info.paybill.account}</strong></>}</> : <>Buy Goods Till <strong>{info.till}</strong></>}.
              </p>
            )}
          </>
        )}
        <p className="mt-6 text-center text-[11px] opacity-50">Secure M-Pesa payment powered by VersalyLabs</p>
      </div>
    </main>
  );
}
