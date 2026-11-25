import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from '../lib/csv';
import { cleanImportedLead, guessField } from '../lib/leadImport';
import { normalizePhone } from '../lib/phone';

describe('CSV', () => {
  it('parses quotes, commas, line breaks inside quotes, CRLF and the Excel BOM', () => {
    const text = '﻿Name,Notes\r\n"Otieno, John","Said ""call me""\nnext week"\r\nAmina,\r\n\r\n';
    expect(parseCsv(text)).toEqual([['Name', 'Notes'], ['Otieno, John', 'Said "call me"\nnext week'], ['Amina', '']]);
  });
  it('round-trips through toCsv and neutralises spreadsheet formulas', () => {
    const csv = toCsv(['a', 'b'], [['x,y', '=SUM(A1)']]);
    expect(parseCsv(csv)).toEqual([['a', 'b'], ['x,y', "'=SUM(A1)"]]);
  });
});

describe('phone numbers', () => {
  it.each([
    ['0712 345 678', '254712345678'],
    ['+254 712 345 678', '254712345678'],
    ['254712345678', '254712345678'],
    ['712345678', '254712345678'],
    ['0110 123 456', '254110123456'],
    ['+44 7700 900123', '447700900123'],
  ])('%s -> %s', (input, out) => expect(normalizePhone(input)).toBe(out));
  it('rejects things that are not phone numbers', () => {
    expect(normalizePhone('hello')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
});

describe('lead import', () => {
  it('guesses columns from common English and Swahili headers', () => {
    expect(guessField('Full Name')).toBe('contactName');
    expect(guessField('E-mail')).toBe('email');
    expect(guessField('WhatsApp')).toBe('phone');
    expect(guessField('Simu')).toBe('phone');
    expect(guessField('Favourite colour')).toBe('');
  });
  it('accepts a phone-only row and normalises it', () => {
    expect(cleanImportedLead({ contactName: 'Amina', phone: '0712345678' })).toMatchObject({ lead: { contactName: 'Amina', phone: '254712345678', email: null } });
  });
  it('uses the company as the name when there is no person', () => {
    expect(cleanImportedLead({ companyName: 'Sunrise Academy', email: 'info@sunrise.ac.ke' })).toMatchObject({ lead: { contactName: 'Sunrise Academy' } });
  });
  it('explains why a row is skipped', () => {
    expect(cleanImportedLead({ phone: '0712345678' })).toEqual({ error: 'Missing contact name' });
    expect(cleanImportedLead({ contactName: 'A' })).toEqual({ error: 'Needs an email or a phone number' });
    expect(cleanImportedLead({ contactName: 'A', email: 'nope' })).toEqual({ error: 'Invalid email "nope"' });
    expect(cleanImportedLead({ contactName: 'A', phone: '12' })).toEqual({ error: 'Invalid phone "12"' });
  });
  it('reads deal values written with currency and commas', () => {
    expect(cleanImportedLead({ contactName: 'A', phone: '0712345678', dealValue: 'KES 1,250,000' })).toMatchObject({ lead: { dealValue: 1250000 } });
  });
});
