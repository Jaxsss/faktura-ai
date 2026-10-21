import { z } from 'zod';
import { type AppData, loadData } from '../db';
import type { Customer, Invoice, Preferences, Settings } from '../types';
import { replaceData } from '../db';
import { validateInvoice } from './validation';

import { text, party, logoDataUrl, settingsSchema } from './settings';

const customerSchema = party.extend({ id: z.string().min(1).max(100), contact: text, notes: text });
const preferencesSchema = z.object({
  id: z.literal('preferences'),
  language: z.literal('cs'),
  appearance: z.literal('light'),
  template: z.literal('minimal'),
});
const invoiceSchema = z.object({
  id: z.string().min(1).max(100),
  number: z.string().max(100),
  supplier: settingsSchema,
  customer: party,
  customerId: z.string().max(100).optional(),
  issueDate: z.string().max(32),
  dueDate: z.string().max(32),
  taxableDate: z.string().max(32),
  deliveryDate: z.string().max(32),
  dueDays: z.number().int().min(0).max(365).nullable(),
  currency: z.enum(['CZK', 'EUR', 'USD']),
  paymentMethod: z.enum(['transfer', 'cash', 'card', 'other']),
  variableSymbol: z.string().max(32),
  paymentReference: text,
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        description: text,
        quantity: z.string().max(100),
        unit: text,
        unitPrice: z.string().max(100),
        vatRate: z.number().finite().min(0).max(100),
      }),
    )
    .max(500),
  taxMode: z.enum(['nonvat', 'standard', 'reverse', 'exempt']),
  pricesIncludeVat: z.boolean(),
  discount: z.string().max(100),
  status: z.enum(['draft', 'issued', 'paid']),
  paidDate: z.string().max(32).optional(),
  note: text,
  internalNote: text,
  footer: text,
  orderNumber: text,
  paymentInstructions: text,
  exemptionReason: text,
  createdAt: z.string().max(64),
  updatedAt: z.string().max(64),
});
const portableSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string().datetime(),
  settings: settingsSchema,
  preferences: preferencesSchema,
  customers: z.array(customerSchema).max(100_000),
  invoices: z.array(invoiceSchema).max(100_000),
  assets: z.record(z.string().max(100), logoDataUrl).optional(),
});

export type Backup = {
  schemaVersion: 1;
  exportedAt: string;
  settings: Omit<Settings, 'logo'> & { logo?: string };
  preferences: Preferences;
  customers: Customer[];
  invoices: (Omit<Invoice, 'supplier'> & {
    supplier: Omit<Settings, 'logo'> & { logo?: string };
  })[];
  assets?: Record<string, string>;
};

async function toDataUrl(blob?: Blob): Promise<string | undefined> {
  if (!blob) return undefined;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}
function fromDataUrl(value?: string): Blob | undefined {
  if (!value) return undefined;
  const match = /^data:([\w.+/-]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  if (!match) throw new Error('Záloha obsahuje neplatný obrázek loga.');
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  } catch {
    throw new Error('Záloha obsahuje neplatně zakódovaný obrázek loga.');
  }
  if (bytes.byteLength > 5_000_000) throw new Error('Logo v záloze je příliš velké.');
  return new Blob([bytes], { type: match[1] });
}
async function portableSettings(settings: Settings) {
  return { ...settings, logo: await toDataUrl(settings.logo) };
}

export async function createBackup(): Promise<Blob> {
  const { settings, preferences, customers, invoices } = await loadData();
  const assets: Record<string, string> = {};
  const idsByData = new Map<string, string>();
  const register = (data: string) => {
    const prior = idsByData.get(data);
    if (prior) return `asset:${prior}`;
    const id = `logo-${idsByData.size + 1}`;
    idsByData.set(data, id);
    assets[id] = data;
    return `asset:${id}`;
  };
  const portableSettingsWithAssets = async (value: Settings) => {
    const portable = await portableSettings(value);
    return portable.logo ? { ...portable, logo: register(portable.logo) } : portable;
  };
  const backup: Backup = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    settings: await portableSettingsWithAssets(settings),
    preferences,
    customers,
    invoices: await Promise.all(
      invoices.map(async (invoice) => ({
        ...invoice,
        supplier: await portableSettingsWithAssets(invoice.supplier),
      })),
    ),
    assets,
  };
  const serialized = JSON.stringify(backup, null, 2);
  if (new TextEncoder().encode(serialized).byteLength > 50_000_000)
    throw new Error('Záloha přesahuje maximální velikost 50 MB.');
  parseBackup(serialized);
  return new Blob([serialized], { type: 'application/json;charset=utf-8' });
}

