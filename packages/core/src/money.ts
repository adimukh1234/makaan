/**
 * Money helpers. All amounts are integer paise.
 *
 * A value of 100000 paise is Rs 1,000.
 */

export const PAISE_PER_RUPEE = 100;

export function toPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) {
    throw new Error('Amount must be a finite number');
  }
  return Math.round(rupees * PAISE_PER_RUPEE);
}

export function toRupees(paise: number): number {
  assertPaise(paise);
  return paise / PAISE_PER_RUPEE;
}

export function assertPaise(value: number, field = 'amount'): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non negative integer number of paise`);
  }
}

export function clampPaise(value: number, low = 0, high = Number.MAX_SAFE_INTEGER): number {
  return Math.min(Math.max(value, low), high);
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const inrPrecise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats paise as INR, rounding to whole rupees unless paise are present. */
export function formatPaise(paise: number): string {
  assertPaise(paise);
  if (paise % PAISE_PER_RUPEE === 0) {
    return inr.format(paise / PAISE_PER_RUPEE);
  }
  return inrPrecise.format(paise / PAISE_PER_RUPEE);
}

/** Formats a rupee amount without the currency symbol. */
export function formatRupeesNumber(paise: number): string {
  assertPaise(paise);
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(
    paise / PAISE_PER_RUPEE,
  );
}

export function sumPaise(values: number[]): number {
  let total = 0;
  for (const value of values) {
    assertPaise(value);
    total += value;
  }
  return total;
}

/** Parses a user typed rupee string such as "1,00,000" or "25000.50". */
export function parseRupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, '');
  if (cleaned === '' || !/^\d+(\.\d{0,2})?$/.test(cleaned)) {
    return null;
  }
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.round(value * PAISE_PER_RUPEE);
}
