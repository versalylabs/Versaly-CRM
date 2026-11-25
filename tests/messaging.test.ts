import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({ default: {} }));

import { estimateCost, fillTemplate, nextDeliveryStatus, templateParamCount, windowOpen } from '../lib/whatsapp';
import { smsNumber, smsSegments } from '../lib/sms';

const now = new Date('2026-11-25T12:00:00Z');

describe('WhatsApp 24-hour window', () => {
  it('is open within 24 hours of the customer\'s last message, closed after or with none', () => {
    expect(windowOpen(new Date('2026-11-24T12:00:01Z'), now)).toBe(true);
    expect(windowOpen(new Date('2026-11-24T12:00:00Z'), now)).toBe(false);
    expect(windowOpen(null, now)).toBe(false);
  });
});

describe('delivery ticks', () => {
  it('only moves forward: sent -> delivered -> read', () => {
    expect(nextDeliveryStatus('SENT', 'delivered')).toBe('DELIVERED');
    expect(nextDeliveryStatus('READ', 'delivered')).toBe('READ'); // late "delivered" after "read"
    expect(nextDeliveryStatus('DELIVERED', 'sent')).toBe('DELIVERED');
  });
  it('failed always wins and sticks', () => {
    expect(nextDeliveryStatus('DELIVERED', 'failed')).toBe('FAILED');
    expect(nextDeliveryStatus('FAILED', 'read')).toBe('FAILED');
  });
});

describe('templates', () => {
  it('counts distinct placeholders and fills them', () => {
    expect(templateParamCount('Hi {{1}}, KES {{2}} due {{3}}. Thanks {{1}}')).toBe(3);
    expect(templateParamCount('No placeholders')).toBe(0);
    expect(fillTemplate('Hi {{1}}, KES {{2}}', ['Jane', '500'])).toBe('Hi Jane, KES 500');
  });
});

describe('WhatsApp cost estimate', () => {
  it('charges templates by category and keeps service replies free', () => {
    expect(estimateCost({ service: 1000, utility: 0, marketing: 0 })).toBe(0);
    expect(estimateCost({ service: 5, marketing: 10, utility: 20 })).toBe(Math.round(10 * 2.9 + 20 * 0.55));
  });
});

describe('SMS', () => {
  it('counts segments: 160 GSM characters per SMS, 153 per part when longer, 70/67 with emoji', () => {
    expect(smsSegments('a'.repeat(160))).toBe(1);
    expect(smsSegments('a'.repeat(161))).toBe(2);
    expect(smsSegments('a'.repeat(306))).toBe(2);
    expect(smsSegments('a'.repeat(307))).toBe(3);
    expect(smsSegments('Habari 👋')).toBe(1);
    expect(smsSegments('👋'.repeat(40))).toBe(2); // 80 UTF-16 units > 70
    expect(smsSegments('')).toBe(0);
  });
  it('formats numbers for Africa\'s Talking', () => {
    expect(smsNumber('0712 345 678')).toBe('+254712345678');
    expect(smsNumber('nope')).toBeNull();
  });
});
