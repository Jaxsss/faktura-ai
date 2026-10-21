import type { Currency, Invoice, Settings } from '../types';
import { addDays, localDate, emptyParty } from '../types';
export const money = (amount: string | number, currency: Currency = 'CZK') =>
  new Intl.NumberFormat('cs-CZ', { style: 'currency', currency, minimumFractionDigits: 2 }).format(
    Number(typeof amount === 'string' ? amount.replace(',', '.') : amount),
  );
export const dateLabel = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(new Date(`${date}T12:00:00`).getTime())
    ? new Intl.DateTimeFormat('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
        .format(new Date(`${date}T12:00:00`))
        .replace(/\s/g, '')
    : '—';
export function suggestNumber(settings: Settings): string {
  const year = new Date().getFullYear();
  const n = settings.numberingYear === year ? settings.nextNumber : 1;
  return settings.numberFormat
    .replace('{YYYY}', String(year))
    .replace(/\{(N+)\}/g, (_, ns: string) => String(n).padStart(ns.length, '0'));
}
export function newInvoice(settings: Settings): Invoice {
  const number = suggestNumber(settings),
    today = localDate(),
    now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    number,
    supplier: structuredClone(settings),
    customer: { ...emptyParty },
    issueDate: today,
    dueDate: addDays(today, settings.dueDays),
    taxableDate: today,
    deliveryDate: '',
    dueDays: settings.dueDays,
    currency: settings.currency,
    paymentMethod: settings.paymentMethod,
    variableSymbol: /^\d{1,10}$/.test(number.replace(/\D/g, '')) ? number.replace(/\D/g, '') : '',
    paymentReference: '',
    items: [
      {
        id: crypto.randomUUID(),
        description: '',
        quantity: '1',
        unit: 'ks',
        unitPrice: '',
        vatRate: settings.vatPayer ? 21 : 0,
      },
    ],
    taxMode: settings.vatPayer ? 'standard' : 'nonvat',
    pricesIncludeVat: false,
    discount: '0',
    status: 'draft',
    note: '',
    internalNote: '',
    footer: settings.footer,
    orderNumber: '',
    paymentInstructions: '',
    exemptionReason: '',
    createdAt: now,
    updatedAt: now,
  };
}
export function invoiceStatus(i: Invoice) {
  return i.status === 'paid'
    ? 'paid'
    : i.status === 'draft'
      ? 'draft'
      : i.dueDate < localDate()
        ? 'overdue'
        : 'issued';
}
export const statusLabels = {
  paid: 'Uhrazená',
  draft: 'Koncept',
  overdue: 'Po splatnosti',
  issued: 'Vystavená',
};
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
