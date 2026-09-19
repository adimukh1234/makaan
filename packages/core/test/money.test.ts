import { describe, expect, it } from 'vitest';
import {
  PAISE_PER_RUPEE,
  assertPaise,
  clampPaise,
  formatPaise,
  parseRupeesToPaise,
  sumPaise,
  toPaise,
  toRupees,
} from '../src/money';

describe('money', () => {
  it('converts rupees to paise', () => {
    expect(toPaise(1000)).toBe(1000 * PAISE_PER_RUPEE);
    expect(toPaise(0.5)).toBe(50);
  });

  it('converts paise back to rupees', () => {
    expect(toRupees(100000)).toBe(1000);
  });

  it('rejects non finite rupees', () => {
    expect(() => toPaise(Number.NaN)).toThrow();
    expect(() => toPaise(Number.POSITIVE_INFINITY)).toThrow();
  });

  it('formats whole rupee paise without decimals', () => {
    expect(formatPaise(10000000)).toContain('1,00,000');
  });

  it('formats paise with two decimals when needed', () => {
    expect(formatPaise(100050)).toMatch(/1,000\.50/);
  });

  it('asserts non negative integer paise', () => {
    expect(() => assertPaise(-1)).toThrow();
    expect(() => assertPaise(1.5)).toThrow();
    expect(() => assertPaise(0)).not.toThrow();
  });

  it('clamps values', () => {
    expect(clampPaise(150, 0, 100)).toBe(100);
    expect(clampPaise(-5, 0, 100)).toBe(0);
  });

  it('sums paise', () => {
    expect(sumPaise([100, 200, 300])).toBe(600);
  });

  it('parses user typed rupee strings', () => {
    expect(parseRupeesToPaise('1,00,000')).toBe(10000000);
    expect(parseRupeesToPaise('₹25000')).toBe(2500000);
    expect(parseRupeesToPaise('2500.50')).toBe(250050);
    expect(parseRupeesToPaise('')).toBeNull();
    expect(parseRupeesToPaise('abc')).toBeNull();
    expect(parseRupeesToPaise('-100')).toBeNull();
    expect(parseRupeesToPaise('12.345')).toBeNull();
  });
});
