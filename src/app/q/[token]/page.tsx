'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DocumentView, { type Doc } from '@/components/documents/DocumentView';

/** Public quote page: the client reads it, then accepts with their name or declines. */
export default function QuotePage() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  const load = () => fetch(`/api/public/quotes/${token}`, { cache: 'no-store' }).then(async (r) => { const d = await r.json(); r.ok ? setDoc(d) : setError(d.error); });
  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function answer(action: 'accept' | 'decline') {
    if (action === 'decline' && !confirm('Decline this quote?')) return;
    setBusy(true);
    const r = await fetch(`/api/public/quotes/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, name }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(d.error || 'Something went wrong.');
    setDone(action === 'accept' ? 'Thank you. Your acceptance has been recorded and the business has been notified.' : 'Thank you. The business has been told you declined.');
    load();
  }

  const open = doc && doc.status !== 'accepted' && doc.status !== 'rejected';
  return (
    <main className="min-h-screen bg-ink-950 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        {done && <p className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-200">{done}</p>}
        {doc && (
          <>
            <div className="flex justify-end"><button onClick={() => window.print()} className="rounded-lg border border-ink-500 px-4 py-2 text-sm text-brand-cream">Print or save as PDF</button></div>
            <DocumentView doc={doc} />
            {open && (
              <section className="rounded-2xl border border-ink-500 bg-ink-800 p-5 text-brand-cream">
                <p className="font-semibold text-white">Happy with this quote?</p>
                <label className="mt-3 block text-sm">Your full name
                  <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-ink-500 bg-ink-900 px-3 py-2.5 text-white" />
                </label>
                <p className="mt-2 text-xs opacity-70">By clicking Accept you agree to this quote. Your name, the date and time are recorded.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button disabled={busy || name.trim().length < 2} onClick={() => answer('accept')} className="rounded-lg bg-brand-orange px-5 py-2.5 font-semibold text-white disabled:opacity-50">Accept quote</button>
                  <button disabled={busy} onClick={() => answer('decline')} className="rounded-lg border border-ink-500 px-4 py-2.5 text-sm">Decline</button>
                </div>
              </section>
            )}
          </>
        )}
        {!doc && !error && <p className="text-center text-sm text-brand-cream/70">Loading…</p>}
      </div>
    </main>
  );
}
