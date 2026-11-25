'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DocumentView, { type Doc } from '@/components/documents/DocumentView';

/** Public invoice / credit note page with "Pay with M-Pesa" for the balance. */
export default function InvoicePage() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<(Doc & { canPay?: boolean }) | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/public/invoices/${token}`, { cache: 'no-store' }).then(async (r) => { const d = await r.json(); r.ok ? setDoc(d) : setError(d.error); });
  }, [token]);

  async function pay() {
    setBusy(true);
    const r = await fetch(`/api/public/invoices/${token}`, { method: 'POST' });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.url) window.location.href = d.url;
    else { setBusy(false); setError(d.error || 'Online payment is not available right now.'); }
  }

  return (
    <main className="min-h-screen bg-ink-950 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        {doc && (
          <>
            <div className="flex flex-wrap justify-end gap-2">
              {doc.canPay && <button disabled={busy} onClick={pay} className="rounded-lg bg-brand-orange px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Opening…' : `Pay KES ${(doc.balance || 0).toLocaleString('en-US')} with M-Pesa`}</button>}
              <button onClick={() => window.print()} className="rounded-lg border border-ink-500 px-4 py-2 text-sm text-brand-cream">Print or save as PDF</button>
            </div>
            {doc.status === 'PAID' && <p className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-200">This invoice is paid. Thank you!</p>}
            <DocumentView doc={doc} />
          </>
        )}
        {!doc && !error && <p className="text-center text-sm text-brand-cream/70">Loading…</p>}
      </div>
    </main>
  );
}
