'use client';

import { useEffect, useState } from 'react';
import type { CustomFieldType } from '@/lib/customFields';

export type CustomFieldDef = { key: string; label: string; type: CustomFieldType; options: string[] | null; required: boolean };
export type CustomValues = Record<string, string | number | boolean | null | undefined>;

/** The workspace's custom lead fields (empty until loaded or when there are none). */
export function useCustomFields() {
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  useEffect(() => {
    fetch('/api/custom-fields')
      .then((r) => (r.ok ? r.json() : { fields: [] }))
      .then((d) => setFields(d.fields || []))
      .catch(() => setFields([]));
  }, []);
  return fields;
}

/** Shows a stored value as text: Yes/No for checkboxes, empty values as a dash. */
export function formatCustomValue(field: CustomFieldDef, value: unknown) {
  if (value === undefined || value === null || value === '') return '—';
  if (field.type === 'checkbox') return value ? 'Yes' : 'No';
  if (field.type === 'number') return Number(value).toLocaleString('en-US');
  return String(value);
}

/** One input per custom field. Values stay as typed; the server validates and converts them. */
export default function CustomFieldInputs({
  fields,
  values,
  onChange,
  inputClass,
  labelClass = 'block text-xs font-semibold text-slate-300 mb-1.5',
}: {
  fields: CustomFieldDef[];
  values: CustomValues;
  onChange: (key: string, value: string | boolean) => void;
  inputClass: string;
  labelClass?: string;
}) {
  return (
    <>
      {fields.map((f) => {
        const id = `cf-${f.key}`;
        const value = values[f.key];
        const label = (
          <span className={labelClass}>
            {f.label}
            {f.required && <span className="text-rose-300"> *</span>}
          </span>
        );
        if (f.type === 'checkbox') {
          return (
            <label key={f.key} htmlFor={id} className="flex items-center gap-2 text-sm text-slate-300">
              <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(f.key, e.target.checked)} />
              {f.label}
            </label>
          );
        }
        return (
          <label key={f.key} htmlFor={id} className="block">
            {label}
            {f.type === 'select' ? (
              <select id={id} required={f.required} className={inputClass} value={String(value ?? '')} onChange={(e) => onChange(f.key, e.target.value)}>
                <option value="">Choose…</option>
                {(f.options || []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                required={f.required}
                type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'phone' ? 'tel' : 'text'}
                className={inputClass}
                value={String(value ?? '')}
                onChange={(e) => onChange(f.key, e.target.value)}
              />
            )}
          </label>
        );
      })}
    </>
  );
}
