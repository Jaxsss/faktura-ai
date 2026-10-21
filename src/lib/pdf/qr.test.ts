import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../types';
import { newInvoice } from '../format';
import { calculateInvoice } from '../calculations';
import { paymentQr } from './qr';

function invoiceForQr() {
  const invoice = newInvoice(defaultSettings);
  invoice.items[0].unitPrice = '100';
  invoice.variableSymbol = '123456';
  return invoice;
}

describe('Czech QR payment', () => {
  it('creates an offline QR for a checksummed domestic account', async () => {
    const invoice = invoiceForQr();
    invoice.supplier.account = '19-2000145399';
    invoice.supplier.bankCode = '0800';
    expect(await paymentQr(invoice, calculateInvoice(invoice))).toMatch(/^data:image\/png;base64,/);
  });

  it('rejects zero and malformed bank accounts', async () => {
    const invoice = invoiceForQr();
    invoice.supplier.account = '0000000000';
    invoice.supplier.bankCode = '0000';
    expect(await paymentQr(invoice, calculateInvoice(invoice))).toBeUndefined();
    invoice.supplier.iban = 'CZ6508000000192000145390';
    expect(await paymentQr(invoice, calculateInvoice(invoice))).toBeUndefined();
  });

  it('requires CZK transfer with a positive amount', async () => {
    const invoice = invoiceForQr();
    invoice.supplier.iban = 'CZ6508000000192000145399';
    invoice.currency = 'EUR';
    expect(await paymentQr(invoice, calculateInvoice(invoice))).toBeUndefined();
    invoice.currency = 'CZK';
    invoice.items[0].unitPrice = '0';
    expect(await paymentQr(invoice, calculateInvoice(invoice))).toBeUndefined();
  });
});
