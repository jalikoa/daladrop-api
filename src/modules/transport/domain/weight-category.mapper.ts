import { ParcelWeightCategory } from '@prisma/client';

/** Accepts the client's `Small | Medium | Large` (any casing) and maps to the Prisma enum. */
export function toParcelWeightCategory(
  value?: string | null,
): ParcelWeightCategory | null {
  if (!value) return null;
  const key = value.trim().toUpperCase();
  if (key === 'SMALL') return ParcelWeightCategory.SMALL;
  if (key === 'MEDIUM') return ParcelWeightCategory.MEDIUM;
  if (key === 'LARGE') return ParcelWeightCategory.LARGE;
  return null;
}

export function fromParcelWeightCategory(
  value: ParcelWeightCategory | null,
): string | null {
  if (!value) return null;
  const key = value.toString();
  return key.charAt(0) + key.slice(1).toLowerCase();
}
