// Columns declared `@db.Date` come back from Prisma as a Date at UTC midnight.
// Formatting with toISOString() and slicing keeps the stored calendar day; using
// the local getters instead would shift the day for anyone behind UTC.
export function toDateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function toDecimal(value: { toNumber(): number } | null | undefined): number | null {
  return value ? value.toNumber() : null;
}
