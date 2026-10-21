export type Currency = 'CZK' | 'EUR' | 'USD';
export type PaymentMethod = 'transfer' | 'cash' | 'card' | 'other';
export type TaxMode = 'nonvat' | 'standard' | 'reverse' | 'exempt';
export interface Party {
  name: string;
  tradingName: string;
  ico: string;
  dic: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  email: string;
  phone: string;
  website: string;
}
export interface Customer extends Party {
  id: string;
  contact: string;
  notes: string;
}
export interface Settings extends Party {
  id: 'company';
  vatPayer: boolean;
  logo?: Blob;
  showLogo: boolean;
  bankName: string;
  account: string;
  bankCode: string;
  iban: string;
  swift: string;
  paymentMethod: PaymentMethod;
  currency: Currency;
  dueDays: number;
  registry: string;
  footer: string;
  numberFormat: string;
  nextNumber: number;
  numberingYear: number;
  accent: string;
}
export interface Preferences {
  id: 'preferences';
  language: 'cs';
  appearance: 'light';
  template: 'minimal';
}
export interface InvoiceItem {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  vatRate: number;
}
export interface Invoice {
  id: string;
  number: string;
  supplier: Settings;
  customer: Party;
  customerId?: string;
  issueDate: string;
  dueDate: string;
  taxableDate: string;
  deliveryDate: string;
  dueDays: number | null;
  currency: Currency;
  paymentMethod: PaymentMethod;
  variableSymbol: string;
  paymentReference: string;
  items: InvoiceItem[];
  taxMode: TaxMode;
  pricesIncludeVat: boolean;
  discount: string;
  status: 'draft' | 'issued' | 'paid';
  paidDate?: string;
  note: string;
  internalNote: string;
  footer: string;
  orderNumber: string;
  paymentInstructions: string;
  exemptionReason: string;
  createdAt: string;
  updatedAt: string;
}
export interface LineTotal {
  net: string;
  vat: string;
  gross: string;
  discount: string;
}
export interface VatGroup {
  rate: number;
  base: string;
  vat: string;
}
export interface InvoiceTotals {
  lines: LineTotal[];
  subtotal: string;
  discount: string;
  net: string;
  vat: string;
  total: string;
  vatGroups: VatGroup[];
}
export const emptyParty: Party = {
  name: '',
  tradingName: '',
  ico: '',
  dic: '',
  street: '',
  city: '',
  zip: '',
  country: 'Česká republika',
  email: '',
  phone: '',
  website: '',
};
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
}
export const defaultSettings: Settings = {
  ...emptyParty,
  id: 'company',
  vatPayer: false,
  showLogo: true,
  bankName: '',
  account: '',
  bankCode: '',
  iban: '',
  swift: '',
  paymentMethod: 'transfer',
  currency: 'CZK',
  dueDays: 14,
  registry: '',
  footer: 'Děkujeme za spolupráci.',
  numberFormat: '{YYYY}-{NNN}',
  nextNumber: 1,
  numberingYear: new Date().getFullYear(),
  accent: '#294d42',
};
export const defaultPreferences: Preferences = {
  id: 'preferences',
  language: 'cs',
  appearance: 'light',
  template: 'minimal',
};
export const paymentLabels: Record<PaymentMethod, string> = {
  transfer: 'Bankovním převodem',
  cash: 'Hotově',
  card: 'Kartou',
  other: 'Jiná',
};
