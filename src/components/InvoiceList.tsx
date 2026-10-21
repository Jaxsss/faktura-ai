import { useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownToLine,
  Search,
  Plus,
  FileText,
  Copy,
  Trash2,
  Check,
  Undo2,
  ArrowRight,
} from 'lucide-react';
import type { Invoice, Settings } from '../types';
import { money, dateLabel, invoiceStatus, statusLabels } from '../lib/format';
import Decimal from 'decimal.js';
import { calculateInvoice } from '../lib/calculations';
export function InvoiceList({
  invoices,
  settings,
  onNew,
  onOpen,
  onDuplicate,
  onDownload,
  onPaid,
  onDelete,
  onSettings,
}: {
  invoices: Invoice[];
  settings: Settings;
  onNew: () => void;
  onOpen: (i: Invoice) => void;
  onDuplicate: (i: Invoice) => void;
  onDownload: (i: Invoice) => void;
  onPaid: (i: Invoice) => void;
  onDelete: (i: Invoice) => void;
  onSettings: (tab?: 'company' | 'data') => void;
}) {
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all');
  const shown = invoices.filter(
    (i) =>
      (filter === 'all' || invoiceStatus(i) === filter) &&
      `${i.number} ${i.customer.name}`.toLowerCase().includes(search.toLowerCase()),
  );
  const total = (i: Invoice) => {
    try {
      return calculateInvoice(i).total;
    } catch {
      return '';
    }
  };
  const sum = (status: string) =>
    invoices
      .filter(
        (i) =>
          i.currency === 'CZK' &&
          (status === 'outstanding' ? i.status === 'issued' : invoiceStatus(i) === status),
      )
      .reduce((a, i) => a.plus(total(i) || '0'), new Decimal(0))
      .toFixed(2);
  const hasProfile = !!settings.name;
  const noun = (n: number, forms: [string, string, string]) =>
    forms[n === 1 ? 0 : n >= 2 && n <= 4 ? 1 : 2];
  const count = (status: Invoice['status']) =>
    invoices.filter((i) => i.status === status && i.currency === 'CZK').length;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">VŠECHNO NA SVÉM MÍSTĚ</div>
          <h1>
            Vaše faktury<span className="heading-dot">.</span>
          </h1>
          <p>Méně papírování. Více času na to, co vás baví.</p>
        </div>
        <button className="button primary" onClick={onNew}>
          <Plus size={18} />
          Nová faktura
        </button>
      </div>
      {!hasProfile && (
        <div className="welcome-banner">
          <div className="welcome-icon">
            <FileText size={24} />
          </div>
          <div>
            <h3>Vítejte! Připravme vaši první fakturu.</h3>
            <p>Vyplňte údaje o svém podnikání. Příště už je doplníme za vás.</p>
          </div>
          <button className="button secondary" onClick={() => onSettings()}>
            Nastavit společnost
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      <div className="metrics">
        <div className="metric">
          <span>
            K úhradě <span className="tiny-dot amber" />
          </span>
          <strong>{money(sum('outstanding'))}</strong>
          <small>
            {count('issued')} {noun(count('issued'), ['faktura', 'faktury', 'faktur'])} v CZK
          </small>
        </div>
        <div className="metric">
          <span>
            Po splatnosti <span className="tiny-dot red" />
          </span>
          <strong>{money(sum('overdue'))}</strong>
          <small>Částky po datu splatnosti · CZK</small>
        </div>
        <div className="metric">
          <span>
            Uhrazeno <span className="tiny-dot green" />
          </span>
          <strong>{money(sum('paid'))}</strong>
          <small>
            {count('paid')} {noun(count('paid'), ['faktura', 'faktury', 'faktur'])} v CZK
          </small>
        </div>
        <div className="metric metric-quiet">
          <span>Rozepsané</span>
          <strong>
            {invoices.filter((i) => i.status === 'draft').length}
            <small>
              {noun(invoices.filter((i) => i.status === 'draft').length, [
                'koncept',
                'koncepty',
                'konceptů',
              ])}
            </small>
          </strong>
          <small>Připravené, až budete vy</small>
        </div>
      </div>
      <section className="list-panel">
        <div className="list-toolbar">
          <div className="tabs" role="group" aria-label="Stav faktur">
            {[
              ['all', 'Všechny faktury'],
              ['issued', 'Vystavené'],
              ['paid', 'Uhrazené'],
              ['draft', 'Koncepty'],
              ['overdue', 'Po splatnosti'],
            ].map(([v, l]) => (
              <button key={v} className={filter === v ? 'active' : ''} onClick={() => setFilter(v)}>
                {l}
                {v === 'all' && <span>{invoices.length}</span>}
              </button>
            ))}
          </div>
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Hledat fakturu nebo odběratele"
              placeholder="Hledat fakturu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {!shown.length ? (
          <div className="empty-state">
            <div className="empty-paper">
              <FileText size={32} />
              <span className="empty-paper-line" />
              <span className="empty-paper-line short" />
            </div>
            <h2>
              {invoices.length ? 'Tady je zatím prázdno.' : 'Vaše první faktura je na dosah.'}
            </h2>
            <p>
              {invoices.length
                ? 'Zkuste jiné hledání nebo změňte filtr.'
                : 'Přehledné faktury, spokojenější klienti. Začněte tou první.'}
            </p>
            <button className="button primary" onClick={onNew}>
              <Plus size={17} />
              Vytvořit fakturu
            </button>
            <span className="empty-note">Bez registrace. Bez zbytečností.</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Číslo / odběratel</th>
                  <th>Vystaveno</th>
                  <th>Splatnost</th>
                  <th>Stav</th>
                  <th className="align-right">Částka</th>
                  <th>
                    <span className="sr-only">Akce</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <button className="invoice-link" onClick={() => onOpen(i)}>
                        {i.number}
                        <ArrowUpRight size={14} />
                      </button>
                      <span className="customer-cell">
                        {i.customer.name || 'Odběratel není vybraný'}
                      </span>
                    </td>
                    <td>{dateLabel(i.issueDate)}</td>
                    <td className={invoiceStatus(i) === 'overdue' ? 'text-red' : ''}>
                      {dateLabel(i.dueDate)}
                    </td>
                    <td>
                      <span className={`status ${invoiceStatus(i)}`}>
                        <span />
                        {statusLabels[invoiceStatus(i)]}
                      </span>
                    </td>
                    <td className="align-right amount-cell">
                      {total(i) ? money(total(i), i.currency) : 'Neúplný koncept'}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          title="Stáhnout PDF"
                          aria-label={`Stáhnout PDF ${i.number}`}
                          onClick={() => onDownload(i)}
                        >
                          <ArrowDownToLine size={16} />
                        </button>
                        <button
                          className="icon-button"
                          title="Duplikovat"
                          aria-label={`Duplikovat ${i.number}`}
                          onClick={() => onDuplicate(i)}
                        >
                          <Copy size={15} />
                        </button>
                        {i.status !== 'draft' && (
                          <button
                            className="icon-button"
                            title={
                              i.status === 'paid'
                                ? 'Označit jako neuhrazenou'
                                : 'Označit jako uhrazenou'
                            }
                            aria-label={
                              i.status === 'paid'
                                ? 'Označit jako neuhrazenou'
                                : 'Označit jako uhrazenou'
                            }
                            onClick={() => onPaid(i)}
                          >
                            {i.status === 'paid' ? <Undo2 size={15} /> : <Check size={15} />}
                          </button>
                        )}
                        <button
                          className="icon-button danger"
                          title="Smazat"
                          aria-label={`Smazat ${i.number}`}
                          onClick={() => onDelete(i)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="list-footer">
          <span>
            {shown.length} {noun(shown.length, ['faktura', 'faktury', 'faktur'])} v přehledu
          </span>
          <span>Vše zůstává ve vašem prohlížeči.</span>
        </div>
      </section>
      <div className="quiet-tip">
        <span className="tip-symbol">↗</span>
        <p>Malý návyk, velký klid. Pravidelně si stáhněte zálohu svých dat.</p>
        <button onClick={() => onSettings('data')}>
          Data a zálohy
          <ArrowRight size={14} />
        </button>
      </div>
    </>
  );
}
