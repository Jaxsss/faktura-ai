import { useState } from 'react';
import {
  ArrowLeft,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  ChevronDown,
  ChevronRight,
  Eye,
  Download,
  Check,
  ArrowUpRight,
  Save,
  UserRoundPlus,
  Building2,
  LockKeyhole,
  FileCheck2,
  X,
  Search,
} from 'lucide-react';
import type { Customer, Invoice, InvoiceItem, InvoiceTotals, Settings } from '../types';
import { addDays, paymentLabels } from '../types';
import { money, invoiceStatus, statusLabels } from '../lib/format';
import { calculateInvoice } from '../lib/calculations';
import { Field, Input, Select, Textarea, Dialog, Busy } from './ui';
import { InvoicePreview } from './InvoicePreview';
export function InvoiceEditor({
  invoice,
  settings,
  customers,
  onChange,
  onCustomer,
  onBack,
  onIssue,
  onSaveEdit,
  onDownload,
  onEdit,
  onSaveDraft,
  saving,
  errors,
  busy,
}: {
  invoice: Invoice;
  settings: Settings;
  customers: Customer[];
  onChange: (i: Invoice) => void;
  onCustomer: () => void;
  onBack: () => void;
  onIssue: () => void;
  onSaveEdit: () => Promise<boolean>;
  onDownload: () => void;
  onEdit: () => void;
  onSaveDraft: () => void;
  saving: string;
  errors: string[];
  busy: boolean;
}) {
  const [customerOpen, setCustomerOpen] = useState(false),
    [search, setSearch] = useState(''),
    [advanced, setAdvanced] = useState(false),
    [expanded, setExpanded] = useState(false),
    [editing, setEditing] = useState(false);
  const readOnly = invoice.status !== 'draft' && !editing;
  let totals: InvoiceTotals | undefined;
  let calculationError = '';
  try {
    totals = calculateInvoice(invoice);
  } catch (e) {
    calculationError = e instanceof Error ? e.message : 'Zkontrolujte množství a ceny položek.';
  }
  const update = <K extends keyof Invoice>(key: K, v: Invoice[K]) =>
    onChange({ ...invoice, [key]: v, updatedAt: new Date().toISOString() });
  const setItem = (id: string, key: keyof InvoiceItem, v: string | number) =>
    update(
      'items',
      invoice.items.map((x) => (x.id === id ? { ...x, [key]: v } : x)),
    );
  const choose = (c: Customer) => {
    onChange({
      ...invoice,
      customer: structuredClone(c),
      customerId: c.id,
      updatedAt: new Date().toISOString(),
    });
    setCustomerOpen(false);
  };
  const changeTax = (mode: Invoice['taxMode']) =>
    onChange({
      ...invoice,
      taxMode: mode,
      items: invoice.items.map((x) => ({ ...x, vatRate: mode === 'standard' ? 21 : 0 })),
      updatedAt: new Date().toISOString(),
    });
  const move = (index: number, direction: number) => {
    const items = [...invoice.items];
    [items[index], items[index + direction]] = [items[index + direction], items[index]];
    update('items', items);
  };
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={15} />
        Zpět na faktury
      </button>
      <div className="page-heading editor-heading">
        <div>
          <div className="heading-with-badge">
            <h1>
              {invoice.status === 'draft' ? 'Nová faktura' : `Faktura ${invoice.number}`}
              <span className="heading-dot">.</span>
            </h1>
            <span className={`status ${invoiceStatus(invoice)}`}>
              <span />
              {statusLabels[invoiceStatus(invoice)]}
            </span>
          </div>
          <p>
            {invoice.status === 'draft'
              ? 'Od hotové faktury vás dělí jen pár údajů.'
              : 'Všechno důležité na jednom místě.'}
          </p>
        </div>
        <span className="save-state">
          <Check size={14} />
          {saving}
        </span>
      </div>
      {readOnly && (
        <div className="issued-banner">
          <FileCheck2 size={21} />
          <div>
            <strong>
              {invoice.status === 'paid'
                ? 'Tato faktura je uhrazená.'
                : 'Tato faktura byla vystavena.'}
            </strong>
            <p>Doklad uchovává údaje platné v okamžiku vystavení.</p>
          </div>
          <button
            className="button secondary"
            onClick={() => {
              onEdit();
              setEditing(true);
            }}
          >
            Upravit vystavenou fakturu
          </button>
        </div>
      )}
      {editing && (
        <div className="warning-box">
          Upravujete vystavený doklad. Změna daňového dokladu může vyžadovat vystavení opravného
          dokladu. Původní stažené PDF zůstává beze změny.
        </div>
      )}
      <div className="editor-workspace">
        <div className="editor-form">
          <fieldset disabled={readOnly || busy} className="editor-fieldset">
            <section className="form-section">
              <div className="numbered-heading">
                <span>01</span>
                <div>
                  <h2>Komu fakturujete?</h2>
                  <p>Vyberte z adresáře nebo přidejte nového odběratele.</p>
                </div>
              </div>
              <div className="customer-picker">
                <button
                  className={`customer-select ${invoice.customer.name ? 'selected' : ''}`}
                  onClick={() => setCustomerOpen(!customerOpen)}
                  aria-expanded={customerOpen}
                >
                  <span className="customer-picker-icon">
                    <Building2 size={21} />
                  </span>
                  <span>
                    <strong>{invoice.customer.name || 'Vybrat odběratele'}</strong>
                    <small>
                      {invoice.customer.name
                        ? `${invoice.customer.street}, ${invoice.customer.city}`
                        : 'Jméno, firma nebo IČO'}
                    </small>
                  </span>
                  <ChevronDown size={17} />
                </button>
                {customerOpen && (
                  <div className="customer-dropdown">
                    <div className="search-input">
                      <Search size={16} />
                      <input
                        placeholder="Hledat v adresáři…"
                        aria-label="Hledat v adresáři"
                        autoFocus
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <div className="customer-options">
                      {customers
                        .filter((c) =>
                          `${c.name} ${c.ico}`.toLowerCase().includes(search.toLowerCase()),
                        )
                        .map((c) => (
                          <button key={c.id} onClick={() => choose(c)}>
                            <Building2 size={17} />
                            <span>
                              <strong>{c.name}</strong>
                              <small>{c.ico ? `IČO ${c.ico}` : c.city}</small>
                            </span>
                          </button>
                        ))}
                      {!customers.length && <p>Váš adresář je zatím prázdný.</p>}
                    </div>
                    <button
                      className="add-customer-option"
                      onClick={() => {
                        setCustomerOpen(false);
                        onCustomer();
                      }}
                    >
                      <UserRoundPlus size={17} />
                      Nový odběratel
                    </button>
                  </div>
                )}
              </div>
              <button className="text-button add-inline-customer" onClick={onCustomer}>
                <Plus size={14} />
                {invoice.customer.name ? 'Upravit údaje odběratele' : 'Přidat nového odběratele'}
              </button>
            </section>
            <section className="form-section">
              <div className="numbered-heading">
                <span>02</span>
                <div>
                  <h2>Základní údaje</h2>
                  <p>Číslo, termíny a způsob platby.</p>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Číslo faktury">
                  <Input
                    value={invoice.number}
                    onChange={(e) => {
                      const number = e.target.value;
                      const digits = number.replace(/\D/g, '');
                      const oldDigits = invoice.number.replace(/\D/g, '');
                      onChange({
                        ...invoice,
                        number,
                        variableSymbol:
                          invoice.variableSymbol === oldDigits && /^\d{1,10}$/.test(digits)
                            ? digits
                            : invoice.variableSymbol,
                        updatedAt: new Date().toISOString(),
                      });
                    }}
                    placeholder="2026-001"
                  />
                </Field>
                <Field label="Způsob úhrady">
                  <Select
                    value={invoice.paymentMethod}
                    onChange={(e) =>
                      update('paymentMethod', e.target.value as Invoice['paymentMethod'])
                    }
                  >
                    {Object.entries(paymentLabels).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Datum vystavení">
                  <Input
                    type="date"
                    value={invoice.issueDate}
                    onChange={(e) =>
                      onChange({
                        ...invoice,
                        issueDate: e.target.value,
                        dueDate:
                          invoice.dueDays !== null && e.target.value
                            ? addDays(e.target.value, invoice.dueDays)
                            : invoice.dueDate,
                        updatedAt: new Date().toISOString(),
                      })
                    }
                  />
                </Field>
                <Field label="Datum splatnosti">
                  <Input
                    type="date"
                    value={invoice.dueDate}
                    onChange={(e) =>
                      onChange({
                        ...invoice,
                        dueDate: e.target.value,
                        dueDays: null,
                        updatedAt: new Date().toISOString(),
                      })
                    }
                  />
                  <div className="due-presets">
                    {[7, 14, 30].map((d) => (
                      <button
                        className={invoice.dueDays === d ? 'active' : ''}
                        key={d}
                        onClick={() =>
                          onChange({
                            ...invoice,
                            dueDays: d,
                            dueDate: addDays(invoice.issueDate, d),
                            updatedAt: new Date().toISOString(),
                          })
                        }
                      >
                        {d} dní
                      </button>
                    ))}
                    {invoice.dueDays === null && <span>Vlastní datum</span>}
                  </div>
                </Field>
                {invoice.taxMode !== 'nonvat' && (
                  <Field label="Datum uskutečnění zdanitelného plnění">
                    <Input
                      type="date"
                      value={invoice.taxableDate}
                      onChange={(e) => update('taxableDate', e.target.value)}
                    />
                  </Field>
                )}
                <Field label="Měna">
                  <Select
                    value={invoice.currency}
                    onChange={(e) => update('currency', e.target.value as Invoice['currency'])}
                  >
                    <option value="CZK">CZK — česká koruna</option>
                    <option value="EUR">EUR — euro</option>
                    <option value="USD">USD — americký dolar</option>
                  </Select>
                </Field>
                <Field label="Variabilní symbol">
                  <Input
                    value={invoice.variableSymbol}
                    inputMode="numeric"
                    placeholder="Pouze číslice, nejvýše 10"
                    onChange={(e) => update('variableSymbol', e.target.value)}
                  />
                </Field>
              </div>
            </section>
            <section className="form-section items-section">
              <div className="numbered-heading">
                <span>03</span>
                <div>
                  <h2>Za co fakturujete?</h2>
                  <p>Přidejte své služby nebo produkty.</p>
                </div>
              </div>
              <div className="tax-controls">
                <Field label="Daňový režim">
                  <Select
                    value={invoice.taxMode}
                    onChange={(e) => changeTax(e.target.value as Invoice['taxMode'])}
                  >
                    {!invoice.supplier.vatPayer ? (
                      <option value="nonvat">Neplátce DPH</option>
                    ) : (
                      <>
                        <option value="standard">Běžné DPH</option>
                        <option value="reverse">Přenesená daňová povinnost</option>
                        <option value="exempt">Osvobozeno od DPH</option>
                      </>
                    )}
                  </Select>
                </Field>
                {invoice.taxMode === 'standard' && (
                  <Field label="Jednotkové ceny">
                    <Select
                      value={invoice.pricesIncludeVat ? 'inclusive' : 'exclusive'}
                      onChange={(e) => update('pricesIncludeVat', e.target.value === 'inclusive')}
                    >
                      <option value="exclusive">Bez DPH</option>
                      <option value="inclusive">Včetně DPH</option>
                    </Select>
                  </Field>
                )}
              </div>
              {invoice.taxMode === 'reverse' && (
                <div className="info-box">
                  Tuzemský režim přenesení daňové povinnosti zvolte jen pro odpovídající plnění mezi
                  plátci DPH. Daň odvede zákazník. Použití režimu ověřte se svou účetní.
                </div>
              )}
              {invoice.taxMode === 'exempt' && (
                <Field label="Důvod osvobození / odkaz na ustanovení zákona">
                  <Input
                    value={invoice.exemptionReason}
                    onChange={(e) => update('exemptionReason', e.target.value)}
                    placeholder="Uveďte konkrétní důvod osvobození"
                  />
                </Field>
              )}
              <div className="invoice-items">
                {invoice.items.map((item, index) => (
                  <div className="item-editor" key={item.id}>
                    <div className="item-editor-heading">
                      <span>POLOŽKA {String(index + 1).padStart(2, '0')}</span>
                      <div className="item-tools">
                        <button
                          className="icon-button"
                          aria-label={`Posunout položku ${index + 1} nahoru`}
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Posunout položku ${index + 1} dolů`}
                          disabled={index === invoice.items.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          className="icon-button danger"
                          disabled={invoice.items.length === 1}
                          aria-label={`Odebrat položku ${index + 1}`}
                          onClick={() =>
                            update(
                              'items',
                              invoice.items.filter((x) => x.id !== item.id),
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <Field label="Popis služby nebo produktu">
                      <Textarea
                        value={item.description}
                        placeholder="Např. Grafický návrh webových stránek"
                        rows={2}
                        onChange={(e) => setItem(item.id, 'description', e.target.value)}
                      />
                    </Field>
                    <div
                      className={`item-fields ${invoice.taxMode === 'standard' ? 'with-vat' : ''}`}
                    >
                      <Field label="Množství">
                        <Input
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(e) => setItem(item.id, 'quantity', e.target.value)}
                        />
                      </Field>
                      <Field label="Jednotka">
                        <Input
                          value={item.unit}
                          list="units"
                          onChange={(e) => setItem(item.id, 'unit', e.target.value)}
                        />
                      </Field>
                      <Field label="Cena za MJ">
                        <Input
                          inputMode="decimal"
                          value={item.unitPrice}
                          placeholder="0,00"
                          onChange={(e) => setItem(item.id, 'unitPrice', e.target.value)}
                        />
                      </Field>
                      {invoice.taxMode === 'standard' && (
                        <Field label="DPH">
                          <Select
                            value={item.vatRate}
                            onChange={(e) => setItem(item.id, 'vatRate', Number(e.target.value))}
                          >
                            {[21, 12, 0].map((n) => (
                              <option key={n} value={n}>
                                {n} %
                              </option>
                            ))}
                          </Select>
                        </Field>
                      )}
                      <div className="line-total">
                        <span>Celkem</span>
                        <strong>
                          {totals ? money(totals.lines[index].gross, invoice.currency) : '—'}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <datalist id="units">
                {['ks', 'hod', 'den', 'm', 'm²', 'm³', 'kg', 'služba'].map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
              <button
                className="add-item"
                onClick={() =>
                  update('items', [
                    ...invoice.items,
                    {
                      id: crypto.randomUUID(),
                      description: '',
                      quantity: '1',
                      unit: 'ks',
                      unitPrice: '',
                      vatRate: invoice.taxMode === 'standard' ? 21 : 0,
                    },
                  ])
                }
              >
                <Plus size={17} />
                Přidat položku<span>Další služba nebo produkt</span>
              </button>
              <div className="totals-editor">
                <Field label="Sleva na fakturu (%)">
                  <Input
                    inputMode="decimal"
                    value={invoice.discount}
                    onChange={(e) => update('discount', e.target.value)}
                  />
                </Field>
                <div className="totals-lines">
                  {totals && (
                    <>
                      {Number(totals.discount) > 0 && (
                        <div>
                          <span>Sleva</span>
                          <span>− {money(totals.discount, invoice.currency)}</span>
                        </div>
                      )}
                      {invoice.taxMode === 'standard' && (
                        <>
                          <div>
                            <span>Základ daně</span>
                            <span>{money(totals.net, invoice.currency)}</span>
                          </div>
                          {totals.vatGroups.map((g) => (
                            <div key={g.rate}>
                              <span>DPH {g.rate} %</span>
                              <span>{money(g.vat, invoice.currency)}</span>
                            </div>
                          ))}
                        </>
                      )}
                      <div className="total-payable">
                        <span>Celkem k úhradě</span>
                        <strong>{money(totals.total, invoice.currency)}</strong>
                      </div>
                    </>
                  )}
                  {calculationError && (
                    <p className="field-error" role="alert">
                      Zkontrolujte číselné hodnoty: {calculationError}
                    </p>
                  )}
                </div>
              </div>
            </section>
          </fieldset>
          <section className="form-section advanced-section">
            <button
              className="expand-toggle"
              onClick={() => setAdvanced(!advanced)}
              aria-expanded={advanced}
            >
              <span>
                {advanced ? <ChevronDown size={17} /> : <ChevronRight size={17} />}Další možnosti
              </span>
              <small>Poznámka, reference a další údaje</small>
            </button>
            {advanced && (
              <fieldset
                disabled={readOnly || busy}
                className="editor-fieldset advanced-fields form-grid"
              >
                <Field label="Číslo objednávky">
                  <Input
                    value={invoice.orderNumber}
                    onChange={(e) => update('orderNumber', e.target.value)}
                  />
                </Field>
                <Field label="Datum dodání">
                  <Input
                    type="date"
                    value={invoice.deliveryDate}
                    onChange={(e) => update('deliveryDate', e.target.value)}
                  />
                </Field>
                <Field label="Platební reference">
                  <Input
                    value={invoice.paymentReference}
                    onChange={(e) => update('paymentReference', e.target.value)}
                  />
                </Field>
                <Field label="Dodatečné platební pokyny">
                  <Input
                    value={invoice.paymentInstructions}
                    onChange={(e) => update('paymentInstructions', e.target.value)}
                  />
                </Field>
                <Field label="Poznámka na faktuře" className="full">
                  <Textarea
                    value={invoice.note}
                    onChange={(e) => update('note', e.target.value)}
                    rows={2}
                  />
                </Field>
                <Field label="Patička faktury" className="full">
                  <Textarea
                    value={invoice.footer}
                    onChange={(e) => update('footer', e.target.value)}
                    rows={2}
                  />
                </Field>
                <Field
                  label="Interní poznámka"
                  hint="Vidíte ji jen vy. Na PDF se neobjeví."
                  className="full"
                >
                  <Textarea
                    value={invoice.internalNote}
                    onChange={(e) => update('internalNote', e.target.value)}
                    rows={2}
                  />
                </Field>
              </fieldset>
            )}
          </section>
          {!!errors.length && (
            <div className="error-box" role="alert">
              <strong>Ještě pár drobností před dokončením:</strong>
              <ul>
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
              {!settings.name && <span>Údaje dodavatele doplňte v Nastavení.</span>}
            </div>
          )}
          <div className="editor-actions">
            <div className="local-editor-note">
              <LockKeyhole size={14} />
              Pouze ve vašem prohlížeči
            </div>
            <div>
              {invoice.status === 'draft' ? (
                <>
                  <button className="button secondary" onClick={onSaveDraft} disabled={busy}>
                    <Save size={16} />
                    Uložit koncept
                  </button>
                  <button className="button primary" disabled={busy} onClick={onIssue}>
                    {busy ? (
                      <Busy label="Vystavuji…" />
                    ) : (
                      <>
                        <Check size={17} />
                        Vystavit fakturu
                        <ArrowUpRight size={16} />
                      </>
                    )}
                  </button>
                </>
              ) : editing ? (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={async () => {
                    if (await onSaveEdit()) setEditing(false);
                  }}
                >
                  <Save size={17} />
                  Uložit změny
                </button>
              ) : (
                <button className="button primary" disabled={busy} onClick={onDownload}>
                  <Download size={17} />
                  Stáhnout PDF
                </button>
              )}
            </div>
          </div>
        </div>
        <aside className="preview-column">
          <div className="preview-heading">
            <span>
              <span className="live-dot" />
              Živý náhled
            </span>
            <button className="text-button" onClick={() => setExpanded(true)}>
              <Eye size={15} />
              Zvětšit
              <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="preview-frame">
            {calculationError ? (
              <div className="preview-unavailable">Pro náhled zadejte platné množství a ceny.</div>
            ) : (
              <InvoicePreview invoice={invoice} />
            )}
          </div>
          <div className="preview-caption">
            <span>A4 · Minimal</span>
            <span>Takto bude vypadat vaše PDF</span>
          </div>
          <div className="preview-reassurance">
            <FileCheck2 size={18} />
            <p>
              Vypadá dobře. A sedí i čísla.
              <span>Náhled a stažená faktura používají stejný dokument.</span>
            </p>
          </div>
          {invoice.status === 'draft' && (
            <p className="preview-tip">
              Koncept se ukládá automaticky. Číslo faktury se potvrdí až jejím vystavením.
            </p>
          )}
        </aside>
      </div>
      {expanded && (
        <Dialog
          title={`Náhled faktury ${invoice.number}`}
          subtitle="Stejný dokument, který si stáhnete jako PDF."
          onClose={() => setExpanded(false)}
          wide
        >
          <div className="expanded-preview">
            {!calculationError && <InvoicePreview invoice={invoice} expanded />}
          </div>
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setExpanded(false)}>
              <X size={16} />
              Zavřít náhled
            </button>
            <button className="button primary" onClick={onDownload} disabled={busy}>
              <Download size={16} />
              Stáhnout PDF
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
