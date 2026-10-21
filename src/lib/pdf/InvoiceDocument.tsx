import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { Invoice, InvoiceTotals, Party } from '../../types';
import { paymentLabels } from '../../types';
import { dateLabel, money } from '../format';

const fontSource = (name: string) =>
  typeof window === 'undefined'
    ? `${process.cwd()}/public/fonts/${name}`
    : `${import.meta.env.BASE_URL}fonts/${name}`;
Font.register({
  family: 'Noto Sans',
  fonts: [
    { src: fontSource('NotoSans-Regular.ttf'), fontWeight: 400 },
    { src: fontSource('NotoSans-Bold.ttf'), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) =>
  word.length > 24 ? word.match(/.{1,18}/gu) || [word] : [word],
);

const ink = '#24332d';
const muted = '#6b7770';
const rule = '#dce2dc';
const pale = '#f4f6f2';
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Noto Sans',
    fontSize: 9,
    color: ink,
    backgroundColor: '#fffefa',
    paddingTop: 39,
    paddingHorizontal: 42,
    paddingBottom: 59,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  topLeft: { width: '70%' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  eyebrow: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  title: { fontSize: 31, fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.1 },
  topRight: { width: '28%', alignItems: 'flex-end', textAlign: 'right' },
  logo: { width: 80, height: 34, objectFit: 'contain', marginLeft: 16 },
  numberLabel: { fontSize: 8, color: muted, marginBottom: 3 },
  number: { fontSize: 14, fontWeight: 700 },
  divider: { height: 3, marginBottom: 24 },
  parties: { marginBottom: 23 },
  partyRow: { flexDirection: 'row' },
  identifiers: { marginTop: 6, flexDirection: 'row' },
  contacts: { marginTop: 7, flexDirection: 'row' },
  party: { width: '50%', paddingRight: 20 },
  label: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  partyName: { fontSize: 12, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 },
  partyLine: { fontSize: 9, lineHeight: 1.55, color: '#45544c' },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: pale,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  metaCell: { width: '25%', paddingRight: 8, marginBottom: 3 },
  metaLabel: { fontSize: 7.5, color: muted, marginBottom: 5 },
  metaValue: { fontSize: 9, fontWeight: 700, lineHeight: 1.35 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: ink,
    paddingBottom: 7,
  },
  th: { fontSize: 7.5, fontWeight: 700, color: muted, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: rule,
    paddingVertical: 10,
    minHeight: 31,
  },
  description: { width: '46%', paddingRight: 10, fontSize: 9, lineHeight: 1.45 },
  quantity: { width: '10%', textAlign: 'right', paddingRight: 5 },
  price: { width: '18%', textAlign: 'right', paddingRight: 5 },
  vat: { width: '9%', textAlign: 'right' },
  amount: { width: '17%', textAlign: 'right', fontWeight: 700 },
  totals: { alignSelf: 'flex-end', width: '49%', marginTop: 19, marginBottom: 22 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { color: muted },
  totalValue: { fontWeight: 700 },
  grand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: ink,
    marginTop: 8,
    paddingTop: 12,
  },
  grandLabel: { fontSize: 10, fontWeight: 700 },
  grandValue: { fontSize: 17, fontWeight: 700 },
  payment: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: rule,
    paddingTop: 15,
    marginTop: 5,
  },
  paymentInfo: { width: '78%' },
  paymentRow: { flexDirection: 'row', marginBottom: 4 },
  paymentLabel: { width: 115, color: muted },
  paymentValue: { flex: 1, fontWeight: 700 },
  qr: { width: 84, height: 84 },
  note: { marginTop: 20, padding: 12, backgroundColor: pale, lineHeight: 1.5 },
  noteLabel: { fontWeight: 700, marginBottom: 4 },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 42,
    right: 42,
    borderTopWidth: 1,
    borderTopColor: rule,
    paddingTop: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  footerText: { width: '84%', fontSize: 7, color: muted, lineHeight: 1.45 },
  footerPage: { fontSize: 7, color: muted },
});

