import { useRef, useState, useEffect } from 'react';
import {
  Building2,
  Landmark,
  SlidersHorizontal,
  Database,
  Upload,
  Download,
  ImagePlus,
  Trash2,
  ShieldCheck,
  Check,
  ArrowRight,
} from 'lucide-react';
import type { Settings } from '../types';
import { settingsErrors } from '../lib/settings';
import { paymentLabels } from '../types';
import { Field, Input, Select, Textarea, Busy } from './ui';
type Tab = 'company' | 'bank' | 'defaults' | 'data';
export function SettingsView({
  settings: savedSettings,
  onChange,
  onExport,
  onImport,
  onClear,
  onDone,
  saving,
  initialTab = 'company',
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onExport: () => void;
  onImport: (f: File) => void;
  onClear: () => void;
  onDone: () => void;
  saving: string;
  initialTab?: Tab;
}) {
  const [settings, setSettings] = useState(savedSettings);
  const previousSettings = useRef(savedSettings);
  useEffect(() => {
    const previous = previousSettings.current;
    previousSettings.current = savedSettings;
    setSettings((draft) => {
      const changes = Object.fromEntries(
        (Object.keys(savedSettings) as (keyof Settings)[])
          .filter((key) => savedSettings[key] !== previous[key])
          .map((key) => [key, savedSettings[key]]),
      );
      return { ...draft, ...changes };
    });
  }, [savedSettings]);
  const validationErrors = settingsErrors(settings);
  const [tab, setTab] = useState<Tab>(initialTab),
    [logoUrl, setLogoUrl] = useState(''),
    [error, setError] = useState(''),
    [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null),
    importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!settings.logo) {
      setLogoUrl('');
      return;
    }
    const url = URL.createObjectURL(settings.logo);
    setLogoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [settings.logo]);
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    if (!settingsErrors(next).length) onChange(next);
  };
  const text = (key: keyof Settings, label: string, props = {}) => (
    <Field label={label}>
      <Input
        value={String(settings[key] ?? '')}
        onChange={(e) => update(key, e.target.value as never)}
        {...props}
      />
    </Field>
  );
  async function upload(file?: File) {
    if (!file) return;
    setError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Vyberte logo ve formátu PNG, JPG nebo WebP.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('Logo může mít nejvýše 20 MB.');
      return;
    }
    setUploading(true);
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Logo se nepodařilo zpracovat.'))),
          'image/png',
        ),
      );
      update('logo', blob);
    } catch {
      setError('Obrázek nelze načíst. Zkuste jiný soubor.');
    } finally {
      setUploading(false);
    }
  }
  const tabs: [Tab, string, typeof Building2][] = [
    ['company', 'Profil společnosti', Building2],
    ['bank', 'Platební údaje', Landmark],
    ['defaults', 'Výchozí hodnoty', SlidersHorizontal],
    ['data', 'Data a zálohy', Database],
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">JEDNOU NASTAVÍTE. DÁL UŽ JEN FAKTURUJETE.</div>
          <h1>
            Nastavení<span className="heading-dot">.</span>
          </h1>
          <p>Vaše podnikání, vaše pravidla. Všechno přehledně na jednom místě.</p>
        </div>
        <span className="save-state">
          <Check size={14} />
          {validationErrors.length ? 'Neuloženo – doplňte platné hodnoty' : saving}
        </span>
      </div>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Sekce nastavení">
          {tabs.map(([v, label, Icon]) => (
            <button className={tab === v ? 'active' : ''} key={v} onClick={() => setTab(v)}>
              <Icon size={18} />
              {label}
            </button>
          ))}
          <div className="local-note">
            <ShieldCheck size={21} />
            <strong>Jen u vás.</strong>
            <p>Údaje zůstávají v tomto prohlížeči. Žádný účet, žádný cloud.</p>
          </div>
        </nav>
        <section className="settings-content">
          {!!validationErrors.length && (
            <div className="error-box" role="alert">
              Změny nastavení nejsou uložené. Opravte: {validationErrors.join('; ')}
            </div>
          )}
          {tab === 'company' && (
            <>
              <div className="section-heading">
                <h2>Profil společnosti</h2>
                <p>Tyto údaje se automaticky objeví na vašich fakturách.</p>
              </div>
              <div className="logo-upload">
                <div className="logo-box">
                  {logoUrl ? <img src={logoUrl} alt="Logo společnosti" /> : <ImagePlus size={26} />}
                </div>
                <div>
                  <h4>Vaše logo</h4>
                  <p>PNG, JPG nebo WebP. Velké obrázky zmenšíme.</p>
                  <div className="inline-actions">
                    <button
                      className="button small secondary"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                    >
                      {uploading ? (
                        <Busy />
                      ) : (
                        <>
                          <Upload size={14} />
                          Nahrát logo
                        </>
                      )}
                    </button>
                    {settings.logo && (
                      <button
                        className="text-button danger"
                        onClick={() => update('logo', undefined)}
                      >
                        Odebrat
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(e) => upload(e.target.files?.[0])}
                />
              </div>
              {error && (
                <div role="alert" className="error-box">
                  {error}
                </div>
              )}
              <div className="form-grid">
                {text('name', 'Jméno nebo obchodní firma *', { placeholder: 'Např. Jan Novák' })}
                {text('tradingName', 'Značka / obchodní název', { placeholder: 'Volitelné' })}
                {text('ico', 'IČO', { placeholder: '8 číslic', inputMode: 'numeric' })}
                {text('dic', 'DIČ', { placeholder: 'Např. CZ12345678' })}
                {text('street', 'Ulice a číslo *')}
                {text('city', 'Město *')}
                {text('zip', 'PSČ *')}
                {text('country', 'Země *')}
                {text('email', 'E-mail', { type: 'email' })}
                {text('phone', 'Telefon', { type: 'tel' })}
                {text('website', 'Webové stránky', { placeholder: 'www.vasefirma.cz' })}
                <Field label="Daňový režim">
                  <Select
                    value={settings.vatPayer ? 'yes' : 'no'}
                    onChange={(e) => update('vatPayer', e.target.value === 'yes')}
                  >
                    <option value="no">Nejsem plátce DPH</option>
                    <option value="yes">Jsem plátce DPH</option>
                  </Select>
                </Field>
              </div>
              <Field
                label="Údaj o zápisu do rejstříku"
                hint="Např. zápis v živnostenském rejstříku nebo oddíl a vložka obchodního rejstříku."
              >
                <Textarea
                  value={settings.registry}
                  onChange={(e) => update('registry', e.target.value)}
                  rows={2}
                />
              </Field>
              <div className="settings-bottom">
                <span>Změny se ukládají automaticky.</span>
                <button className="button primary" onClick={() => setTab('bank')}>
                  Pokračovat k platbě
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
          {tab === 'bank' && (
            <>
              <div className="section-heading">
                <h2>Platební údaje</h2>
                <p>Ať vaše peníze dorazí na správné místo.</p>
              </div>
              <div className="bank-illustration">
                <Landmark size={25} />
                <div>
                  <strong>Jeden účet. Méně přepisování.</strong>
                  <p>Platební údaje doplníme do každé nové faktury.</p>
                </div>
              </div>
              <div className="form-grid">
                {text('account', 'Číslo účtu', { placeholder: '123456789 nebo 19-123456789' })}
                {text('bankCode', 'Kód banky', {
                  placeholder: '0800',
                  inputMode: 'numeric',
                  maxLength: 4,
                })}
                {text('bankName', 'Název banky', { placeholder: 'Např. Česká spořitelna' })}
                {text('iban', 'IBAN', { placeholder: 'CZ65 0800 0000 1920 0014 5399' })}
                {text('swift', 'SWIFT / BIC', { placeholder: 'Pro zahraniční platby' })}
                <Field label="Výchozí způsob úhrady">
                  <Select
                    value={settings.paymentMethod}
                    onChange={(e) =>
                      update('paymentMethod', e.target.value as Settings['paymentMethod'])
                    }
                  >
                    {Object.entries(paymentLabels).map(([v, l]) => (
                      <option value={v} key={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="info-box">
                QR Platbu přidáme automaticky u CZK převodu, pokud je účet platný. Platební kód
                vytváříme přímo ve vašem prohlížeči.
              </div>
              <div className="settings-bottom">
                <span>Bankovní údaje jsou volitelné pro hotovostní platby.</span>
                <button className="button primary" onClick={() => setTab('defaults')}>
                  Výchozí hodnoty
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
          {tab === 'defaults' && (
            <>
              <div className="section-heading">
                <h2>Výchozí hodnoty faktur</h2>
                <p>Chytré přednastavení pro rychlejší práci.</p>
              </div>
              <div className="form-grid">
                <Field label="Měna">
                  <Select
                    value={settings.currency}
                    onChange={(e) => update('currency', e.target.value as Settings['currency'])}
                  >
                    <option value="CZK">CZK — česká koruna</option>
                    <option value="EUR">EUR — euro</option>
                    <option value="USD">USD — americký dolar</option>
                  </Select>
                </Field>
                <Field label="Splatnost">
                  <Select
                    value={settings.dueDays}
                    onChange={(e) => update('dueDays', Number(e.target.value))}
                  >
                    {[7, 14, 30, 60].map((n) => (
                      <option key={n} value={n}>
                        {n} dní
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Formát čísla faktury"
                  hint="{YYYY} = rok, {NNN} = pořadí s nulami. Musí obsahovat pořadí."
                >
                  <Input
                    value={settings.numberFormat}
                    onChange={(e) => update('numberFormat', e.target.value)}
                    placeholder="{YYYY}-{NNN}"
                  />
                </Field>
                <Field
                  label="Další pořadové číslo"
                  hint="Číslo se spotřebuje až vystavením faktury."
                >
                  <Input
                    type="number"
                    min="1"
                    max="1000000000"
                    step="1"
                    value={settings.nextNumber}
                    onChange={(e) => update('nextNumber', Number(e.target.value))}
                  />
                </Field>
                <Field label="Rok číselné řady">
                  <Input
                    type="number"
                    min="2000"
                    max="2200"
                    value={settings.numberingYear}
                    onChange={(e) => update('numberingYear', Number(e.target.value))}
                  />
                </Field>
                <Field label="Barva faktury">
                  <div className="color-control">
                    <input
                      aria-label="Barva faktury"
                      type="color"
                      value={settings.accent}
                      onChange={(e) => update('accent', e.target.value)}
                    />
                    <span>{settings.accent.toUpperCase()}</span>
                    <small>Minimal</small>
                  </div>
                </Field>
              </div>
              <Field label="Standardní text v patičce">
                <Textarea
                  value={settings.footer}
                  onChange={(e) => update('footer', e.target.value)}
                  rows={3}
                />
              </Field>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={settings.showLogo}
                  onChange={(e) => update('showLogo', e.target.checked)}
                />
                Zobrazovat logo na fakturách
              </label>
              <div className="info-box">
                Podporujeme tuzemské faktury neplátců, běžné DPH v CZK a ručně zvolený tuzemský
                režim přenesení daňové povinnosti. Přeshraniční plnění, opravné doklady a přepočty
                DPH z cizích měn nejsou podporovány.
              </div>
              <div className="settings-bottom">
                <span>Vše připraveno?</span>
                <button className="button primary" onClick={onDone}>
                  Zpět k fakturám
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
          {tab === 'data' && (
            <>
              <div className="section-heading">
                <h2>Data a zálohy</h2>
                <p>Vaše data patří vám. Vezměte si je kdykoliv s sebou.</p>
              </div>
              <div className="data-notice">
                <ShieldCheck size={24} />
                <div>
                  <h3>Uloženo pouze v tomto prohlížeči</h3>
                  <p>
                    Data nejsou synchronizována mezi zařízeními. Smazání dat webu, anonymní režim
                    nebo ztráta zařízení mohou znamenat jejich ztrátu. Pravidelně si stáhněte
                    vlastní zálohu.
                  </p>
                </div>
              </div>
              <div className="backup-row">
                <div className="backup-icon">
                  <Download size={21} />
                </div>
                <div>
                  <h3>Exportovat data</h3>
                  <p>Kompletní záloha faktur, odběratelů, nastavení i loga do JSON.</p>
                </div>
                <button className="button secondary" onClick={onExport}>
                  Stáhnout zálohu
                  <Download size={15} />
                </button>
              </div>
              <div className="backup-row">
                <div className="backup-icon">
                  <Upload size={21} />
                </div>
                <div>
                  <h3>Importovat data</h3>
                  <p>Obnovte dříve uloženou zálohu. Aktuální data budou nahrazena.</p>
                </div>
                <button className="button secondary" onClick={() => importRef.current?.click()}>
                  Vybrat soubor
                  <Upload size={15} />
                </button>
                <input
                  type="file"
                  accept=".json,application/json"
                  hidden
                  ref={importRef}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImport(f);
                    e.target.value = '';
                  }}
                />
              </div>
              <div className="backup-row destructive">
                <div className="backup-icon">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3>Smazat všechna data</h3>
                  <p>Trvale odstraní data této aplikace z tohoto prohlížeče.</p>
                </div>
                <button className="button danger-outline" onClick={onClear}>
                  Smazat data
                </button>
              </div>
              <button
                className="text-button storage-request"
                onClick={async () => {
                  try {
                    const ok = await navigator.storage?.persist?.();
                    setError(
                      ok
                        ? 'Prohlížeč povolil trvalé úložiště. Vlastní záloha je přesto důležitá.'
                        : 'Prohlížeč trvalé úložiště nepovolil. Pravidelně exportujte zálohu.',
                    );
                  } catch {
                    setError('Ochranu úložiště se nepodařilo nastavit.');
                  }
                }}
              >
                Požádat prohlížeč o ochranu úložiště
                <ShieldCheck size={15} />
              </button>
              {error && (
                <p className="info-box" role="status">
                  {error}
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
