import { describe, expect, it } from 'vitest';
import {
  classificationLabel,
  formatDate,
  formatPaise,
  shortHash,
  titleCase,
} from '../src/lib/format';

describe('format helpers', () => {
  it('formats paise as Indian rupees', () => {
    expect(formatPaise(10000000)).toContain('1,00,000');
    expect(formatPaise(125000)).toContain('1,250');
  });

  it('labels classifications for people', () => {
    expect(classificationLabel('WEAR_AND_TEAR')).toBe('Wear and tear');
    expect(classificationLabel('DAMAGE')).toBe('Damage');
    expect(classificationLabel('UNCERTAIN')).toBe('Needs review');
  });

  it('formats dates and unknown dates safely', () => {
    expect(formatDate('2026-01-01')).toMatch(/2026/);
    expect(formatDate(null)).toBe('Not set');
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('title cases enum values', () => {
    expect(titleCase('hostel_pg')).toBe('Hostel Pg');
  });

  it('shortens hashes', () => {
    expect(shortHash('abcdef1234567890', 6)).toBe('abcdef');
  });
});
