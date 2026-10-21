import type { Invoice, Party } from '../types';

const dateOnly = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const decimal = (value: string) =>
  value.trim() !== '' &&
  /^\d+(?:[.,]\d+)?$/.test(value) &&
  Number.isFinite(Number(value.replace(',', '.')));
const isCzech = (country: string) =>
  country
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .match(/^(?:ceska republika|czech republic|czechia|cz|cr)$/) !== null;

export function validIco(value: string): boolean {
  const ico = value.replace(/\s/g, '');
  if (!/^\d{8}$/.test(ico)) return false;
  const sum = [...ico.slice(0, 7)].reduce(
    (total, digit, index) => total + Number(digit) * (8 - index),
    0,
  );
  const remainder = sum % 11;
  const check = remainder === 0 ? 1 : remainder === 1 ? 0 : 11 - remainder;
  return Number(ico[7]) === check;
}

export function validIban(value: string): boolean {
  const iban = value.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = char >= 'A' && char <= 'Z' ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export function validateParty(party: Party): string[] {
  const errors: string[] = [];
  if (!party.name.trim()) errors.push('Vyplňte název nebo jméno.');
  if (!party.street.trim() || !party.city.trim() || !party.zip.trim() || !party.country.trim())
    errors.push('Vyplňte úplnou adresu (ulice, město, PSČ a stát).');
  if (isCzech(party.country) && party.ico.trim() && !validIco(party.ico))
    errors.push('IČO nemá platný formát nebo kontrolní číslici.');
  if (isCzech(party.country) && party.zip.trim() && !/^\d{3}\s?\d{2}$/.test(party.zip.trim()))
    errors.push('PSČ musí mít 5 číslic, například 110 00.');
  if (party.dic.trim() && !/^[A-Z]{2}[A-Z0-9]{2,12}$/.test(party.dic.trim()))
    errors.push('DIČ musí obsahovat kód země a platné identifikační znaky.');
  if (party.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(party.email))
    errors.push('E-mail nemá platný formát.');
  return errors;
}

export function validateInvoice(invoice: Invoice): string[] {
  const errors = [
    ...validateParty(invoice.supplier).map((error) => `Dodavatel: ${error}`),
    ...validateParty(invoice.customer).map((error) => `Odběratel: ${error}`),
  ];
  if (!invoice.number.trim() || invoice.number.length > 100)
    errors.push('Vyplňte číslo faktury (nejvýše 100 znaků).');
  const supplierIsCzech = isCzech(invoice.supplier.country);
  if (supplierIsCzech && !validIco(invoice.supplier.ico))
    errors.push('Dodavatel v České republice musí mít platné IČO.');
  if (
    ['standard', 'reverse'].includes(invoice.taxMode) &&
    (!isCzech(invoice.supplier.country) || !isCzech(invoice.customer.country))
  )
    errors.push(
      'Běžné faktury s DPH a přenesenou daňovou povinností jsou podporovány pouze pro české dodavatele a odběratele.',
    );
  if (invoice.taxMode === 'standard' && invoice.currency !== 'CZK')
    errors.push('Běžnou fakturu s DPH lze vystavit pouze v CZK; převod měny není podporován.');
  if (invoice.taxMode === 'standard' && !invoice.supplier.vatPayer)
    errors.push('Běžnou fakturu s DPH může vystavit pouze plátce DPH.');
  if (
    ['standard', 'exempt'].includes(invoice.taxMode) &&
    (!invoice.supplier.vatPayer || !/^CZ\d{8,10}$/.test(invoice.supplier.dic))
  )
    errors.push('U faktury s DPH uveďte dodavatele plátce s platným českým DIČ.');
  if (invoice.taxMode === 'exempt' && !invoice.exemptionReason.trim())
    errors.push('U osvobozené faktury uveďte důvod osvobození.');
  if (
    invoice.taxMode === 'reverse' &&
    (!invoice.supplier.vatPayer ||
      !/^CZ\d{8,10}$/.test(invoice.supplier.dic) ||
      !/^CZ\d{8,10}$/.test(invoice.customer.dic))
  )
    errors.push(
      'Režim přenesené daňové povinnosti vyžaduje české DIČ dodavatele i odběratele a dodavatele plátce DPH.',
    );
  if (invoice.taxMode === 'nonvat' && invoice.supplier.vatPayer)
    errors.push('Plátce DPH nemůže vystavit fakturu v režimu neplátce DPH.');
  if (invoice.taxMode === 'nonvat' && invoice.items.some((item) => item.vatRate !== 0))
    errors.push('U neplátce DPH musí být sazba DPH u všech položek 0 %.');
  const taxableDateApplies = invoice.taxMode !== 'nonvat';
  if (
    !dateOnly(invoice.issueDate) ||
    !dateOnly(invoice.dueDate) ||
    (taxableDateApplies && !dateOnly(invoice.taxableDate))
  )
    errors.push('Datum vystavení, splatnosti a uskutečnění musí být platná data.');
  else {
    if (invoice.dueDate < invoice.issueDate)
      errors.push('Datum splatnosti nesmí předcházet datu vystavení.');
  }
  if (invoice.deliveryDate && !dateOnly(invoice.deliveryDate))
    errors.push('Datum dodání není platné.');
  if (!invoice.items.length) errors.push('Faktura musí obsahovat alespoň jednu položku.');
  for (const [index, item] of invoice.items.entries()) {
    const line = index + 1;
    if (!item.description.trim()) errors.push(`Položka ${line}: vyplňte popis.`);
    if (!decimal(item.quantity) || Number(item.quantity.replace(',', '.')) <= 0)
      errors.push(`Položka ${line}: množství musí být kladné číslo.`);
    if (!decimal(item.unitPrice) || Number(item.unitPrice.replace(',', '.')) < 0)
      errors.push(`Položka ${line}: cena musí být nezáporné číslo.`);
    if (![0, 12, 21].includes(item.vatRate))
      errors.push(`Položka ${line}: sazba DPH musí být 0 %, 12 % nebo 21 %.`);
  }
  if (
    !decimal(invoice.discount) ||
    Number(invoice.discount.replace(',', '.')) < 0 ||
    Number(invoice.discount.replace(',', '.')) > 100
  )
    errors.push('Sleva musí být číslo od 0 do 100 %.');
  if (!/^(\d{1,10}|)$/.test(invoice.variableSymbol))
    errors.push('Variabilní symbol může obsahovat nejvýše 10 číslic.');
  if (invoice.paymentMethod === 'transfer') {
    const acct = invoice.supplier.account.trim();
    const accountValid = /^\d{1,10}$/.test(acct) || /^\d{1,6}-\d{1,10}$/.test(acct);
    const codeValid = /^\d{4}$/.test(invoice.supplier.bankCode.trim());
    const iban = invoice.supplier.iban.trim();
    const ibanValid = !!iban && validIban(iban);
    if (iban && !ibanValid) errors.push('IBAN nemá platný formát nebo kontrolní součet.');
    if (!(accountValid && codeValid) && !ibanValid)
      errors.push(
        'U bankovního převodu vyplňte platný IBAN nebo číslo účtu a čtyřmístný kód banky.',
      );
  }
  return [...new Set(errors)];
}
