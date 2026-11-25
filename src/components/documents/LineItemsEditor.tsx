'use client';

import { TAX_TYPES, priceItems, type LineItem, type TaxType } from '@/lib/quotes';

export type DraftLine = { description: string; quantity: string; unitPrice: string; discountPct: string; taxType: TaxType };
export const blankLine = (): DraftLine => ({ description: '', quantity: '1', unitPrice: '', discountPct: '', taxType: 'B' });
export const toDraft = (items: LineItem[] | null | undefined): DraftLine[] =>
  items?.length ? items.map((i) => ({ description: i.description, quantity: String(i.quantity), unitPrice: String(i.unitPrice), discountPct: i.discountPct ? String(i.discountPct) : '', taxType: i.taxType })) : [blankLine()];
export const toItems = (lines: DraftLine[]): LineItem[] =>
  lines.filter((l) => l.description.trim() || l.unitPrice).map((l) => ({ description: l.description.trim(), quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0, discountPct: Number(l.discountPct) || 0, taxType: l.taxType }));

const input = 'w-full rounded-lg border border-gray-600 bg-transparent px-2 py-1.5 text-sm text-white';
const kes = (n: number) => `KES ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Line items with live totals. The server recalculates everything on save. */
export default function LineItemsEditor({ lines, onChange }: { lines: DraftLine[]; onChange: (lines: DraftLine[]) => void }) {
  const set = (i: number, patch: Partial<DraftLine>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const priced = priceItems(toItems(lines).filter((l) => l.quantity > 0));
  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[1fr_70px_110px_70px_130px_28px] gap-2 text-xs text-gray-400 sm:grid">
        <span>Description</span><span>Qty</span><span>Unit price (excl. VAT)</span><span>Disc. %</span><span>Tax</span><span />
      </div>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-white/5 p-2 sm:grid-cols-[1fr_70px_110px_70px_130px_28px] sm:border-0 sm:p-0">
          <input aria-label="Description" value={l.description} onChange={(e) => set(i, { description: e.target.value })} placeholder="e.g. Website design" className={`col-span-2 sm:col-span-1 ${input}`} />
          <input aria-label="Quantity" type="number" min="0" step="any" value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })} className={input} />
          <input aria-label="Unit price excluding VAT" type="number" min="0" step="any" value={l.unitPrice} onChange={(e) => set(i, { unitPrice: e.target.value })} className={input} />
          <input aria-label="Discount percent" type="number" min="0" max="100" step="any" value={l.discountPct} onChange={(e) => set(i, { discountPct: e.target.value })} placeholder="0" className={input} />
          <select aria-label="Tax" value={l.taxType} onChange={(e) => set(i, { taxType: e.target.value as TaxType })} className={input}>
            {(Object.keys(TAX_TYPES) as TaxType[]).map((t) => <option key={t} value={t}>{TAX_TYPES[t].label}</option>)}
          </select>
          <button type="button" aria-label="Remove line" onClick={() => onChange(lines.length > 1 ? lines.filter((_, j) => j !== i) : [blankLine()])} className="text-gray-500 hover:text-red-300">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...lines, blankLine()])} className="text-sm font-semibold text-brand-orange">+ Add line</button>
      <div className="ml-auto max-w-xs space-y-1 pt-2 text-sm">
        <div className="flex justify-between text-gray-300"><span>Subtotal</span><span>{kes(priced.subtotal)}</span></div>
        <div className="flex justify-between text-gray-300"><span>VAT</span><span>{kes(priced.vatTotal)}</span></div>
        <div className="flex justify-between border-t border-white/10 pt-1 font-bold text-white"><span>Total</span><span>{kes(priced.total)}</span></div>
      </div>
    </div>
  );
}
