import { describe, expect, it } from 'vitest';
import { pdf } from '@react-pdf/renderer';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { defaultSettings, emptyParty } from '../../types';
import { newInvoice } from '../format';
import { calculateInvoice } from '../calculations';
import { InvoiceDocument } from './InvoiceDocument';

const cases = [
  { ico: '12345679', dic: '' },
  { ico: '12345679', dic: 'CZ12345679' },
  { ico: '12345679', dic: 'CZ1234567890' },
  { ico: '', dic: 'CZ12345679' },
];

describe('rendered PDF company identifiers', () => {
  it.each([
    [false, true],
    [true, false],
    [true, true],
    [false, false],
  ])(
    'aligns contacts with supplier DIČ=%s and customer DIČ=%s',
    async (supplierDic, customerDic) => {
      const invoice = newInvoice({
        ...defaultSettings,
        name: 'Dodavatel',
        tradingName: 'Studio dodavatele',
        ico: '12345679',
        dic: supplierDic ? 'CZ12345679' : '',
        email: 'supplier@example.test',
        phone: '+420 111 111 111',
      });
      invoice.customer = {
        ...emptyParty,
        name: 'Odběratel',
        ico: '12345679',
        dic: customerDic ? 'CZ12345679' : '',
        email: 'customer@example.test',
        phone: '+420 222 222 222',
      };
      const blob = await pdf(
        <InvoiceDocument invoice={invoice} totals={calculateInvoice(invoice)} />,
      ).toBlob();
      const document = await getDocument({ data: new Uint8Array(await blob.arrayBuffer()) })
        .promise;
      try {
        const content = await (await document.getPage(1)).getTextContent();
        const items = content.items.flatMap((item) => ('str' in item ? [item] : []));
        const y = (text: string) => items.find((item) => item.str === text)!.transform[5];
        expect(y(invoice.supplier.email)).toBeCloseTo(y(invoice.customer.email), 2);
        expect(y(invoice.supplier.phone)).toBeCloseTo(y(invoice.customer.phone), 2);
        if (supplierDic || customerDic) {
          const dicLabel = items.find((item) => item.str.includes('DIČ:'))!;
          expect(dicLabel.transform[5] - y(invoice.supplier.email)).toBeGreaterThan(18);
        }
        expect(document.numPages).toBe(1);
      } finally {
        await document.destroy();
      }
    },
  );

  it.each(cases)(
    'keeps customer identifiers complete and readable: $ico / $dic',
    async ({ ico, dic }) => {
      const invoice = newInvoice({ ...defaultSettings, name: 'Dodavatel' });
      invoice.customer = { ...emptyParty, name: 'Odběratel', ico, dic };
      const blob = await pdf(
        <InvoiceDocument invoice={invoice} totals={calculateInvoice(invoice)} />,
      ).toBlob();
      const document = await getDocument({ data: new Uint8Array(await blob.arrayBuffer()) })
        .promise;
      try {
        const page = await document.getPage(1);
        const content = await page.getTextContent();
        const items = content.items.flatMap((item) => ('str' in item ? [item] : []));
        const text = items
          .map((item) => item.str)
          .join(' ')
          .replace(/\s+/g, ' ');
        if (ico) expect(text).toContain(`IČO: ${ico}`);
        else expect(text).not.toContain('IČO:');
        if (dic) expect(text).toContain(`DIČ: ${dic}`);
        else expect(text).not.toContain('DIČ:');
        if (ico && dic) {
          const icoLabel = items.find((item) => item.str.includes('IČO:'))!;
          const dicLabel = items.find((item) => item.str.includes('DIČ:'))!;
          // Both identifiers must stay inside the customer column on distinct, readable rows.
          expect(icoLabel.transform[4]).toBeGreaterThanOrEqual(297);
          expect(dicLabel.transform[4]).toBeGreaterThanOrEqual(297);
          expect(icoLabel.transform[5] - dicLabel.transform[5]).toBeGreaterThan(5);
        }
      } finally {
        await document.destroy();
      }
    },
  );
});
