'use client';

import { TAX_TYPES, type PricedLine } from '@/lib/quotes';

export type Doc = {
  type: 'QUOTE' | 'INVOICE' | 'CREDIT_NOTE';
  number: string;
  title?: string;
  status: string;
  business: { name: string; kraPin: string | null; address: string | null; footer: string | null };
  customer: { name: string; company: string | null; email: string | null; phone: string | null };
  lines: PricedLine[];
  subtotal: number;
  vatTotal: number;
  total: number;
  amountPaid?: number;
  balance?: number;
  issueDate: string;
  dueDate?: string | null;
  validUntil?: string | null;
  notes: string | null;
  originalNumber?: string | null;
  accepted?: { name: string; at: string } | null;
  etims?: { receiptNo: string | null; sdcId: string | null; mrcNo: string | null; dateTime: string | null; internalData: string | null; signature: string; qr: string } | null;
};

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const TITLE = { QUOTE: 'Quotation', INVOICE: 'Tax invoice', CREDIT_NOTE: 'Credit note' };
const muted = { color: '#4b5b5c' };

/**
 * A quote, invoice or credit note on white paper. Printing shows only this element, so
 * "Save as PDF" gives a clean document. Inline colours on purpose: the app's dark theme repaints gray classes.
 */
export default function DocumentView({ doc }: { doc: Doc }) {
  return (
    <>
      <style>{`@media print { body * { visibility: hidden !important; } #document, #document * { visibility: visible !important; } #document { position: absolute; inset: 0; margin: 0; border: none; box-shadow: none; } }`}</style>
      <article id="document" className="rounded-2xl p-6 text-sm sm:p-10" style={{ background: '#ffffff', color: '#051f20', border: '1px solid #e5e7eb' }}>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xl font-bold">{doc.business.name}</p>
            {doc.business.address && <p className="whitespace-pre-line text-xs" style={muted}>{doc.business.address}</p>}
            {doc.business.kraPin && <p className="text-xs" style={muted}>KRA PIN: {doc.business.kraPin}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-black uppercase tracking-wide">{TITLE[doc.type]}</p>
            <p className="font-semibold">{doc.number}</p>
            <p className="text-xs" style={muted}>Date: {date(doc.issueDate)}</p>
            {doc.type === 'QUOTE' && doc.validUntil && <p className="text-xs" style={muted}>Valid until: {date(doc.validUntil)}</p>}
            {doc.type === 'INVOICE' && <p className="text-xs" style={muted}>Due: {date(doc.dueDate)}</p>}
            {doc.originalNumber && <p className="text-xs" style={muted}>For invoice {doc.originalNumber}</p>}
          </div>
        </header>

        <section className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wide" style={muted}>{doc.type === 'QUOTE' ? 'Prepared for' : 'Bill to'}</p>
          <p className="font-semibold">{doc.customer.company || doc.customer.name}</p>
          {doc.customer.company && <p>{doc.customer.name}</p>}
          <p className="text-xs" style={muted}>{[doc.customer.email, doc.customer.phone].filter(Boolean).join(' · ')}</p>
          {doc.title && <p className="mt-3 font-semibold">{doc.title}</p>}
        </section>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left">
            <thead>
              <tr className="text-xs uppercase" style={{ ...muted, borderBottom: '2px solid #051f20' }}>
                <th className="py-2">Description</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Unit price</th><th className="py-2 text-right">Disc.</th><th className="py-2 text-right">Tax</th><th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td className="py-2 pr-2">{l.description}</td>
                  <td className="py-2 text-right">{l.quantity}</td>
                  <td className="py-2 text-right">{money(l.unitPrice)}</td>
                  <td className="py-2 text-right">{l.discountPct ? `${l.discountPct}%` : '—'}</td>
                  <td className="py-2 text-right text-xs">{l.taxType} · {TAX_TYPES[l.taxType].label}</td>
                  <td className="py-2 text-right">{money(l.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 ml-auto max-w-xs space-y-1">
          <div className="flex justify-between"><span style={muted}>Subtotal</span><span>{money(doc.subtotal)}</span></div>
          <div className="flex justify-between"><span style={muted}>VAT</span><span>{money(doc.vatTotal)}</span></div>
          <div className="flex justify-between rounded-lg px-2 py-1.5 text-base font-black" style={{ background: '#f8edd2' }}><span>Total (KES)</span><span>{money(doc.total)}</span></div>
          {doc.type === 'INVOICE' && doc.amountPaid !== undefined && doc.amountPaid > 0 && (
            <>
              <div className="flex justify-between"><span style={muted}>Paid / credited</span><span>{money(doc.amountPaid)}</span></div>
              <div className="flex justify-between font-bold"><span>Balance due</span><span>{money(doc.balance || 0)}</span></div>
            </>
          )}
        </div>

        {doc.notes && <p className="mt-6 whitespace-pre-line text-xs" style={muted}>{doc.notes}</p>}
        {doc.accepted && <p className="mt-6 rounded-lg p-3 text-xs" style={{ background: '#ecfdf5', color: '#065f46' }}>Accepted by <strong>{doc.accepted.name}</strong> on {new Date(doc.accepted.at).toLocaleString('en-GB')}.</p>}

        {doc.etims ? (
          <section className="mt-8 flex flex-wrap items-center gap-4 rounded-xl p-4 text-xs" style={{ border: '1px solid #e5e7eb' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={doc.etims.qr} alt="KRA eTIMS verification QR code" width={110} height={110} />
            <div className="space-y-0.5" style={muted}>
              <p className="font-semibold" style={{ color: '#051f20' }}>KRA eTIMS</p>
              {doc.etims.receiptNo && <p>CU invoice no.: {doc.etims.receiptNo}</p>}
              {doc.etims.sdcId && <p>SCU ID: {doc.etims.sdcId}</p>}
              {doc.etims.mrcNo && <p>MRC no.: {doc.etims.mrcNo}</p>}
              {doc.etims.dateTime && <p>Date: {doc.etims.dateTime}</p>}
              {doc.etims.internalData && <p className="break-all">Internal data: {doc.etims.internalData}</p>}
              <p className="break-all">Signature: {doc.etims.signature}</p>
            </div>
          </section>
        ) : doc.type !== 'QUOTE' ? (
          <p className="mt-8 text-xs" style={muted}>Not yet registered with KRA eTIMS.</p>
        ) : null}

        {doc.business.footer && <footer className="mt-8 whitespace-pre-line border-t pt-4 text-xs" style={{ ...muted, borderColor: '#e5e7eb' }}>{doc.business.footer}</footer>}
      </article>
    </>
  );
}
