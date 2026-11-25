import { normalizePhone } from './phone';

export const CUSTOM_FIELD_TYPES = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  select: 'Dropdown',
  checkbox: 'Yes / no',
  phone: 'Phone number',
} as const;

export type CustomFieldType = keyof typeof CUSTOM_FIELD_TYPES;
export type CustomFieldDef = { key: string; label: string; type: string; options?: unknown; required?: boolean };
export type CustomValues = Record<string, string | number | boolean | null>;

/** A stable key from a label: "Plot size (acres)" -> "plot_size_acres". */
export const customFieldKey = (label: string) =>
  label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'field';

/**
 * Validates submitted custom-field values against the workspace's definitions.
 * Unknown keys are dropped; empty values become null; `partial` (for updates) skips missing keys
 * instead of treating them as empty, so required fields are only enforced when present or on create.
 */
export function validateCustomValues(defs: CustomFieldDef[], input: unknown, partial = false): { values: CustomValues } | { error: string } {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const values: CustomValues = {};
  for (const def of defs) {
    if (partial && !(def.key in src)) continue;
    const raw = src[def.key];
    const empty = raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');
    if (empty) {
      if (def.required && def.type !== 'checkbox') return { error: `${def.label} is required.` };
      values[def.key] = def.type === 'checkbox' ? false : null;
      continue;
    }
    const str = String(raw).trim();
    switch (def.type) {
      case 'number': {
        const num = Number(str.replace(/,/g, ''));
        if (!Number.isFinite(num)) return { error: `${def.label} must be a number.` };
        values[def.key] = num;
        break;
      }
      case 'date': {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(str) || Number.isNaN(new Date(str).getTime())) return { error: `${def.label} must be a date (YYYY-MM-DD).` };
        values[def.key] = str;
        break;
      }
      case 'select': {
        const options = Array.isArray(def.options) ? def.options.map(String) : [];
        if (!options.includes(str)) return { error: `${def.label} must be one of: ${options.join(', ')}.` };
        values[def.key] = str;
        break;
      }
      case 'checkbox':
        values[def.key] = raw === true || ['true', 'yes', 'y', '1', 'ndio'].includes(str.toLowerCase());
        break;
      case 'phone': {
        const phone = normalizePhone(str);
        if (!phone) return { error: `${def.label} must be a valid phone number.` };
        values[def.key] = phone;
        break;
      }
      default:
        values[def.key] = str.slice(0, 1000);
    }
  }
  return { values };
}
