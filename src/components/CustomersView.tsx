import { useState } from 'react';
import { Search, Plus, Building2, ArrowUpRight, Trash2, Users } from 'lucide-react';
import type { Customer } from '../types';
export function CustomersView({
  customers,
  onAdd,
  onEdit,
  onDelete,
  onInvoice,
}: {
  customers: Customer[];
  onAdd: () => void;
  onEdit: (c: Customer) => void;
  onDelete: (c: Customer) => void;
  onInvoice: (c: Customer) => void;
}) {
  const [search, setSearch] = useState('');
  const shown = customers.filter((c) =>
    `${c.name} ${c.ico} ${c.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LIDÉ, SE KTERÝMI SPOLUPRACUJETE</div>
          <h1>
            Odběratelé<span className="heading-dot">.</span>
          </h1>
          <p>Kontakty jednou uložíte. Na fakturu je přidáte jedním kliknutím.</p>
        </div>
        <button className="button primary" onClick={onAdd}>
          <Plus size={18} />
          Nový odběratel
        </button>
      </div>
      <section className="list-panel">
        <div className="list-toolbar">
          <h3>
            Váš adresář <span className="count">{customers.length}</span>
          </h3>
          <div className="search-input">
            <Search size={17} />
            <input
              value={search}
              aria-label="Hledat odběratele"
              placeholder="Jméno, IČO nebo e-mail…"
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {!shown.length ? (
          <div className="empty-state">
            <div className="empty-round">
              <Users size={30} />
            </div>
            <h2>{search ? 'Žádný odběratel neodpovídá.' : 'Dobrá spolupráce začíná tady.'}</h2>
            <p>Uložte si své klienty pro rychlejší vytváření faktur.</p>
            <button className="button primary" onClick={onAdd}>
              <Plus size={17} />
              Přidat odběratele
            </button>
          </div>
        ) : (
          <div className="customer-grid">
            {shown.map((c) => (
              <article className="customer-card" key={c.id}>
                <div className="customer-card-top">
                  <div className="customer-avatar">
                    <Building2 size={20} />
                  </div>
                  <button
                    className="icon-button danger"
                    aria-label={`Smazat ${c.name}`}
                    onClick={() => onDelete(c)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <button className="customer-name" onClick={() => onEdit(c)}>
                  {c.name}
                  <ArrowUpRight size={15} />
                </button>
                <p>
                  {c.street}
                  <br />
                  {c.zip} {c.city}
                </p>
                <span className="muted">{c.ico ? `IČO ${c.ico}` : 'Soukromá osoba'}</span>
                <div className="customer-card-footer">
                  <span>{c.email || 'Bez e-mailu'}</span>
                  <button className="text-button" onClick={() => onInvoice(c)}>
                    Fakturovat
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
