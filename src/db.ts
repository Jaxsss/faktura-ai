import Dexie, { type Table } from 'dexie';
import type { Customer, Invoice, Preferences, Settings } from './types';
import { defaultPreferences, defaultSettings } from './types';
import { settingsErrors } from './lib/settings';
import { validateInvoice } from './lib/validation';

class InvoiceDatabase extends Dexie {
  settings!: Table<Settings, string>;
  preferences!: Table<Preferences, string>;
  customers!: Table<Customer, string>;
  invoices!: Table<Invoice, string>;
  constructor() {
    super('faktura-ai');
    this.version(1).stores({
      settings: '&id',
      preferences: '&id',
      customers: '&id',
      invoices: '&id,number,status',
    });
  }
}

export const db = new InvoiceDatabase();
export interface AppData {
  settings: Settings;
  preferences: Preferences;
  customers: Customer[];
  invoices: Invoice[];
}

export async function loadData(): Promise<AppData> {
  const [savedSettings, savedPreferences, customers, invoices] = await Promise.all([
    db.settings.get('company'),
    db.preferences.get('preferences'),
    db.customers.toArray(),
    db.invoices.toArray(),
  ]);
  return {
    settings: savedSettings ?? structuredClone(defaultSettings),
    preferences: savedPreferences ?? structuredClone(defaultPreferences),
    customers,
    invoices,
  };
}

export async function saveSettings(
  settings: Settings,
  { adjustNumbering = false }: { adjustNumbering?: boolean } = {},
): Promise<Settings> {
  const errors = settingsErrors(settings);
  if (errors.length) throw new Error(`Nastavení není platné: ${errors.join('; ')}`);
  return db.transaction('rw', db.settings, async () => {
    const current = await db.settings.get('company');
    // Only an explicit numbering edit may replace the persisted sequence.
    const value =
      current && !adjustNumbering
        ? { ...settings, nextNumber: current.nextNumber, numberingYear: current.numberingYear }
        : settings;
    await db.settings.put(value);
    return value;
  });
}
export async function saveCustomer(customer: Customer): Promise<void> {
  await db.customers.put(customer);
}
export async function deleteCustomer(id: string): Promise<void> {
  await db.customers.delete(id);
}
export async function saveDraft(invoice: Invoice): Promise<void> {
  if (invoice.status !== 'draft') throw new Error('Uložit jako koncept lze pouze koncept faktury.');
  await db.transaction('rw', db.invoices, async () => {
    const current = await db.invoices.get(invoice.id);
    if (current && current.status !== 'draft')
      throw new Error('Vystavenou fakturu nelze přepsat konceptem.');
    await db.invoices.put(invoice);
  });
}
export async function issueInvoice(invoice: Invoice): Promise<Settings> {
  const issues = validateInvoice(invoice);
  if (issues.length) throw new Error(issues.join('\n'));
  return db.transaction('rw', db.invoices, db.settings, async () => {
    const existing = await db.invoices.get(invoice.id);
    if (existing && existing.status !== 'draft')
      throw new Error('Tuto fakturu již nelze znovu vystavit.');
    const duplicate = await db.invoices
      .where('number')
      .equals(invoice.number)
      .filter((row) => row.status !== 'draft' && row.id !== invoice.id)
      .first();
    if (duplicate) throw new Error(`Číslo faktury ${invoice.number} již bylo použito.`);
    const settings = (await db.settings.get('company')) ?? structuredClone(defaultSettings);
    const issued = { ...invoice, status: 'issued' as const, updatedAt: new Date().toISOString() };
    const next = {
      ...settings,
      nextNumber:
        settings.numberingYear === new Date().getFullYear()
          ? Math.max(settings.nextNumber, 1) + 1
          : 2,
      numberingYear: new Date().getFullYear(),
    };
    await db.invoices.put(issued);
    await db.settings.put(next);
    return next;
  });
}
export async function saveInvoice(invoice: Invoice): Promise<void> {
  if (invoice.status === 'draft') throw new Error('Pro koncept použijte saveDraft.');
  const issues = validateInvoice(invoice);
  if (issues.length) throw new Error(issues.join('\n'));
  await db.transaction('rw', db.invoices, async () => {
    const duplicate = await db.invoices
      .where('number')
      .equals(invoice.number)
      .filter((row) => row.status !== 'draft' && row.id !== invoice.id)
      .first();
    if (duplicate) throw new Error(`Číslo faktury ${invoice.number} již bylo použito.`);
    await db.invoices.put(invoice);
  });
}
export async function deleteInvoice(id: string): Promise<void> {
  await db.invoices.delete(id);
}

export async function replaceData(data: AppData): Promise<void> {
  await db.transaction('rw', db.settings, db.preferences, db.customers, db.invoices, async () => {
    await Promise.all([
      db.settings.clear(),
      db.preferences.clear(),
      db.customers.clear(),
      db.invoices.clear(),
    ]);
    await Promise.all([
      db.settings.put(data.settings),
      db.preferences.put(data.preferences),
      db.customers.bulkPut(data.customers),
      db.invoices.bulkPut(data.invoices),
    ]);
  });
}
