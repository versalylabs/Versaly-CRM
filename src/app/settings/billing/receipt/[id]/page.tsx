'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import VersalyLabsLogo, { Wordmark } from '@/components/VersalyLabsLogo';

type Receipt = {
  number: string;
  reference: string;
  workspace: string;
  plan: string;
  interval: string;
  amountKes: number;
  status: string;
  channel: string | null;
  periodStart: string;
  periodEnd: string;
  paidAt: string;
};

const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export default function ReceiptPage({ params }: { params: { id: string } }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/billing/invoices/${params.id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Could not load this receipt.');
        setReceipt(d);
      })
      .catch((e) => setError(e.message));
  }, [params.id]);

  if (error) return <p className="p-8 text-sm text-red-300">{error}</p>;
  if (!receipt) return <p className="p-8 text-sm text-gray-400">Loading receipt…</p>;

  const rows: [string, string][] = [
    ['Receipt number', receipt.number],
    ['Payment reference', receipt.reference],
    ['Date paid', date(receipt.paidAt)],
    ['Billed to', receipt.workspace],
    ['Plan', `${receipt.plan} (${receipt.interval === 'month' ? 'monthly' : 'annual'})`],
    ['Service period', `${date(receipt.periodStart)} to ${date(receipt.periodEnd)}`],
    ['Paid with', receipt.channel === 'mobile_money' ? 'M-Pesa' : receipt.channel === 'card' ? 'Card' : receipt.channel || '-'],
    ['Status', receipt.status === 'paid' ? 'Paid' : receipt.status],
  ];

  return (
    <div className="mx-auto max-w-2xl pb-16">
      {/* Printing shows only the receipt, so "Save as PDF" gives a clean document. */}
      <style>{`@media print { body * { visibility: hidden !important; } #receipt, #receipt * { visibility: visible !important; } #receipt { position: absolute; inset: 0; margin: 0; border: none; } }`}</style>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/settings/billing" className="text-sm font-semibold text-sky-400 hover:underline">← Back to billing</Link>
        <button onClick={() => window.print()} className="btn-primary px-4 py-2 text-sm">Print or save as PDF</button>
      </div>
      {/* Plain inline colours on purpose: the app's dark theme repaints bg-white / text-gray-* classes. */}
      <div id="receipt" className="rounded-2xl p-8" style={{ background: '#ffffff', color: '#051f20', border: '1px solid #e5e7eb' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <VersalyLabsLogo size={44} className="rounded-xl" />
            <div>
              <Wordmark tone="onLight" className="text-2xl" />
              <p className="text-xs" style={{ color: '#4b5b5c' }}>versalylabs@gmail.com · 0704 611 033</p>
            </div>
          </div>
          <p className="text-right text-xl font-bold">Receipt</p>
        </div>

        <dl className="mt-8 divide-y" style={{ borderColor: '#e5e7eb' }}>
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2.5 text-sm">
              <dt style={{ color: '#4b5b5c' }}>{label}</dt>
              <dd className="text-right font-semibold">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex items-center justify-between rounded-xl p-4" style={{ background: '#f8edd2' }}>
          <span className="text-sm font-semibold">Total paid</span>
          <span className="text-2xl font-black">KES {receipt.amountKes.toLocaleString('en-US')}</span>
        </div>
        <p className="mt-6 text-xs" style={{ color: '#4b5b5c' }}>
          Thank you for choosing VersalyLabs. This receipt confirms payment for the service period shown. It is not a KRA eTIMS tax invoice.
        </p>
      </div>
    </div>
  );
}