function PartyBlock({ party, label }: { party: Party; label: string }) {
  const location = [party.zip, party.city].filter(Boolean).join(' ');
  return (
    <View style={styles.party}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.partyName}>{party.name || '—'}</Text>
      {party.tradingName && party.tradingName !== party.name && (
        <Text style={styles.partyLine}>{party.tradingName}</Text>
      )}
      {party.street && <Text style={styles.partyLine}>{party.street}</Text>}
      {location && <Text style={styles.partyLine}>{location}</Text>}
      {party.country && <Text style={styles.partyLine}>{party.country}</Text>}
    </View>
  );
}

function PartyIdentifiers({ party }: { party: Party }) {
  return (
    <View style={styles.party}>
      <Text style={styles.partyLine}>
        {party.ico ? (
          <>
            <Text style={{ fontWeight: 700 }}>IČO:</Text> {party.ico}
          </>
        ) : (
          ' '
        )}
      </Text>
      <Text style={styles.partyLine}>
        {party.dic ? (
          <>
            <Text style={{ fontWeight: 700 }}>DIČ:</Text> {party.dic}
          </>
        ) : (
          ' '
        )}
      </Text>
    </View>
  );
}

function PartyContacts({
  party,
  showEmail,
  showPhone,
  showWebsite,
}: {
  party: Party;
  showEmail: boolean;
  showPhone: boolean;
  showWebsite: boolean;
}) {
  return (
    <View style={styles.party}>
      {showEmail && <Text style={styles.partyLine}>{party.email || ' '}</Text>}
      {showPhone && <Text style={styles.partyLine}>{party.phone || ' '}</Text>}
      {showWebsite && <Text style={styles.partyLine}>{party.website || ' '}</Text>}
    </View>
  );
}

function TotalLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={styles.totalValue}>{value}</Text>
    </View>
  );
}

