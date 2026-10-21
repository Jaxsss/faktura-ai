import Decimal from 'decimal.js';
import type { Invoice, InvoiceTotals, VatGroup } from '../types';

// Keep ample precision through multiplication and inclusive-VAT division before cent rounding.
const MoneyDecimal = Decimal.clone({ precision: 100 });
const ZERO = new MoneyDecimal(0);
const HUNDRED = new MoneyDecimal(100);
const SUPPORTED_RATES = [0, 12, 21] as const;

function amount(value: string, errorMessage: string, allowEmpty = false): Decimal {
  if (allowEmpty && value === '') return ZERO;
  if (typeof value !== 'string' || !/^\d+(?:[.,]\d+)?$/.test(value)) throw new Error(errorMessage);
  const result = new MoneyDecimal(value.replace(',', '.'));
  if (!result.isFinite()) throw new Error(errorMessage);
  return result;
}

function money(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function formatted(value: Decimal): string {
  return value.toFixed(2);
}

export function calculateInvoice(
  invoice: Pick<Invoice, 'items' | 'taxMode' | 'pricesIncludeVat' | 'discount'>,
): InvoiceTotals {
  const discountError = 'Sleva musí být číslo od 0 do 100 %.';
  const discountPercent = amount(invoice.discount, discountError);
  if (discountPercent.gt(HUNDRED)) throw new Error(discountError);
  if (!['standard', 'nonvat', 'reverse', 'exempt'].includes(invoice.taxMode))
    throw new Error('Neplatný režim DPH.');

  const discountFactor = HUNDRED.minus(discountPercent).div(HUNDRED);
  const chargesVat = invoice.taxMode === 'standard';
  const groups = new Map<number, { base: Decimal; vat: Decimal }>();
  let subtotal = ZERO;
  let discount = ZERO;
  let net = ZERO;
  let vat = ZERO;
  let total = ZERO;

  const lines = invoice.items.map((item, index) => {
    const quantityError = `Položka ${index + 1}: množství musí být kladné číslo.`;
    const quantity = amount(item.quantity, quantityError);
    if (quantity.isZero()) throw new Error(quantityError);
    const unitPrice = amount(
      item.unitPrice,
      `Položka ${index + 1}: cena musí být nezáporné číslo.`,
      true,
    );
    if (!SUPPORTED_RATES.includes(item.vatRate as (typeof SUPPORTED_RATES)[number])) {
      throw new Error(`Položka ${index + 1}: nepodporovaná sazba DPH.`);
    }

    const rate = chargesVat ? item.vatRate : 0;
    const originalAmount = quantity.times(unitPrice);
    const discountedAmount = originalAmount.times(discountFactor);
    let originalNet: Decimal;
    let lineNet: Decimal;
    let lineVat: Decimal;
    let lineGross: Decimal;

    if (chargesVat && invoice.pricesIncludeVat) {
      const divisor = new MoneyDecimal(1).plus(new MoneyDecimal(rate).div(HUNDRED));
      originalNet = money(originalAmount.div(divisor));
      lineNet = money(discountedAmount.div(divisor));
      lineGross = money(discountedAmount);
      lineVat = lineGross.minus(lineNet);
    } else {
      // Untaxed modes treat entered prices as plain amounts even when the inclusive switch is set.
      originalNet = money(originalAmount);
      lineNet = money(discountedAmount);
      lineVat = chargesVat ? money(lineNet.times(rate).div(HUNDRED)) : ZERO;
      lineGross = lineNet.plus(lineVat);
    }

    const lineDiscount = originalNet.minus(lineNet);
    subtotal = subtotal.plus(originalNet);
    discount = discount.plus(lineDiscount);
    net = net.plus(lineNet);
    vat = vat.plus(lineVat);
    total = total.plus(lineGross);

    // VAT groups contain the discounted taxable base, matching the rounded lines.
    const group = groups.get(rate) ?? { base: ZERO, vat: ZERO };
    group.base = group.base.plus(lineNet);
    group.vat = group.vat.plus(lineVat);
    groups.set(rate, group);

    return {
      net: formatted(lineNet),
      vat: formatted(lineVat),
      gross: formatted(lineGross),
      discount: formatted(lineDiscount),
    };
  });

  const vatGroups: VatGroup[] = [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rate, group]) => ({ rate, base: formatted(group.base), vat: formatted(group.vat) }));

  return {
    lines,
    subtotal: formatted(subtotal),
    discount: formatted(discount),
    net: formatted(net),
    vat: formatted(vat),
    total: formatted(total),
    vatGroups,
  };
}
