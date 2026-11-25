import { describe, expect, it } from 'vitest';
import { customFieldKey, validateCustomValues } from '../lib/customFields';

const defs = [
  { key: 'budget', label: 'Budget', type: 'number', options: null, required: true },
  { key: 'size', label: 'Plot size', type: 'select', options: ['50x100', '100x100'], required: false },
  { key: 'visit', label: 'Visit date', type: 'date', options: null, required: false },
  { key: 'paid', label: 'Paid deposit', type: 'checkbox', options: null, required: false },
  { key: 'alt', label: 'Alt phone', type: 'phone', options: null, required: false },
] as any;

describe('validateCustomValues', () => {
  it('converts values and drops unknown keys', () => {
    const r = validateCustomValues(defs, { budget: '1,500,000', size: '50x100', visit: '2026-12-01', paid: 'Ndio', alt: '0712 345 678', hack: 'x' });
    expect(r).toEqual({ values: { budget: 1500000, size: '50x100', visit: '2026-12-01', paid: true, alt: '254712345678' } });
  });
  it('rejects bad input', () => {
    expect(validateCustomValues(defs, {})).toEqual({ error: 'Budget is required.' });
    expect(validateCustomValues(defs, { budget: 'lots' })).toHaveProperty('error');
    expect(validateCustomValues(defs, { budget: 1, size: 'huge' })).toHaveProperty('error');
    expect(validateCustomValues(defs, { budget: 1, visit: '01/12/2026' })).toHaveProperty('error');
  });
  it('partial updates only touch the fields sent', () => {
    expect(validateCustomValues(defs, { size: '' }, true)).toEqual({ values: { size: null } });
  });
  it('makes keys from labels', () => {
    expect(customFieldKey('Budget range (KES)')).toMatch(/^[a-z0-9_]+$/);
  });
});