export function parseBackup(source: string): Backup {
  if (source.length > 50_000_000) throw new Error('Soubor zálohy je příliš velký.');
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    throw new Error('Soubor není platný JSON.');
  }
  if (
    typeof raw !== 'object' ||
    raw === null ||
    !('schemaVersion' in raw) ||
    raw.schemaVersion !== 1
  )
    throw new Error('Verze zálohy není podporována.');
  const parsed = portableSchema.safeParse(raw);
  if (!parsed.success)
    throw new Error(
      `Záloha má neplatnou strukturu: ${parsed.error.issues
        .slice(0, 5)
        .map((issue) => issue.path.join('.') + ' – ' + issue.message)
        .join('; ')}`,
    );
  const backup = parsed.data as Backup;
  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length)
      throw new Error(`Záloha obsahuje duplicitní ${label}.`);
  };
  unique(
    backup.customers.map((x) => x.id),
    'ID zákazníků',
  );
  unique(
    backup.invoices.map((x) => x.id),
    'ID faktur',
  );
  unique(
    backup.invoices.filter((x) => x.status !== 'draft').map((x) => x.number),
    'čísla vystavených faktur',
  );
  const assets = backup.assets ?? {};
  for (const image of Object.values(assets)) fromDataUrl(image);
  const validateLogo = (image?: string) => {
    if (!image) return;
    if (image.startsWith('asset:')) {
      const id = image.slice('asset:'.length);
      if (!assets[id]) throw new Error(`Záloha odkazuje na chybějící obrázek ${id}.`);
    } else fromDataUrl(image);
  };
  validateLogo(backup.settings.logo);
  for (const invoice of backup.invoices) validateLogo(invoice.supplier.logo);
  const validDate = (value: string) =>
    !value ||
    (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
  for (const invoice of backup.invoices) {
    if (invoice.status === 'draft') continue;
    if (invoice.items.some((item) => ![0, 12, 21].includes(item.vatRate)))
      throw new Error(`Faktura ${invoice.number} obsahuje nepodporovanou sazbu DPH.`);
    if (
      ![
        invoice.issueDate,
        invoice.dueDate,
        invoice.taxableDate,
        invoice.deliveryDate,
        invoice.paidDate ?? '',
      ].every(validDate)
    )
      throw new Error(`Faktura ${invoice.number} obsahuje neplatné datum.`);
    if (
      !Number.isFinite(Date.parse(invoice.createdAt)) ||
      !Number.isFinite(Date.parse(invoice.updatedAt))
    )
      throw new Error(`Faktura ${invoice.number} obsahuje neplatné časové razítko.`);
    if (invoice.dueDate && invoice.issueDate && invoice.dueDate < invoice.issueDate)
      throw new Error(`Faktura ${invoice.number} obsahuje rozporná data.`);
    if (
      !/^\d+(?:[.,]\d+)?$/.test(invoice.discount) ||
      !Number.isFinite(Number(invoice.discount.replace(',', '.'))) ||
      Number(invoice.discount.replace(',', '.')) > 100
    )
      throw new Error(`Faktura ${invoice.number} obsahuje neplatnou slevu.`);
    for (const item of invoice.items) {
      const quantity = Number(item.quantity.replace(',', '.'));
      const price = Number(item.unitPrice.replace(',', '.'));
      if (
        !/^\d+(?:[.,]\d+)?$/.test(item.quantity) ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !/^\d+(?:[.,]\d+)?$/.test(item.unitPrice) ||
        !Number.isFinite(price)
      )
        throw new Error(`Faktura ${invoice.number} obsahuje neplatnou číselnou hodnotu.`);
    }
    const invoiceErrors = validateInvoice(invoice as Invoice);
    if (invoiceErrors.length)
      throw new Error(
        `Faktura ${invoice.number || '(bez čísla)'} není platná: ${invoiceErrors.join(' ')}`,
      );
  }
  return backup;
}

export async function restoreBackup(backup: Backup): Promise<void> {
  // Revalidate even if callers construct a Backup value without parseBackup.
  const validated = parseBackup(JSON.stringify(backup));
  const resolveLogo = (value?: string) =>
    value?.startsWith('asset:') ? validated.assets?.[value.slice('asset:'.length)] : value;
  const settings = {
    ...validated.settings,
    logo: fromDataUrl(resolveLogo(validated.settings.logo)),
  } as Settings;
  const invoices = validated.invoices.map((invoice) => ({
    ...invoice,
    supplier: {
      ...invoice.supplier,
      logo: fromDataUrl(resolveLogo(invoice.supplier.logo)),
    } as Settings,
  }));
  const data: AppData = {
    settings,
    preferences: validated.preferences,
    customers: validated.customers,
    invoices,
  };
  await replaceData(data);
}
