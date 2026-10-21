import { pdf } from '@react-pdf/renderer';
import { Buffer } from 'buffer';
import type { Invoice } from '../../types';
import { calculateInvoice } from '../calculations';
import { downloadBlob } from '../format';
import { InvoiceDocument } from './InvoiceDocument';
import { paymentQr } from './qr';

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Logo se nepodařilo načíst.'));
    reader.readAsDataURL(blob);
  });
}

export async function generateInvoicePdf(invoice: Invoice): Promise<Blob> {
  // react-pdf's image layout checks global Buffer even in its browser bundle.
  if (!('Buffer' in globalThis)) Object.assign(globalThis, { Buffer });
  const totals = calculateInvoice(invoice);
  const [qr, logo] = await Promise.all([
    paymentQr(invoice, totals),
    invoice.supplier.showLogo && invoice.supplier.logo
      ? blobDataUrl(invoice.supplier.logo)
      : Promise.resolve(undefined),
  ]);
  return pdf(<InvoiceDocument invoice={invoice} totals={totals} qr={qr} logo={logo} />).toBlob();
}

export async function downloadInvoicePdf(invoice: Invoice): Promise<void> {
  const blob = await generateInvoicePdf(invoice);
  const safeNumber = (invoice.number || 'nova').replace(/[^a-zA-Z0-9_-]+/g, '-');
  downloadBlob(blob, `faktura-${safeNumber}.pdf`);
}
