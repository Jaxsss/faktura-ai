import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  db,
  deleteCustomer,
  issueInvoice,
  loadData,
  saveCustomer,
  saveDraft,
  saveInvoice,
  saveSettings,
} from '../db';
import {
  defaultPreferences,
  defaultSettings,
  emptyParty,
  type Customer,
  type Invoice,
} from '../types';
import { createBackup, parseBackup, restoreBackup } from './backup';
import { invoiceCustomerForEditing } from './customers';
import { validIban, validIco, validateInvoice } from './validation';

const readyInvoice = (): Invoice => {
  const party = { ...emptyParty, name: 'Firma', street: 'Ulice 1', city: 'Praha', zip: '11000' };
  return {
    id: 'inv-1',
    number: '2026-001',
    supplier: { ...defaultSettings, ...party, ico: '27074358' },
    customer: party,
    issueDate: '2026-01-01',
    dueDate: '2026-01-15',
    taxableDate: '2026-01-01',
    deliveryDate: '',
    dueDays: 14,
    currency: 'CZK',
    paymentMethod: 'cash',
    variableSymbol: '2026001',
    paymentReference: '',
    items: [
      {
        id: 'line-1',
        description: 'Služba',
        quantity: '1',
        unit: 'ks',
        unitPrice: '100',
        vatRate: 0,
      },
    ],
    taxMode: 'nonvat',
    pricesIncludeVat: false,
    discount: '0',
    status: 'draft',
    note: '',
    internalNote: '',
    footer: '',
    orderNumber: '',
    paymentInstructions: '',
    exemptionReason: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('invoice persistence and validation', () => {
  it('validates Czech IČO and blocks standard VAT outside CZK', () => {
    expect(validIco('27074358')).toBe(true);
    expect(validIban('CZ6508000000192000145399')).toBe(true);
    expect(validIban('CZ6508000000192000145398')).toBe(false);
    const invoice = { ...readyInvoice(), taxMode: 'standard' as const, currency: 'EUR' as const };
    expect(validateInvoice(invoice).join(' ')).toContain('pouze v CZK');
  });

  it('allows a valid taxable date after issue and blocks unsupported foreign VAT invoices', () => {
    const invoice = readyInvoice();
    const standard = {
      ...invoice,
      taxMode: 'standard' as const,
      supplier: { ...invoice.supplier, vatPayer: true, dic: 'CZ27074358' },
      items: [{ ...invoice.items[0], vatRate: 21 }],
      taxableDate: '2026-01-02',
    };
    expect(validateInvoice(standard)).toEqual([]);
    expect(
      validateInvoice({
        ...standard,
        customer: { ...standard.customer, country: 'Slovensko' },
      }).join(' '),
    ).toContain('pouze pro české');
  });

  it('requires issue details and a valid VAT exemption setup', () => {
    const invoice = readyInvoice();
    expect(validateInvoice({ ...invoice, number: '' }).join(' ')).toContain('číslo faktury');
    expect(
      validateInvoice({
        ...invoice,
        taxMode: 'exempt',
        supplier: { ...invoice.supplier, vatPayer: true },
        taxableDate: '2026-02-31',
      }).join(' '),
    ).toContain('důvod osvobození');
    expect(
      validateInvoice({
        ...invoice,
        taxMode: 'nonvat',
        supplier: { ...invoice.supplier, vatPayer: true },
      }).join(' '),
    ).toContain('režimu neplátce');
    expect(
      validateInvoice({ ...invoice, items: [{ ...invoice.items[0], vatRate: 9 }] }).join(' '),
    ).toContain('0 %, 12 % nebo 21 %');
  });

  it('accepts a valid Czech prefixed account with bank code', () => {
    const invoice = {
      ...readyInvoice(),
      paymentMethod: 'transfer' as const,
      supplier: { ...readyInvoice().supplier, account: '19-2000145399', bankCode: '0800' },
    };
    expect(validateInvoice(invoice)).toEqual([]);
  });

  it('issues atomically, increments the counter, and rejects a repeated issued number', async () => {
    await saveSettings({ ...defaultSettings, numberingYear: 2026, nextNumber: 1 });
    const invoice = readyInvoice();
    const settings = await issueInvoice(invoice);
    expect(settings.nextNumber).toBe(2);
    expect((await loadData()).invoices[0].status).toBe('issued');
    await expect(issueInvoice({ ...invoice, id: 'inv-2' })).rejects.toThrow('již bylo použito');
    expect((await loadData()).settings.nextNumber).toBe(2);
    await expect(issueInvoice(invoice)).rejects.toThrow('již nelze znovu vystavit');
    await expect(saveInvoice({ ...invoice, status: 'issued', number: '' })).rejects.toThrow(
      'číslo faktury',
    );
  });

  it('prevents stale draft autosave from replacing an issued invoice', async () => {
    const invoice = readyInvoice();
    const issued = { ...invoice, status: 'issued' as const };
    await db.invoices.put(issued);
    await expect(saveDraft(invoice)).rejects.toThrow('nelze přepsat konceptem');
    expect((await db.invoices.get(invoice.id))?.status).toBe('issued');
  });

  it('persists intentional counter decreases and returns the stored settings', async () => {
    await saveSettings({ ...defaultSettings, nextNumber: 100 });
    const saved = await saveSettings(
      { ...defaultSettings, nextNumber: 10 },
      { adjustNumbering: true },
    );
    expect(saved.nextNumber).toBe(10);
    expect((await loadData()).settings).toEqual(saved);
    const ordinary = await saveSettings({
      ...defaultSettings,
      nextNumber: 100,
      footer: 'Nový text',
    });
    expect(ordinary.nextNumber).toBe(10);
    expect((await loadData()).settings).toEqual(ordinary);
  });

  it('preserves issuance increments against stale settings autosaves', async () => {
    const stale = { ...defaultSettings, nextNumber: 7 };
    await saveSettings(stale);
    await issueInvoice(readyInvoice());
    const saved = await saveSettings({ ...stale, footer: 'Změna profilu' });
    expect(saved.nextNumber).toBe(8);
    expect(saved.footer).toBe('Změna profilu');
    expect((await loadData()).settings).toEqual(saved);
  });

  it('preserves the new numbering year against stale autosaves after issuance', async () => {
    const stale = {
      ...defaultSettings,
      numberingYear: new Date().getFullYear() - 1,
      nextNumber: 100,
    };
    await saveSettings(stale);
    await issueInvoice(readyInvoice());
    const saved = await saveSettings(stale);
    expect(saved.numberingYear).toBe(new Date().getFullYear());
    expect(saved.nextNumber).toBe(2);
    const adjusted = await saveSettings(stale, { adjustNumbering: true });
    expect(adjusted.numberingYear).toBe(stale.numberingYear);
    expect(adjusted.nextNumber).toBe(100);
  });

  it.each([
    { numberFormat: '' },
    { numberFormat: 'x'.repeat(101) },
    { nextNumber: 0 },
    { nextNumber: 1.5 },
    { nextNumber: 1_000_000_001 },
    { numberingYear: 0 },
    { numberingYear: 2201 },
    { dueDays: 366 },
    { accent: 'invalid' },
  ])('rejects invalid settings input without changing persisted settings: %j', async (input) => {
    await saveSettings(defaultSettings);
    await expect(
      saveSettings({ ...defaultSettings, ...input }, { adjustNumbering: true }),
    ).rejects.toThrow('Nastavení není platné');
    expect((await loadData()).settings).toEqual(defaultSettings);
    expect(parseBackup(await (await createBackup()).text()).settings.numberFormat).toBe(
      defaultSettings.numberFormat,
    );
  });

  it('preserves directory metadata while editing invoice-specific customer details', async () => {
    const invoice = { ...readyInvoice(), customerId: 'customer-1' };
    const directory: Customer = {
      ...invoice.customer,
      id: 'customer-1',
      name: 'Nový název v adresáři',
      street: 'Nová adresa',
      contact: 'Eva Nováková',
      notes: 'Stálý zákazník',
    };
    await saveCustomer(directory);
    const initial = invoiceCustomerForEditing(invoice, (await loadData()).customers)!;
    expect(initial.name).toBe(invoice.customer.name);
    expect(initial.street).toBe(invoice.customer.street);
    await saveCustomer(initial);
    expect(await db.customers.get(directory.id)).toEqual({
      ...initial,
      contact: directory.contact,
      notes: directory.notes,
    });
    await saveCustomer({ ...initial, street: 'Opravená adresa' });
    expect((await db.customers.get(directory.id))?.contact).toBe(directory.contact);
    expect((await db.customers.get(directory.id))?.notes).toBe(directory.notes);
    expect(invoice.customer.street).toBe('Ulice 1');
  });

  it('initializes manual or deleted directory customers without unrelated metadata', () => {
    const invoice = { ...readyInvoice(), customerId: 'deleted' };
    const initial = invoiceCustomerForEditing(invoice, [])!;
    expect(initial.id).toBe('deleted');
    expect(initial.contact).toBe('');
    expect(initial.notes).toBe('');
    const manual = invoiceCustomerForEditing({ ...invoice, customerId: undefined }, [])!;
    expect(manual.id).toBeTruthy();
    expect(invoiceCustomerForEditing({ ...invoice, customer: emptyParty }, [])).toBeUndefined();
  });

  it('does not consume the invoice number when saving a draft', async () => {
    await saveSettings({ ...defaultSettings, numberingYear: 2026, nextNumber: 7 });
    await saveDraft(readyInvoice());
    expect((await loadData()).settings.nextNumber).toBe(7);
  });

  it('keeps invoice party snapshots when customers are edited or deleted', async () => {
    const invoice = readyInvoice();
    const customer: Customer = { ...invoice.customer, id: 'customer-1', contact: '', notes: '' };
    await saveCustomer(customer);
    await db.invoices.put({ ...invoice, customerId: customer.id });
    await saveCustomer({ ...customer, name: 'Nový název' });
    expect((await db.invoices.get(invoice.id))?.customer.name).toBe('Firma');
    await deleteCustomer(customer.id);
    expect((await db.invoices.get(invoice.id))?.customer.name).toBe('Firma');
  });
});

describe('portable backups', () => {
  it('round trips settings, customers, preferences, issued and incomplete draft invoices with logos', async () => {
    const logo = new Blob(['logo'], { type: 'image/png' });
    const settings = { ...defaultSettings, logo, footer: 'Zápatí' };
    const customer: Customer = {
      ...readyInvoice().customer,
      id: 'customer-1',
      contact: 'Eva',
      notes: 'Poznámka',
    };
    const invoice = {
      ...readyInvoice(),
      number: '2026-001',
      status: 'issued' as const,
      supplier: { ...readyInvoice().supplier, logo },
    };
    const draft = {
      ...readyInvoice(),
      id: 'draft-1',
      number: '',
      discount: 'právě upravuji',
      items: [{ ...readyInvoice().items[0], quantity: 'abc', unitPrice: 'částka' }],
    };
    await db.settings.put(settings);
    await db.preferences.put({ ...defaultPreferences });
    await db.customers.put(customer);
    await db.invoices.bulkPut([invoice, draft]);
    const backup = parseBackup(await (await createBackup()).text());
    expect(Object.keys(backup.assets ?? {})).toEqual(['logo-1']);
    expect(backup.settings.logo).toBe('asset:logo-1');
    expect(backup.invoices.find((row) => row.id === invoice.id)?.supplier.logo).toBe(
      'asset:logo-1',
    );
    await restoreBackup(backup);
    const loaded = await loadData();
    expect(loaded.settings.logo?.size).toBe(4);
    expect(loaded.settings.footer).toBe('Zápatí');
    expect(loaded.preferences).toEqual(defaultPreferences);
    expect(loaded.customers).toEqual([customer]);
    expect(loaded.invoices.find((row) => row.id === invoice.id)?.supplier.logo?.type).toBe(
      'image/png',
    );
    expect(loaded.invoices.find((row) => row.id === draft.id)?.items[0].quantity).toBe('abc');
  });

  it.each([
    { numberFormat: '{YYYY}/{NNNN}', nextNumber: 10, numberingYear: 2026 },
    { numberFormat: '{N}', nextNumber: 1, numberingYear: 2000 },
    { numberFormat: 'x'.repeat(100), nextNumber: 1_000_000_000, numberingYear: 2200 },
  ])('round trips valid settings edits: %j', async (input) => {
    const settings = { ...defaultSettings, ...input };
    await saveSettings(settings, { adjustNumbering: true });
    const backup = parseBackup(await (await createBackup()).text());
    await restoreBackup(backup);
    expect((await loadData()).settings).toEqual(settings);
  });

  it('rejects export of invalid legacy settings or invoice snapshots', async () => {
    await db.settings.put({ ...defaultSettings, numberFormat: '' });
    await expect(createBackup()).rejects.toThrow('settings.numberFormat');
    await db.settings.put(defaultSettings);
    const invoice = readyInvoice();
    await db.invoices.put({ ...invoice, supplier: { ...invoice.supplier, numberingYear: 0 } });
    await expect(createBackup()).rejects.toThrow('invoices.0.supplier.numberingYear');
  });

  it('rejects duplicate issued invoice numbers and malformed dates', () => {
    const invoice = readyInvoice();
    const base = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings: { ...defaultSettings },
      preferences: defaultPreferences,
      customers: [],
      invoices: [invoice, { ...invoice, id: 'another' }],
    };
    expect(() => parseBackup(JSON.stringify(base))).not.toThrow();
    const issued = { ...invoice, status: 'issued' as const };
    expect(() =>
      parseBackup(JSON.stringify({ ...base, invoices: [issued, { ...issued, id: 'another' }] })),
    ).toThrow('duplicitní čísla vystavených faktur');
    expect(() =>
      parseBackup(JSON.stringify({ ...base, invoices: [{ ...issued, dueDate: '2026-02-31' }] })),
    ).toThrow('neplatné datum');
    expect(() =>
      parseBackup(JSON.stringify({ ...base, invoices: [{ ...issued, issueDate: '' }] })),
    ).toThrow('Datum vystavení');
  });

  it('round trips an issued VAT invoice whose valid taxable date is after issue', () => {
    const base = readyInvoice();
    const invoice = {
      ...base,
      status: 'issued' as const,
      taxMode: 'standard' as const,
      supplier: { ...base.supplier, vatPayer: true, dic: 'CZ27074358' },
      items: [{ ...base.items[0], vatRate: 21 }],
      taxableDate: '2026-01-02',
    };
    const backup = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings: { ...defaultSettings },
      preferences: defaultPreferences,
      customers: [],
      invoices: [invoice],
    };
    expect(parseBackup(JSON.stringify(backup)).invoices[0].taxableDate).toBe('2026-01-02');
  });

  it('round trips incomplete drafts that share an unconsumed number', () => {
    const draft = {
      ...readyInvoice(),
      number: '',
      discount: '',
      items: [{ ...readyInvoice().items[0], quantity: '', unitPrice: '' }],
    };
    const backup = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings: { ...defaultSettings },
      preferences: defaultPreferences,
      customers: [],
      invoices: [draft, { ...draft, id: 'draft-2' }],
    };
    expect(parseBackup(JSON.stringify(backup)).invoices).toHaveLength(2);
  });

  it('rejects unsupported schema versions and leaves existing data untouched after malformed restore', async () => {
    const customer: Customer = {
      ...readyInvoice().customer,
      id: 'keep-me',
      contact: '',
      notes: '',
    };
    await db.customers.put(customer);
    await db.settings.put({ ...defaultSettings, footer: 'Ponechat' });
    const base = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings: { ...defaultSettings },
      preferences: defaultPreferences,
      customers: [],
      invoices: [],
    };
    expect(() => parseBackup(JSON.stringify({ ...base, schemaVersion: 2 }))).toThrow(
      'Verze zálohy není podporována',
    );
    await expect(
      restoreBackup({ ...base, preferences: { id: 'wrong' } } as never),
    ).rejects.toThrow();
    const loaded = await loadData();
    expect(loaded.customers.map((row) => row.id)).toEqual(['keep-me']);
    expect(loaded.settings.footer).toBe('Ponechat');
  });

  it('accepts legacy inline logos and rejects dangling asset references', () => {
    const inlineLogo = `data:image/png;base64,${btoa('logo')}`;
    const base = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings: { ...defaultSettings, logo: inlineLogo },
      preferences: defaultPreferences,
      customers: [],
      invoices: [],
    };
    expect(parseBackup(JSON.stringify(base)).settings.logo).toBe(inlineLogo);
    expect(() =>
      parseBackup(
        JSON.stringify({ ...base, settings: { ...base.settings, logo: 'asset:logo-1' } }),
      ),
    ).toThrow('chybějící obrázek logo-1');
  });

  it('rejects unsupported VAT rates in issued backup records', () => {
    const invoice = {
      ...readyInvoice(),
      status: 'issued' as const,
      items: [{ ...readyInvoice().items[0], vatRate: 9 }],
    };
    const backup = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings: { ...defaultSettings },
      preferences: defaultPreferences,
      customers: [],
      invoices: [invoice],
    };
    expect(() => parseBackup(JSON.stringify(backup))).toThrow('nepodporovanou sazbu DPH');
  });
});
