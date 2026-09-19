import { describe, expect, it } from 'vitest';
import {
  auditResultSchema,
  deriveSeverity,
  normalizeFinding,
  reviewRequired,
  validateAuditResult,
  type FindingDraft,
} from '../src/audit';

function draft(overrides: Partial<FindingDraft> = {}): FindingDraft {
  return {
    area: 'Living room wall',
    category: 'floor_tile_cracked',
    classification: 'DAMAGE',
    severity: 'moderate',
    benchmarkLowPaise: 100000,
    benchmarkHighPaise: 200000,
    recommendedDeductionPaise: 150000,
    confidence: 0.9,
    rationale: 'A cracked tile is visible in the exit photo.',
    statutoryNote: '',
    ...overrides,
  };
}

describe('audit contract', () => {
  it('zeroes deductions for non damage classifications', () => {
    const result = normalizeFinding(
      draft({
        classification: 'WEAR_AND_TEAR',
        recommendedDeductionPaise: 900000,
        severity: 'major',
      }),
    );
    expect(result.recommendedDeductionPaise).toBe(0);
    expect(result.severity).toBe('none');
    expect(result.benchmarkHighPaise).toBe(0);
  });

  it('clamps a damage deduction into the benchmark range', () => {
    const tooHigh = normalizeFinding(draft({ recommendedDeductionPaise: 999999 }));
    expect(tooHigh.recommendedDeductionPaise).toBe(200000);
    const tooLow = normalizeFinding(draft({ recommendedDeductionPaise: 1 }));
    expect(tooLow.recommendedDeductionPaise).toBe(100000);
  });

  it('derives severity from the deduction', () => {
    expect(deriveSeverity(0)).toBe('none');
    expect(deriveSeverity(50000)).toBe('minor');
    expect(deriveSeverity(150000)).toBe('moderate');
    expect(deriveSeverity(400000)).toBe('major');
  });

  it('flags uncertain and low confidence findings for review', () => {
    expect(
      reviewRequired(draft({ classification: 'UNCERTAIN', recommendedDeductionPaise: 0 })),
    ).toBe(true);
    expect(reviewRequired(draft({ confidence: 0.5 }))).toBe(true);
    expect(reviewRequired(draft({ recommendedDeductionPaise: 3000000 }))).toBe(true);
    expect(reviewRequired(draft({ confidence: 0.95, recommendedDeductionPaise: 150000 }))).toBe(
      false,
    );
    expect(reviewRequired(draft({ classification: 'WEAR_AND_TEAR' }))).toBe(false);
  });

  it('validates well formed audit output', () => {
    const outcome = validateAuditResult({ findings: [draft()] });
    expect(outcome.ok).toBe(true);
  });

  it('rejects malformed audit output', () => {
    const missing = validateAuditResult({ findings: [] });
    expect(missing.ok).toBe(false);

    const wrongTypes = validateAuditResult({
      findings: [{ ...draft(), confidence: 'high' }],
    });
    expect(wrongTypes.ok).toBe(false);

    const extraKeys = validateAuditResult({ findings: [{ ...draft(), extra: true }] });
    expect(extraKeys.ok).toBe(false);
  });

  it('exposes a strict schema', () => {
    expect(auditResultSchema.safeParse({ findings: 'nope' }).success).toBe(false);
  });
});
