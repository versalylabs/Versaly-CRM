'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import SettingsTabs from '@/components/SettingsTabs';
import { CUSTOM_FIELD_TYPES, type CustomFieldType } from '@/lib/customFields';

type Field = { id: string; key: string; label: string; type: CustomFieldType; options: string[] | null; required: boolean };

const input = 'rounded-lg border border-gray-600 px-3 py-2 text-sm';

export default function CustomFieldsPage() {
  const { data: session } = useSession();
  const canEdit = ['ADMIN', 'MANAGER'].includes(session?.user?.role || '');
  const [fields, setFields] = useState<Field[]>([]);
  const [limit, setLimit] = useState<number | null>(null);
  const [form, setForm] = useState({ label: '', type: 'text' as CustomFieldType, options: '', required: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch('/api/custom-fields', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setFields(d.fields || []);
        setLimit(d.limit ?? null);
      });
  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/custom-fields', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || 'Could not add the field.');
    setForm({ label: '', type: 'text', options: '', required: false });
    load();
  }

  async function remove(field: Field) {
    if (!window.confirm(`Delete "${field.label}"? Values already saved on leads are kept but no longer shown.`)) return;
    await fetch(`/api/custom-fields?id=${field.id}`, { method: 'DELETE' });
    load();
  }

  const atLimit = limit !== null && fields.length >= limit;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <SettingsTabs />
      <div>
        <h1 className="text-2xl font-bold text-white">Custom lead fields</h1>
        <p className="mt-1 text-sm text-gray-400">
          Add the details your business tracks about each lead, such as budget, plot size, school class or car model. They appear on every lead and can be
          filled in from a spreadsheet import.
        </p>
      </div>

      <ul className="divide-y divide-white/10 rounded-2xl border border-gray-700">
        {fields.length === 0 && <li className="p-5 text-sm text-gray-400">No custom fields yet.</li>}
        {fields.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-semibold text-white">
                {f.label} {f.required && <span className="text-xs font-normal text-amber-300">(required)</span>}
              </p>
              <p className="text-xs text-gray-400">
                {CUSTOM_FIELD_TYPES[f.type] || f.type}
                {f.options?.length ? `: ${f.options.join(', ')}` : ''}
              </p>
            </div>
            {canEdit && (
              <button onClick={() => remove(f)} className="text-sm font-semibold text-red-300 hover:underline">
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <form onSubmit={add} className="space-y-3 rounded-2xl border border-gray-700 p-5">
          <h2 className="text-base font-bold text-white">Add a field</h2>
          {atLimit ? (
            <p className="text-sm text-amber-200">
              {limit === 0 ? 'Custom fields are included from the Starter plan.' : `Your plan includes ${limit} custom fields.`}{' '}
              <Link href="/settings/billing" className="font-semibold underline">See plans</Link>
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-gray-300">
                  Field name
                  <input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Budget range" className={`mt-1 w-full ${input}`} />
                </label>
                <label className="text-sm text-gray-300">
                  Type
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CustomFieldType })} className={`mt-1 w-full ${input}`}>
                    {Object.entries(CUSTOM_FIELD_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
              </div>
              {form.type === 'select' && (
                <label className="block text-sm text-gray-300">
                  Choices, separated by commas
                  <input required value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} placeholder="Under 5M, 5M to 10M, Over 10M" className={`mt-1 w-full ${input}`} />
                </label>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} />
                Required when adding a lead
              </label>
              {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
              <button disabled={busy} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">{busy ? 'Adding…' : 'Add field'}</button>
              {limit !== null && <p className="text-xs text-gray-500">{fields.length} of {limit} fields used on your plan.</p>}
            </>
          )}
        </form>
      )}
    </div>
  );
}
