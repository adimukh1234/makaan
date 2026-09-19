import { describe, expect, it } from 'vitest';
import { createDeterministicEngine, matchBenchmarkKeys } from '../src/fallback';
import { reviewRequired } from '../src/audit';

const engine = createDeterministicEngine({ benchmarkVersion: 'test' });

function first<T>(items: T[]): T {
  const value = items[0];
  if (value === undefined) {
    throw new Error('expected at least one item');
  }
  return value;
}

describe('deterministic engine', () => {
  it('treats ordinary wall condition as protected wear and tear', async () => {
    const result = await engine.analyze({
      tenancyId: 'ten_test',
      stateCode: 'KA',
      city: 'bengaluru',
      depositPaise: 10000000,
      claimedPaise: 2500000,
      areas: [{ area: 'Living room walls and skirting' }],
    });
    const finding = first(result.findings);
    expect(finding.classification).toBe('WEAR_AND_TEAR');
    expect(finding.recommendedDeductionPaise).toBe(0);
    expect(result.engine).toBe('deterministic');
  });

  it('prices a broken exhaust fan inside the benchmark range and flags it', async () => {
    const result = await engine.analyze({
      tenancyId: 'ten_test',
      stateCode: 'KA',
      city: 'bengaluru',
      depositPaise: 10000000,
      claimedPaise: 1000000,
      areas: [{ area: 'Master bathroom exhaust fan' }],
    });
    const finding = first(result.findings);
    expect(finding.classification).toBe('DAMAGE');
    expect(finding.recommendedDeductionPaise).toBeGreaterThanOrEqual(finding.benchmarkLowPaise);
    expect(finding.recommendedDeductionPaise).toBeLessThanOrEqual(finding.benchmarkHighPaise);
    expect(reviewRequired(finding)).toBe(true);
  });

  it('returns an uncertain finding for an unrecognized area', async () => {
    const result = await engine.analyze({
      tenancyId: 'ten_test',
      stateCode: 'KA',
      city: 'bengaluru',
      depositPaise: 10000000,
      claimedPaise: 0,
      areas: [{ area: 'Zorbium flux capacitor' }],
    });
    const finding = first(result.findings);
    expect(finding.classification).toBe('UNCERTAIN');
    expect(finding.recommendedDeductionPaise).toBe(0);
  });

  it('uses the category hint when the area label is vague', async () => {
    const result = await engine.analyze({
      tenancyId: 'ten_test',
      stateCode: 'KA',
      city: 'bengaluru',
      depositPaise: 10000000,
      claimedPaise: 0,
      areas: [{ area: 'Bathroom', categoryHint: 'exhaust fan' }],
    });
    expect(first(result.findings).classification).toBe('DAMAGE');
  });

  it('always returns at least one finding', async () => {
    const result = await engine.analyze({
      tenancyId: 'ten_test',
      stateCode: 'KA',
      city: 'bengaluru',
      depositPaise: 0,
      claimedPaise: 0,
      areas: [],
    });
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('gives damage keywords precedence over generic wear keywords', () => {
    const keys = matchBenchmarkKeys('crack in wall');
    expect(keys).toContain('wall_dent_hole_large');
    expect(keys).not.toContain('minor_wall_scuff');
  });
});
