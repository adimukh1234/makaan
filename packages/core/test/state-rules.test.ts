import { describe, expect, it } from 'vitest';
import {
  depositCapWarning,
  getStateRule,
  isKnownState,
  listStates,
  statutoryNoteForState,
} from '../src/state-rules';

describe('state rules', () => {
  it('caps deposits in Model Tenancy Act states', () => {
    for (const code of ['TN', 'AP', 'UP', 'AS']) {
      const rule = getStateRule(code);
      expect(rule.regime).toBe('MTA');
      expect(rule.depositCapMonthsResidential).toBe(2);
    }
  });

  it('does not cap deposits in legacy states', () => {
    expect(getStateRule('KA').depositCapMonthsResidential).toBeNull();
    expect(getStateRule('MH').depositCapMonthsResidential).toBeNull();
  });

  it('returns a legacy fallback for an unknown code', () => {
    const rule = getStateRule('zz');
    expect(rule.regime).toBe('LEGACY_RENT_CONTROL');
    expect(rule.depositCapMonthsResidential).toBeNull();
  });

  it('knows the curated state list', () => {
    expect(isKnownState('KA')).toBe(true);
    expect(isKnownState('DL')).toBe(true);
    expect(isKnownState('ZZ')).toBe(false);
    expect(listStates().length).toBeGreaterThan(10);
  });

  it('warns when a deposit exceeds the cap in an adopting state', () => {
    const rent = 3000000;
    const overCap = rent * 3;
    const warning = depositCapWarning('TN', rent, overCap);
    expect(warning).toContain('Tamil Nadu');
    expect(depositCapWarning('TN', rent, rent * 2)).toBeNull();
    expect(depositCapWarning('KA', rent, rent * 10)).toBeNull();
  });

  it('produces advisory notes for both regimes', () => {
    expect(statutoryNoteForState('UP')).toMatch(/advisory/i);
    expect(statutoryNoteForState('KA')).toMatch(/advisory/i);
  });
});
