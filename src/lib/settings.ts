import { z } from 'zod';
import type { Settings } from '../types';

export const text = z.string().max(100_000);
export const party = z.object({
  name: text,
  tradingName: text,
  ico: z.string().max(32),
  dic: z.string().max(32),
  street: text,
  city: text,
  zip: text,
  country: text,
  email: z.string().max(320),
  phone: text,
  website: text,
});
export const logoDataUrl = z
  .string()
  .max(8_000_000)
  .regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]*={0,2}$/);
const logo = z.union([logoDataUrl, z.string().regex(/^asset:[a-zA-Z0-9_-]{1,100}$/)]).optional();
export const settingsSchema = party.extend({
  id: z.literal('company'),
  vatPayer: z.boolean(),
  logo,
  showLogo: z.boolean(),
  bankName: text,
  account: text,
  bankCode: text,
  iban: text,
  swift: text,
  paymentMethod: z.enum(['transfer', 'cash', 'card', 'other']),
  currency: z.enum(['CZK', 'EUR', 'USD']),
  dueDays: z.number().int().min(0).max(365),
  registry: text,
  footer: text,
  numberFormat: z.string().min(1).max(100),
  nextNumber: z.number().int().positive().max(1_000_000_000),
  numberingYear: z.number().int().min(2000).max(2200),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const persistedSettingsSchema = settingsSchema.extend({
  logo: z
    .instanceof(Blob)
    .refine(
      (blob) =>
        blob.size <= 5_000_000 && ['image/png', 'image/jpeg', 'image/webp'].includes(blob.type),
      'Logo musí být PNG, JPG nebo WebP a mít nejvýše 5 MB.',
    )
    .optional(),
});

export function settingsErrors(settings: Settings): string[] {
  const result = persistedSettingsSchema.safeParse(settings);
  return result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join('.')} – ${issue.message}`);
}
