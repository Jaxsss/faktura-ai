import QRCode from 'qrcode';
import type { Invoice } from '../../types';
import type { InvoiceTotals } from '../../types';

function mod97(value: string): number {
  let remainder = 0;
  for (const char of value) {
    const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
}
function validIban(raw: string): string | undefined {
  const iban = raw.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return;
  if (mod97(iban.slice(4) + iban.slice(0, 4)) !== 1) return;
  return iban;
}
function validCzechPart(value: string, size: number, weights: number[]): boolean {
  if (!/^\d+$/.test(value) || value.length > size) return false;
  const digits = value.padStart(size, '0').split('').map(Number);
  return digits.reduce((sum, digit, index) => sum + digit * weights[index], 0) % 11 === 0;
}
function domesticIban(account: string, bankCode: string): string | undefined {
  const parsed = /^(?:(\d{1,6})-)?(\d{1,10})(?:\/(\d{4}))?$/.exec(account.replace(/\s/g, ''));
  if (!parsed) return;
  const prefix = parsed[1] || '0';
  const main = parsed[2];
  const bank = parsed[3] || bankCode.trim();
  if (
    !/^\d{4}$/.test(bank) ||
    bank === '0000' ||
    /^0+$/.test(main) ||
    !validCzechPart(prefix, 6, [10, 5, 8, 4, 2, 1]) ||
    !validCzechPart(main, 10, [6, 3, 7, 9, 10, 5, 8, 4, 2, 1])
  )
    return;
  const bban = `${bank}${prefix.padStart(6, '0')}${main.padStart(10, '0')}`;
  const checksum = String(98 - mod97(`${bban}CZ00`)).padStart(2, '0');
  return `CZ${checksum}${bban}`;
}

export async function paymentQr(
  invoice: Invoice,
  totals: InvoiceTotals,
): Promise<string | undefined> {
  if (invoice.paymentMethod !== 'transfer' || invoice.currency !== 'CZK') return;
  const iban =
    validIban(invoice.supplier.iban) ||
    domesticIban(invoice.supplier.account, invoice.supplier.bankCode);
  const amount = totals.total;
  if (!iban || !/^\d+\.\d{2}$/.test(amount) || /^0+\.00$/.test(amount)) return;
  const fields = ['SPD', '1.0', `ACC:${iban}`, `AM:${amount}`, 'CC:CZK'];
  if (/^\d{1,10}$/.test(invoice.variableSymbol)) fields.push(`X-VS:${invoice.variableSymbol}`);
  const note = (invoice.paymentReference || invoice.number)
    .replace(/[\r\n*]/g, ' ')
    .trim()
    .slice(0, 60);
  if (note) fields.push(`MSG:${note}`);
  return QRCode.toDataURL(fields.join('*'), {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 240,
    color: { dark: '#24332D', light: '#FFFFFF' },
  });
}
