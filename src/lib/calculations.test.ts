import { describe, expect, it } from 'vitest';
import { calculateInvoice } from './calculations';
import type { Invoice, InvoiceItem, TaxMode } from '../types';

function item(quantity: string, unitPrice: string, vatRate = 21): InvoiceItem {
  return { id: crypto.randomUUID(), description: '', unit: 'ks', quantity, unitPrice, vatRate };
}

function invoice(
  items: InvoiceItem[],
  options: Partial<Pick<Invoice, 'taxMode' | 'pricesIncludeVat' | 'discount'>> = {},
): Pick<Invoice, 'items' | 'taxMode' | 'pricesIncludeVat' | 'discount'> {
  return { items, taxMode: 'standard', pricesIncludeVat: false, discount: '0', ...options };
}

describe('calculateInvoice', () => {
  it('sums line-rounded amounts and separates mixed VAT rates', () => {
    const result = calculateInvoice(
      invoice([item('2', '100.05', 21), item('1', '50', 12), item('1', '10', 0)]),
    );
    expect(result).toEqual({
      lines: [
        { net: '200.10', vat: '42.02', gross: '242.12', discount: '0.00' },
        { net: '50.00', vat: '6.00', gross: '56.00', discount: '0.00' },
        { net: '10.00', vat: '0.00', gross: '10.00', discount: '0.00' },
      ],
      subtotal: '260.10',
      discount: '0.00',
      net: '260.10',
      vat: '48.02',
      total: '308.12',
      vatGroups: [
        { rate: 0, base: '10.00', vat: '0.00' },
        { rate: 12, base: '50.00', vat: '6.00' },
        { rate: 21, base: '200.10', vat: '42.02' },
      ],
    });
  });

  it('applies percentage discount to each exclusive line before VAT', () => {
    const result = calculateInvoice(
      invoice([item('1', '100', 21), item('1', '50', 12)], { discount: '10' }),
    );
    expect(result.lines).toEqual([
      { net: '90.00', vat: '18.90', gross: '108.90', discount: '10.00' },
      { net: '45.00', vat: '5.40', gross: '50.40', discount: '5.00' },
    ]);
    expect(result).toMatchObject({
      subtotal: '150.00',
      discount: '15.00',
      net: '135.00',
      vat: '24.30',
      total: '159.30',
    });
  });

  it('backs VAT out of inclusive prices, including after discount', () => {
    const result = calculateInvoice(
      invoice([item('1', '121', 21), item('1', '112', 12)], {
        pricesIncludeVat: true,
        discount: '10',
      }),
    );
    expect(result.lines).toEqual([
      { net: '90.00', vat: '18.90', gross: '108.90', discount: '10.00' },
      { net: '90.00', vat: '10.80', gross: '100.80', discount: '10.00' },
    ]);
    expect(result).toMatchObject({
      subtotal: '200.00',
      discount: '20.00',
      net: '180.00',
      vat: '29.70',
      total: '209.70',
    });
  });

  it('reconciles inclusive VAT when rounding creates a cent difference', () => {
    const result = calculateInvoice(
      invoice([item('1', '0.05', 21), item('1', '0.05', 21)], { pricesIncludeVat: true }),
    );
    expect(result.lines).toEqual([
      { net: '0.04', vat: '0.01', gross: '0.05', discount: '0.00' },
      { net: '0.04', vat: '0.01', gross: '0.05', discount: '0.00' },
    ]);
    expect(result).toMatchObject({
      net: '0.08',
      vat: '0.02',
      total: '0.10',
      vatGroups: [{ rate: 21, base: '0.08', vat: '0.02' }],
    });
  });

  it.each(['nonvat', 'reverse', 'exempt'] as TaxMode[])(
    'does not charge supplier VAT in %s mode',
    (taxMode) => {
      const result = calculateInvoice(
        invoice([item('1', '121', 21), item('1', '50', 12)], {
          taxMode,
          pricesIncludeVat: true,
          discount: '10',
        }),
      );
      expect(result).toMatchObject({
        subtotal: '171.00',
        discount: '17.10',
        net: '153.90',
        vat: '0.00',
        total: '153.90',
      });
      expect(result.vatGroups).toEqual([{ rate: 0, base: '153.90', vat: '0.00' }]);
    },
  );

  it('handles fractional quantities, large decimal prices, and exact decimal input', () => {
    const result = calculateInvoice(
      invoice([item('1.5', '0.10'), item('1.25', '999999999999.99', 0)]),
    );
    expect(result.lines).toEqual([
      { net: '0.15', vat: '0.03', gross: '0.18', discount: '0.00' },
      { net: '1249999999999.99', vat: '0.00', gross: '1249999999999.99', discount: '0.00' },
    ]);
    expect(result.total).toBe('1250000000000.17');
    expect(calculateInvoice(invoice([item('3', '0.1', 0)])).total).toBe('0.30');
  });

  it('accepts Czech decimal commas without changing entered values', () => {
    const line = item('1,5', '100,50', 21);
    const input = invoice([line], { discount: '10,5' });
    const result = calculateInvoice(input);
    expect(result.lines[0]).toEqual({
      net: '134.92',
      vat: '28.33',
      gross: '163.25',
      discount: '15.83',
    });
    expect(input.items[0].quantity).toBe('1,5');
    expect(input.items[0].unitPrice).toBe('100,50');
    expect(input.discount).toBe('10,5');
  });

  it('treats an empty draft price as zero', () => {
    expect(calculateInvoice(invoice([item('1', '')]))).toMatchObject({
      subtotal: '0.00',
      total: '0.00',
      lines: [{ net: '0.00', vat: '0.00', gross: '0.00', discount: '0.00' }],
    });
  });

  it('rounds monetary half cents away from zero per line', () => {
    const result = calculateInvoice(invoice([item('1', '0.005', 0), item('1', '0.005', 0)]));
    expect(result.lines.map((line) => line.net)).toEqual(['0.01', '0.01']);
    expect(result.total).toBe('0.02');
  });

  it.each([
    ['quantity zero', item('0', '1'), 'Položka 1: množství musí být kladné číslo.'],
    ['quantity negative', item('-1', '1'), 'Položka 1: množství musí být kladné číslo.'],
    ['quantity malformed', item('foo', '1'), 'Položka 1: množství musí být kladné číslo.'],
    ['quantity infinite', item('Infinity', '1'), 'Položka 1: množství musí být kladné číslo.'],
    ['quantity exponent', item('1e3', '1'), 'Položka 1: množství musí být kladné číslo.'],
    ['quantity hex', item('0x10', '1'), 'Položka 1: množství musí být kladné číslo.'],
    ['price negative', item('1', '-1'), 'Položka 1: cena musí být nezáporné číslo.'],
    ['price malformed', item('1', 'abc'), 'Položka 1: cena musí být nezáporné číslo.'],
    ['price exponent', item('1', '1e3'), 'Položka 1: cena musí být nezáporné číslo.'],
    ['price hex', item('1', '0x10'), 'Položka 1: cena musí být nezáporné číslo.'],
    ['rate unsupported', item('1', '1', 15), 'Položka 1: nepodporovaná sazba DPH.'],
  ])('rejects %s', (_label, badItem, message) => {
    expect(() => calculateInvoice(invoice([badItem]))).toThrow(message);
  });

  it.each(['-1', '101', 'NaN', 'Infinity', '1e3', '0x10'])(
    'rejects invalid discount %s',
    (discount) => {
      expect(() => calculateInvoice(invoice([item('1', '1')], { discount }))).toThrow(
        'Sleva musí být číslo od 0 do 100 %.',
      );
    },
  );

  it('reports an invalid tax mode in Czech', () => {
    expect(() => calculateInvoice(invoice([], { taxMode: 'invalid' as TaxMode }))).toThrow(
      'Neplatný režim DPH.',
    );
  });

  it('returns zero totals for an empty invoice', () => {
    expect(calculateInvoice(invoice([]))).toEqual({
      lines: [],
      subtotal: '0.00',
      discount: '0.00',
      net: '0.00',
      vat: '0.00',
      total: '0.00',
      vatGroups: [],
    });
  });
});
