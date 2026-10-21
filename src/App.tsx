import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Plus,
  Files,
  Users,
  Settings2,
  ShieldCheck,
  ChevronsUpDown,
  Check,
  X,
  CircleAlert,
  Download,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import type { Customer, Invoice, Settings } from './types';
import { defaultSettings, defaultPreferences, localDate } from './types';
import * as storage from './db';
import type { AppData } from './db';
import { createBackup, parseBackup, restoreBackup, type Backup } from './lib/backup';
import { dateLabel, downloadBlob, newInvoice } from './lib/format';
import { invoiceCustomerForEditing } from './lib/customers';
import { validateInvoice } from './lib/validation';
import { preparePdfRuntime } from './lib/pdf/runtime';
import { InvoiceList } from './components/InvoiceList';
import { InvoiceEditor } from './components/InvoiceEditor';
import { CustomersView } from './components/CustomersView';
import { CustomerForm } from './components/CustomerForm';
import { SettingsView } from './components/SettingsView';
import { Busy, Dialog, Input } from './components/ui';
type View = 'invoices' | 'editor' | 'customers' | 'settings';
type Confirmation = {
  title: string;
  body: string;
  action: string;
  run: () => Promise<void>;
  strong?: boolean;
};
const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : 'Akci se nepodařilo dokončit. Zkuste to znovu.';
export default function App() {
  const [data, setData] = useState<AppData | null>(null),
    [view, setView] = useState<View>('invoices'),
    [settingsTab, setSettingsTab] = useState<'company' | 'data'>('company'),
    [invoice, setInvoice] = useState<Invoice | null>(null),
    [saving, setSaving] = useState('Vše uloženo'),
    [toast, setToast] = useState(''),
    [error, setError] = useState(''),
    [errors, setErrors] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [customerDialog, setCustomerDialog] = useState<{ initial?: Customer; inline?: boolean } | null>(
      null,
    ),
    [confirm, setConfirm] = useState<Confirmation | null>(null),
    [confirmText, setConfirmText] = useState(''),
    [backup, setBackup] = useState<Backup | null>(null);
  const dataRef = useRef(data),
    invoiceRef = useRef(invoice),
    settingsDirty = useRef(false),
    numberingRevision = useRef(0),
    savedNumberingRevision = useRef(0),
    draftDirty = useRef(false),
    issuedDirty = useRef(false),
    settingsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    queue = useRef(Promise.resolve()),
    toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const setApp = (next: AppData) => {
    dataRef.current = next;
    setData(next);
  };
  const setCurrent = (next: Invoice | null) => {
    invoiceRef.current = next;
    setInvoice(next);
  };
  const notify = (message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4500);
  };
  function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = queue.current.catch(() => {}).then(fn);
    queue.current = result.then(
      () => {},
      () => {},
    );
    return result;
  }
  function upsert(i: Invoice) {
    const current = dataRef.current;
    if (current)
      setApp({
        ...current,
        invoices: [i, ...current.invoices.filter((x) => x.id !== i.id)].sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
      });
  }
  async function flushSettings() {
    clearTimeout(settingsTimer.current);
    if (!settingsDirty.current || !dataRef.current) return;
    const source = dataRef.current.settings;
    const s = structuredClone(source);
    const revision = numberingRevision.current;
    setSaving('Ukládám…');
    try {
      const persisted = await enqueue(() =>
        storage.saveSettings(s, {
          adjustNumbering: revision > savedNumberingRevision.current,
        }),
      );
      savedNumberingRevision.current = revision;
      if (dataRef.current?.settings === source) {
        settingsDirty.current = false;
        setApp({ ...dataRef.current, settings: persisted });
      }
      setSaving(settingsDirty.current ? 'Ukládám…' : 'Uloženo');
    } catch (e) {
      setSaving('Neuloženo');
      throw e;
    }
  }
  async function flushDraft() {
    clearTimeout(draftTimer.current);
    const i = invoiceRef.current;
    if (!draftDirty.current || !i || i.status !== 'draft') return;
    const snapshot = structuredClone(i);
    setSaving('Ukládám…');
    try {
      await enqueue(() => storage.saveDraft(snapshot));
      if (invoiceRef.current === i) draftDirty.current = false;
      upsert(snapshot);
      setSaving('Uloženo');
    } catch (e) {
      setSaving('Neuloženo');
      throw e;
    }
  }
  async function flush() {
    await flushSettings();
    await flushDraft();
    await queue.current;
  }
  useEffect(() => {
    Promise.all([storage.loadData(), preparePdfRuntime()])
      .then(([d]) =>
        setApp({
          ...d,
          invoices: d.invoices.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        }),
      )
      .catch((e) =>
        setError(
          `Aplikaci nelze připravit: ${errorMessage(e)}. Povolte místní úložiště a zkontrolujte, že se načetly soubory aplikace. Potom obnovte stránku.`,
        ),
      );
  }, []);
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (settingsDirty.current || draftDirty.current || issuedDirty.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);
  function changeSettings(s: Settings) {
    if (!dataRef.current) return;
    if (
      s.nextNumber !== dataRef.current.settings.nextNumber ||
      s.numberingYear !== dataRef.current.settings.numberingYear
    )
      numberingRevision.current += 1;
    setApp({ ...dataRef.current, settings: s });
    settingsDirty.current = true;
    setSaving('Ukládám…');
    clearTimeout(settingsTimer.current);
    settingsTimer.current = setTimeout(
      () => flushSettings().catch((e) => setError(errorMessage(e))),
      600,
    );
  }
  function changeInvoice(i: Invoice) {
    setCurrent(i);
    setErrors([]);
    if (i.status === 'draft') {
      draftDirty.current = true;
      setSaving('Ukládám…');
      clearTimeout(draftTimer.current);
      draftTimer.current = setTimeout(
        () => flushDraft().catch((e) => setError(errorMessage(e))),
        650,
      );
    } else {
      issuedDirty.current = true;
      setSaving('Neuložené změny');
    }
  }
  function leaveWithChanges(run: () => Promise<void>): boolean {
    if (!issuedDirty.current) return false;
    setConfirm({
      title: 'Zahodit neuložené změny?',
      body: 'Změny vystavené faktury ještě nejsou uložené. Původní doklad zůstane zachován.',
      action: 'Zahodit změny',
      run: async () => {
        issuedDirty.current = false;
        const saved = dataRef.current?.invoices.find((i) => i.id === invoiceRef.current?.id);
        if (saved) setCurrent(structuredClone(saved));
        await run();
      },
    });
    return true;
  }
  async function navigate(next: View, section: 'company' | 'data' = 'company') {
    if (leaveWithChanges(() => navigate(next, section))) return;
    try {
      await flush();
      if (next === 'settings') setSettingsTab(section);
      setView(next);
      setErrors([]);
      window.scrollTo(0, 0);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function createInvoice(customer?: Customer, source?: Invoice) {
    if (leaveWithChanges(() => createInvoice(customer, source))) return;
    try {
      await flush();
      const current = dataRef.current!;
      const i = newInvoice(current.settings);
      if (customer) {
        i.customer = structuredClone(customer);
        i.customerId = customer.id;
      }
      if (source) {
        i.customer = structuredClone(source.customer);
        i.customerId = source.customerId;
        i.items = source.items.map((x) => ({ ...x, id: crypto.randomUUID() }));
        i.taxMode = current.settings.vatPayer
          ? source.taxMode === 'nonvat'
            ? 'standard'
            : source.taxMode
          : 'nonvat';
        i.items = i.items.map((x) => ({ ...x, vatRate: i.taxMode === 'standard' ? x.vatRate : 0 }));
        i.discount = source.discount;
        i.currency = source.currency;
        i.pricesIncludeVat = source.pricesIncludeVat;
        i.note = source.note;
        i.exemptionReason = source.exemptionReason;
      }
      setCurrent(i);
      draftDirty.current = true;
      await flushDraft();
      setErrors([]);
      setView('editor');
      window.scrollTo(0, 0);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function openInvoice(i: Invoice) {
    if (leaveWithChanges(() => openInvoice(i))) return;
    try {
      await flush();
      let next = structuredClone(i);
      if (next.status === 'draft') {
        next.supplier = structuredClone(dataRef.current!.settings);
        if (next.supplier.vatPayer && next.taxMode === 'nonvat') {
          next.taxMode = 'standard';
          next.items = next.items.map((x) => ({ ...x, vatRate: 21 }));
        } else if (!next.supplier.vatPayer) {
          next.taxMode = 'nonvat';
          next.items = next.items.map((x) => ({ ...x, vatRate: 0 }));
        }
      }
      setCurrent(next);
      if (next.status === 'draft') {
        draftDirty.current = true;
        await flushDraft();
      }
      setErrors([]);
      setView('editor');
      window.scrollTo(0, 0);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function download(i: Invoice) {
    if (issuedDirty.current && invoiceRef.current?.id === i.id) {
      setError('Nejdříve uložte změny vystavené faktury. Potom si stáhněte nové PDF.');
      return;
    }
    setBusy(true);
    try {
      await flush();
      const { downloadInvoicePdf } = await import('./lib/pdf');
      await downloadInvoicePdf(i);
      notify('PDF je připravené ke stažení.');
    } catch (e) {
      setError(`PDF se nepodařilo připravit: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  }
  async function issue() {
    const i = invoiceRef.current;
    if (!i) return;
    const finalized = {
      ...i,
      supplier: structuredClone(dataRef.current!.settings),
      updatedAt: new Date().toISOString(),
    };
    const validation = validateInvoice(finalized);
    setErrors(validation);
    if (validation.length) return;
    setBusy(true);
    try {
      await flush();
      const settings = await enqueue(() => storage.issueInvoice(finalized));
      const issued = { ...finalized, status: 'issued' as const };
      draftDirty.current = false;
      setCurrent(issued);
      upsert(issued);
      setApp({ ...dataRef.current!, settings });
      setSaving('Vystaveno a uloženo');
      notify(`Faktura ${issued.number} byla vystavena.`);
      try {
        const { downloadInvoicePdf } = await import('./lib/pdf');
        await downloadInvoicePdf(issued);
      } catch (e) {
        setError(
          `Faktura je uložená, ale PDF se nepodařilo připravit: ${errorMessage(e)}. Zkuste znovu Stáhnout PDF.`,
        );
      }
    } catch (e) {
      setErrors([errorMessage(e)]);
    } finally {
      setBusy(false);
    }
  }
  async function saveEdit() {
    const i = invoiceRef.current;
    if (!i) return false;
    const validation = validateInvoice(i);
    setErrors(validation);
    if (validation.length) return false;
    setBusy(true);
    try {
      await enqueue(() => storage.saveInvoice(i));
      upsert(i);
      issuedDirty.current = false;
      setSaving('Uloženo');
      notify('Změny vystavené faktury byly uloženy.');
      return true;
    } catch (e) {
      setErrors([errorMessage(e)]);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function exportData() {
    try {
      await flush();
      downloadBlob(await createBackup(), `faktury-zaloha-${localDate()}.json`);
      notify('Kompletní záloha je připravená ke stažení.');
    } catch (e) {
      setError(`Zálohu nelze vytvořit: ${errorMessage(e)}`);
    }
  }
  async function importFile(file: File) {
    try {
      if (file.size > 50_000_000) throw new Error('Záloha může mít nejvýše 50 MB.');
      const parsed = parseBackup(await file.text());
      await flush();
      setBackup(parsed);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function restore() {
    if (!backup) return;
    setBusy(true);
    try {
      await flush();
      await enqueue(() => restoreBackup(backup));
      const next = await storage.loadData();
      setApp(next);
      setCurrent(null);
      draftDirty.current = false;
      settingsDirty.current = false;
      setBackup(null);
      setView('invoices');
      setSaving('Uloženo');
      notify('Záloha byla úspěšně obnovena.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function requestClear() {
    setConfirmText('');
    setConfirm({
      title: 'Smazat všechna data?',
      body: 'Odstraníte všechny faktury, odběratele, logo i nastavení. Tento krok nelze vrátit. Nejprve si můžete stáhnout zálohu. Pro potvrzení napište SMAZAT.',
      action: 'Smazat všechna data',
      strong: true,
      run: async () => {
        await flush();
        await enqueue(() =>
          storage.replaceData({
            settings: structuredClone(defaultSettings),
            preferences: { ...defaultPreferences },
            customers: [],
            invoices: [],
          }),
        );
        setApp(await storage.loadData());
        setCurrent(null);
        draftDirty.current = false;
        settingsDirty.current = false;
        setView('invoices');
        notify('Všechna data byla odstraněna.');
      },
    });
  }
  const nav = [
    ['invoices', 'Faktury', Files],
    ['customers', 'Odběratelé', Users],
    ['settings', 'Nastavení', Settings2],
  ] as const;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate('invoices');
          }}
        >
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          faktura<span className="brand-period">.</span>
        </a>
        <div className="workspace-label">VAŠE PODNIKÁNÍ, V KLIDU</div>
        <button className="sidebar-create" onClick={() => createInvoice()} disabled={!data}>
          <Plus size={18} />
          Nová faktura
          <ArrowUpRight size={16} />
        </button>
        <nav className="main-nav" aria-label="Hlavní navigace">
          {nav.map(([v, label, Icon]) => (
            <button
              className={view === v || (v === 'invoices' && view === 'editor') ? 'active' : ''}
              key={v}
              onClick={() => navigate(v)}
            >
              <Icon size={18} />
              {label}
              {v === 'invoices' && !!data?.invoices.length && <span>{data.invoices.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <ShieldCheck size={19} />
            <strong>Vaše data jsou vaše.</strong>
            <p>
              Bez účtu. Bez cloudu.
              <br />
              Jen v tomto prohlížeči.
            </p>
            <button onClick={() => navigate('settings', 'data')}>
              Nezapomeňte na zálohu
              <ArrowUpRight size={13} />
            </button>
          </div>
          <button className="company-switch" onClick={() => navigate('settings')}>
            <span className="company-avatar">
              {data?.settings.name
                ? data.settings.name
                    .split(' ')
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()
                : 'V'}
            </span>
            <span>
              <strong>
                {data?.settings.tradingName || data?.settings.name || 'Vaše společnost'}
              </strong>
              <small>{data?.settings.vatPayer ? 'Plátce DPH' : 'Neplátce DPH'}</small>
            </span>
            <ChevronsUpDown size={14} />
          </button>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="breadcrumb">
            Pracovní prostor<span>/</span>
            <strong>
              {view === 'editor'
                ? invoice?.status === 'draft'
                  ? 'Nová faktura'
                  : 'Detail faktury'
                : view === 'customers'
                  ? 'Odběratelé'
                  : view === 'settings'
                    ? 'Nastavení'
                    : 'Faktury'}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="local-pill">
              <span />
              Lokálně a soukromě
            </span>
            <span className="topbar-date">
              {new Intl.DateTimeFormat('cs-CZ', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(new Date())}
            </span>
          </div>
        </header>
        <main className={`main-content ${view === 'editor' ? 'editor-main' : ''}`}>
          {error && (
            <div role="alert" className="global-error">
              <CircleAlert size={19} />
              <span>{error}</span>
              <button
                aria-label="Zavřít zprávu"
                className="icon-button"
                onClick={() => setError('')}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {!data ? (
            <div className="loading-screen">
              {error ? (
                <button className="button secondary" onClick={() => window.location.reload()}>
                  Zkusit znovu
                </button>
              ) : (
                <Busy label="Připravuji váš pracovní prostor…" />
              )}
            </div>
          ) : (
            <>
              {view === 'invoices' && (
                <InvoiceList
                  settings={data.settings}
                  invoices={data.invoices}
                  onNew={() => createInvoice()}
                  onOpen={openInvoice}
                  onDuplicate={(i) => createInvoice(undefined, i)}
                  onDownload={download}
                  onSettings={(tab) => navigate('settings', tab)}
                  onPaid={async (i) => {
                    try {
                      const next = {
                        ...i,
                        status: (i.status === 'paid' ? 'issued' : 'paid') as Invoice['status'],
                        paidDate: i.status === 'paid' ? undefined : localDate(),
                        updatedAt: new Date().toISOString(),
                      };
                      await storage.saveInvoice(next);
                      upsert(next);
                      notify(
                        next.status === 'paid'
                          ? 'Faktura označena jako uhrazená.'
                          : 'Faktura označena jako neuhrazená.',
                      );
                    } catch (e) {
                      setError(errorMessage(e));
                    }
                  }}
                  onDelete={(i) =>
                    setConfirm({
                      title: 'Smazat fakturu?',
                      body: `Faktura ${i.number} pro ${i.customer.name || 'nevybraného odběratele'} bude trvale odstraněna. Pokud jde o vystavený doklad, uchovejte vlastní kopii.`,
                      action: 'Smazat fakturu',
                      run: async () => {
                        await storage.deleteInvoice(i.id);
                        setApp({
                          ...dataRef.current!,
                          invoices: dataRef.current!.invoices.filter((x) => x.id !== i.id),
                        });
                        if (invoiceRef.current?.id === i.id) {
                          setCurrent(null);
                          draftDirty.current = false;
                        }
                        notify('Faktura byla smazána.');
                      },
                    })
                  }
                />
              )}
              {view === 'customers' && (
                <CustomersView
                  customers={data.customers}
                  onAdd={() => setCustomerDialog({})}
                  onEdit={(c) => setCustomerDialog({ initial: c })}
                  onInvoice={(c) => createInvoice(c)}
                  onDelete={(c) =>
                    setConfirm({
                      title: 'Smazat odběratele?',
                      body: `${c.name} bude odebrán z adresáře. Údaje na již uložených fakturách zůstanou zachovány.`,
                      action: 'Smazat odběratele',
                      run: async () => {
                        await storage.deleteCustomer(c.id);
                        setApp({
                          ...dataRef.current!,
                          customers: dataRef.current!.customers.filter((x) => x.id !== c.id),
                        });
                        notify('Odběratel byl smazán.');
                      },
                    })
                  }
                />
              )}
              {view === 'settings' && (
                <SettingsView
                  key={settingsTab}
                  initialTab={settingsTab}
                  settings={data.settings}
                  onChange={changeSettings}
                  onExport={exportData}
                  onImport={importFile}
                  onClear={requestClear}
                  onDone={() => navigate('invoices')}
                  saving={saving}
                />
              )}
              {view === 'editor' && invoice && (
                <InvoiceEditor
                  key={invoice.id}
                  invoice={invoice}
                  settings={data.settings}
                  customers={data.customers}
                  onChange={changeInvoice}
                  onBack={() => navigate('invoices')}
                  onCustomer={() =>
                    setCustomerDialog({
                      inline: true,
                      initial: invoiceCustomerForEditing(invoice, data.customers),
                    })
                  }
                  onIssue={issue}
                  onSaveEdit={saveEdit}
                  onDownload={() => download(invoiceRef.current!)}
                  onEdit={() => setSaving('Úprava vystavené faktury')}
                  onSaveDraft={async () => {
                    try {
                      await flush();
                      notify('Koncept je uložený. Můžete se k němu kdykoliv vrátit.');
                    } catch (e) {
                      setError(errorMessage(e));
                    }
                  }}
                  saving={saving}
                  errors={errors}
                  busy={busy}
                />
              )}
            </>
          )}
          <footer className="app-footer">
            <span>
              faktura<span>.</span>
              <small>Víc prostoru pro vaše podnikání.</small>
            </span>
            <span>Vyrobeno pro klidnější fakturaci.</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={16} />
          </span>
          {toast}
          <button aria-label="Zavřít oznámení" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {customerDialog && (
        <Dialog
          title={customerDialog.initial ? 'Upravit odběratele' : 'Nový odběratel'}
          subtitle="Údaje budou připravené pro vaše další faktury."
          onClose={() => setCustomerDialog(null)}
        >
          <CustomerForm
            initial={customerDialog.initial}
            allowManual={customerDialog.inline}
            onCancel={() => setCustomerDialog(null)}
            onSave={async (c, save) => {
              if (save) {
                await storage.saveCustomer(c);
                setApp({
                  ...dataRef.current!,
                  customers: [c, ...dataRef.current!.customers.filter((x) => x.id !== c.id)],
                });
              }
              if (customerDialog.inline && invoiceRef.current)
                changeInvoice({
                  ...invoiceRef.current,
                  customer: structuredClone(c),
                  customerId: save ? c.id : undefined,
                });
              setCustomerDialog(null);
              notify(customerDialog.inline ? 'Odběratel přidán na fakturu.' : 'Odběratel uložen.');
            }}
          />
        </Dialog>
      )}
      {confirm && (
        <Dialog title={confirm.title} onClose={() => !busy && setConfirm(null)}>
          <p className="confirmation-text">{confirm.body}</p>
          {confirm.strong && (
            <>
              <button className="button secondary" onClick={exportData}>
                <Download size={16} />
                Nejdříve stáhnout zálohu
              </button>
              <label className="field confirmation-input">
                <span className="field-label">Napište SMAZAT</span>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                />
              </label>
            </>
          )}
          <div className="dialog-actions">
            <button className="button secondary" disabled={busy} onClick={() => setConfirm(null)}>
              Zrušit
            </button>
            <button
              className="button destructive-button"
              disabled={busy || (confirm.strong && confirmText !== 'SMAZAT')}
              onClick={async () => {
                setBusy(true);
                try {
                  await confirm.run();
                  setConfirm(null);
                } catch (e) {
                  setError(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <Busy /> : confirm.action}
            </button>
          </div>
        </Dialog>
      )}
      {backup && (
        <Dialog
          title="Obnovit data ze zálohy?"
          subtitle={`Záloha ze dne ${dateLabel(backup.exportedAt.slice(0, 10))}`}
          onClose={() => !busy && setBackup(null)}
        >
          <div className="import-summary">
            <div>
              <strong>{backup.invoices.length}</strong>
              <span>faktur a konceptů</span>
            </div>
            <div>
              <strong>{backup.customers.length}</strong>
              <span>odběratelů</span>
            </div>
            <div>
              <strong>
                <Check size={23} />
              </strong>
              <span>nastavení {backup.settings.logo ? 'a logo' : ''}</span>
            </div>
          </div>
          <p className="confirmation-text">
            Obnovíte profil <strong>{backup.settings.name || 'bez názvu'}</strong>. Import nahradí
            všechna aktuální data. Tento krok nelze vrátit.
          </p>
          <button className="text-button" onClick={exportData}>
            <Download size={16} />
            Nejdříve stáhnout aktuální zálohu
          </button>
          <div className="dialog-actions">
            <button className="button secondary" disabled={busy} onClick={() => setBackup(null)}>
              <ArrowLeft size={15} />
              Zrušit
            </button>
            <button className="button primary" disabled={busy} onClick={restore}>
              {busy ? (
                <Busy label="Obnovuji…" />
              ) : (
                <>
                  Nahradit a obnovit data
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