export function InvoiceDocument({
  invoice,
  totals,
  logo,
  qr,
}: {
  invoice: Invoice;
  totals: InvoiceTotals;
  logo?: string;
  qr?: string;
}) {
  const accent = /^#[\da-fA-F]{6}$/.test(invoice.supplier.accent)
    ? invoice.supplier.accent
    : '#294d42';
  const hasVat = invoice.taxMode === 'standard';
  const taxDocument = invoice.taxMode !== 'nonvat';
  const bankAccount = invoice.supplier.account.includes('/')
    ? invoice.supplier.account
    : [invoice.supplier.account, invoice.supplier.bankCode].filter(Boolean).join('/');
  const supplierLine = [
    invoice.supplier.name,
    invoice.supplier.ico && `IČO ${invoice.supplier.ico}`,
  ]
    .filter(Boolean)
    .join('  ·  ');
  const footerDetail = [invoice.supplier.registry, invoice.footer].filter(Boolean).join('  ·  ');
  const flowFooter = footerDetail.length > 120;
  const footer = (
    flowFooter ? supplierLine : [footerDetail, supplierLine].filter(Boolean).join('  ·  ')
  ).slice(0, 155);
  const metaEntries = [
    ['Datum vystavení', dateLabel(invoice.issueDate)],
    ['Datum splatnosti', dateLabel(invoice.dueDate)],
    ...(taxDocument ? [['Datum zdanitelného plnění', dateLabel(invoice.taxableDate)]] : []),
    ...(invoice.deliveryDate ? [['Datum dodání', dateLabel(invoice.deliveryDate)]] : []),
    ['Způsob úhrady', paymentLabels[invoice.paymentMethod]],
  ];
  const descriptionStyle = hasVat ? styles.description : { ...styles.description, width: '49%' };
  const quantityStyle = hasVat ? styles.quantity : { ...styles.quantity, width: '11%' };
  const priceStyle = hasVat ? styles.price : { ...styles.price, width: '21%' };
  const amountStyle = hasVat ? styles.amount : { ...styles.amount, width: '19%' };
  return (
    <Document
      title={`Faktura ${invoice.number}`}
      author={invoice.supplier.name || 'Faktura'}
      language="cs-CZ"
    >
      <Page size="A4" style={styles.page}>
        <Text
          fixed
          style={{ position: 'absolute', top: 19, left: 42, fontSize: 7.5, color: muted }}
          render={({ pageNumber }) =>
            pageNumber > 1 ? `FAKTURA ${invoice.number}  ·  POKRAČOVÁNÍ FAKTURY` : ''
          }
        />
        <View style={styles.top} wrap={false}>
          <View style={styles.topLeft}>
            <Text style={[styles.eyebrow, { color: accent }]}>
              {taxDocument ? 'Daňový doklad' : 'Účetní doklad'}
            </Text>
            <View style={styles.titleRow}>
              <Text style={styles.title}>FAKTURA</Text>
              {logo && invoice.supplier.showLogo && <Image src={logo} style={styles.logo} />}
            </View>
          </View>
          <View style={styles.topRight}>
            {invoice.status === 'draft' && (
              <Text style={{ fontSize: 8, color: muted, marginBottom: 6, letterSpacing: 1 }}>
                KONCEPT
              </Text>
            )}
            <Text style={styles.numberLabel}>ČÍSLO FAKTURY</Text>
            <Text style={styles.number}>{invoice.number || '—'}</Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: accent }]} />
        <View style={styles.parties} wrap={false}>
          <View style={styles.partyRow}>
            <PartyBlock party={invoice.supplier} label="Dodavatel" />
            <PartyBlock party={invoice.customer} label="Odběratel" />
          </View>
          {(invoice.supplier.ico ||
            invoice.supplier.dic ||
            invoice.customer.ico ||
            invoice.customer.dic) && (
            <View style={styles.identifiers}>
              <PartyIdentifiers party={invoice.supplier} />
              <PartyIdentifiers party={invoice.customer} />
            </View>
          )}
          {(invoice.supplier.email ||
            invoice.customer.email ||
            invoice.supplier.phone ||
            invoice.customer.phone ||
            invoice.supplier.website ||
            invoice.customer.website) && (
            <View style={styles.contacts}>
              {[invoice.supplier, invoice.customer].map((party, index) => (
                <PartyContacts
                  key={index}
                  party={party}
                  showEmail={!!(invoice.supplier.email || invoice.customer.email)}
                  showPhone={!!(invoice.supplier.phone || invoice.customer.phone)}
                  showWebsite={!!(invoice.supplier.website || invoice.customer.website)}
                />
              ))}
            </View>
          )}
        </View>
        <View style={styles.meta} wrap={false}>
          {metaEntries.map(([label, value]) => (
            <View key={label} style={[styles.metaCell, { width: `${100 / metaEntries.length}%` }]}>
              <Text style={styles.metaLabel}>{label}</Text>
              <Text style={styles.metaValue}>{value}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.sectionTitle}>Fakturované položky</Text>
        <View style={styles.tableHead} wrap={false}>
          <Text style={[styles.th, descriptionStyle]}>Popis</Text>
          <Text style={[styles.th, quantityStyle]}>Množství</Text>
          <Text style={[styles.th, priceStyle]}>
            {hasVat && invoice.pricesIncludeVat ? 'Cena / jedn. s DPH' : 'Cena / jedn.'}
          </Text>
          {hasVat && <Text style={[styles.th, styles.vat]}>DPH</Text>}
          <Text style={[styles.th, amountStyle]}>Celkem</Text>
        </View>
        {invoice.items.map((item, index) => (
          <View style={styles.row} key={item.id || index}>
            <Text style={descriptionStyle}>{item.description || '—'}</Text>
            <Text style={quantityStyle}>
              {item.quantity} {item.unit}
            </Text>
            <Text style={priceStyle}>{money(item.unitPrice || 0, invoice.currency)}</Text>
            {hasVat && <Text style={styles.vat}>{item.vatRate} %</Text>}
            <Text style={amountStyle}>
              {money(totals.lines[index]?.gross ?? 0, invoice.currency)}
            </Text>
          </View>
        ))}
        <View style={styles.totals} wrap={false}>
          <TotalLine label="Mezisoučet" value={money(totals.subtotal, invoice.currency)} />
          {Number(totals.discount) !== 0 && (
            <TotalLine label="Sleva" value={`− ${money(totals.discount, invoice.currency)}`} />
          )}
          {hasVat && (
            <>
              <TotalLine label="Základ daně" value={money(totals.net, invoice.currency)} />
              {totals.vatGroups.map((group) => (
                <TotalLine
                  key={group.rate}
                  label={`DPH ${group.rate} % ze základu ${money(group.base, invoice.currency)}`}
                  value={money(group.vat, invoice.currency)}
                />
              ))}
            </>
          )}
          <View style={styles.grand}>
            <Text style={styles.grandLabel}>K ÚHRADĚ</Text>
            <Text style={[styles.grandValue, { color: accent }]}>
              {money(totals.total, invoice.currency)}
            </Text>
          </View>
        </View>
        {invoice.taxMode === 'nonvat' && (
          <Text style={{ fontSize: 8, color: muted, marginBottom: 13 }}>
            Dodavatel není plátcem DPH.
          </Text>
        )}
        {invoice.taxMode === 'reverse' && (
          <Text style={{ fontSize: 8, color: muted, marginBottom: 13 }}>
            Daň odvede zákazník (režim přenesení daňové povinnosti).
          </Text>
        )}
        {invoice.taxMode === 'exempt' && (
          <Text style={{ fontSize: 8, color: muted, marginBottom: 13 }}>
            Plnění osvobozené od DPH. {invoice.exemptionReason}
          </Text>
        )}
        {invoice.paymentMethod === 'transfer' && (
          <View style={styles.payment} wrap={false}>
            <View style={styles.paymentInfo}>
              <Text style={styles.sectionTitle}>Platební údaje</Text>
              {bankAccount && (
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Číslo účtu</Text>
                  <Text style={styles.paymentValue}>{bankAccount}</Text>
                </View>
              )}
              {invoice.supplier.iban && (
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>IBAN</Text>
                  <Text style={styles.paymentValue}>{invoice.supplier.iban}</Text>
                </View>
              )}
              {invoice.supplier.swift && (
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>SWIFT / BIC</Text>
                  <Text style={styles.paymentValue}>{invoice.supplier.swift}</Text>
                </View>
              )}
              {invoice.variableSymbol && (
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Variabilní symbol</Text>
                  <Text style={styles.paymentValue}>{invoice.variableSymbol}</Text>
                </View>
              )}
              {invoice.supplier.bankName && (
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Banka</Text>
                  <Text style={styles.paymentValue}>{invoice.supplier.bankName}</Text>
                </View>
              )}
              {invoice.paymentInstructions && (
                <Text style={[styles.partyLine, { marginTop: 7 }]}>
                  {invoice.paymentInstructions}
                </Text>
              )}
            </View>
            {qr && <Image src={qr} style={styles.qr} />}
          </View>
        )}
        {(invoice.note || invoice.paymentReference || invoice.orderNumber || flowFooter) && (
          <View style={styles.note}>
            <Text style={styles.noteLabel} minPresenceAhead={30}>
              Další informace
            </Text>
            {invoice.orderNumber && <Text>Číslo objednávky: {invoice.orderNumber}</Text>}
            {invoice.paymentReference && <Text>Reference platby: {invoice.paymentReference}</Text>}
            {invoice.note && <Text>{invoice.note}</Text>}
            {flowFooter && invoice.supplier.registry && <Text>{invoice.supplier.registry}</Text>}
            {flowFooter && invoice.footer && <Text>{invoice.footer}</Text>}
          </View>
        )}
        <View
          fixed
          style={{
            position: 'absolute',
            bottom: 43,
            left: 42,
            right: 42,
            height: 1,
            backgroundColor: rule,
          }}
        />
        <Text
          fixed
          style={{
            position: 'absolute',
            bottom: 25,
            left: 42,
            width: '80%',
            fontSize: 7,
            color: muted,
          }}
          render={() => footer || invoice.supplier.name}
        />
        <Text
          fixed
          style={{ position: 'absolute', bottom: 25, right: 42, fontSize: 7, color: muted }}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </Page>
    </Document>
  );
}
