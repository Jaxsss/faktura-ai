import { useState } from 'react';
import type { Customer } from '../types';
import { emptyParty } from '../types';
import { validateParty } from '../lib/validation';
import { Field, Input, Textarea, Busy } from './ui';
export function CustomerForm({
  initial,
  onSave,
  onCancel,
  allowManual = false,
}: {
  initial?: Customer;
  onSave: (customer: Customer, save: boolean) => Promise<void>;
  onCancel: () => void;
  allowManual?: boolean;
}) {
  const [value, setValue] = useState<Customer>(
    initial || { ...emptyParty, id: crypto.randomUUID(), notes: '', contact: '' },
  );
  const [save, setSave] = useState(true),
    [errors, setErrors] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  const field = (key: keyof Customer, label: string, extra = {}) => (
    <Field label={label}>
      <Input
        value={value[key]}
        onChange={(e) => setValue({ ...value, [key]: e.target.value })}
        {...extra}
      />
    </Field>
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const errs = validateParty(value);
        setErrors(errs);
        if (errs.length) return;
        setBusy(true);
        try {
          await onSave(value, save);
        } catch (err) {
          setErrors([err instanceof Error ? err.message : 'Odběratele se nepodařilo uložit.']);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        {field('name', 'Jméno nebo název společnosti *', {
          autoFocus: true,
          required: true,
          placeholder: 'Např. Studio Novák s.r.o.',
        })}
        {field('contact', 'Kontaktní osoba')}
        {field('ico', 'IČO', { inputMode: 'numeric', placeholder: '8 číslic' })}
        {field('dic', 'DIČ', { placeholder: 'Volitelné' })}
        {field('street', 'Ulice a číslo *', { required: true })}
        {field('city', 'Město *', { required: true })}
        {field('zip', 'PSČ *', { required: true })}
        {field('country', 'Země *', { required: true })}
        {field('email', 'E-mail', { type: 'email', placeholder: 'fakturace@firma.cz' })}
        {field('phone', 'Telefon')}
      </div>
      <Field label="Poznámka pro vás">
        <Textarea
          value={value.notes}
          onChange={(e) => setValue({ ...value, notes: e.target.value })}
          rows={2}
        />
      </Field>
      {allowManual && (
        <label className="check-label">
          <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
          Uložit také do adresáře odběratelů
        </label>
      )}
      {!!errors.length && (
        <div className="error-box" role="alert">
          {errors.map((x) => (
            <p key={x}>{x}</p>
          ))}
        </div>
      )}
      <div className="dialog-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          Zrušit
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? (
            <Busy label="Ukládám…" />
          ) : allowManual ? (
            'Použít odběratele'
          ) : (
            'Uložit odběratele'
          )}
        </button>
      </div>
    </form>
  );
}
