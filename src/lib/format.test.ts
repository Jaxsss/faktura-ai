import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../types';
import { dateLabel, invoiceStatus, money, newInvoice, suggestNumber } from './format';

afterEach(() => vi.useRealTimers());
describe('invoice defaults and presentation', () => {
  it('creates an independent draft without consuming a number', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T12:00:00'));
    const settings = { ...defaultSettings, numberingYear: 2026, nextNumber: 7 };
    const a = newInvoice(settings),
      b = newInvoice(settings);
    expect(a.id).not.toBe(b.id);
    expect(a.number).toBe('2026-007');
    expect(b.number).toBe(a.number);
    expect(settings.nextNumber).toBe(7);
    expect(a.dueDate).toBe('2026-11-04');
    expect(a.items[0].vatRate).toBe(0);
    expect(a.taxMode).toBe('nonvat');
    a.supplier.name = 'Changed';
    expect(settings.name).toBe('');
  });
  it('supports configured padding and starts a new year at one', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-01T12:00:00'));
    expect(
      suggestNumber({
        ...defaultSettings,
        numberingYear: 2026,
        nextNumber: 81,
        numberFormat: 'FV-{YYYY}-{NNNN}',
      }),
    ).toBe('FV-2027-0001');
  });
  it('derives overdue status only for unpaid issued documents', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T12:00:00'));
    const i = { ...newInvoice(defaultSettings), dueDate: '2026-10-20' };
    expect(invoiceStatus(i)).toBe('draft');
    expect(invoiceStatus({ ...i, status: 'issued' })).toBe('overdue');
    expect(invoiceStatus({ ...i, status: 'paid' })).toBe('paid');
    expect(invoiceStatus({ ...i, status: 'issued', dueDate: '2026-10-21' })).toBe('issued');
  });
  it('formats Czech dates and decimal input, including incomplete draft dates', () => {
    expect(dateLabel('2026-01-03')).toBe('03.01.2026');
    expect(dateLabel('')).toBe('—');
    expect(dateLabel('invalid')).toBe('—');
    expect(money('1500,50')).not.toContain('NaN');
    expect(money('1500.50', 'EUR')).toContain('€');
  });
});
