import type { Customer, Invoice } from '../types';

export function invoiceCustomerForEditing(
  invoice: Invoice,
  customers: Customer[],
): Customer | undefined {
  if (!invoice.customer.name) return undefined;
  const directory = customers.find((customer) => customer.id === invoice.customerId);
  return {
    ...invoice.customer,
    id: invoice.customerId || crypto.randomUUID(),
    contact: directory?.contact ?? '',
    notes: directory?.notes ?? '',
  };
}
