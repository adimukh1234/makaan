import { describe, expect, it } from 'vitest';
import { computeDepositStatement, effectiveDeductionPaise } from '../src/deposit';

describe('deposit statement', () => {
  it('never deducts for wear and tear', () => {
    const totals = computeDepositStatement({
      depositPaise: 10000000,
      claimedPaise: 2500000,
      findings: [
        { classification: 'WEAR_AND_TEAR', recommendedDeductionPaise: 0 },
        { classification: 'PRE_EXISTING', recommendedDeductionPaise: 0 },
      ],
    });
    expect(totals.approvedDeductionPaise).toBe(0);
    expect(totals.protectedPaise).toBe(2500000);
    expect(totals.refundPaise).toBe(10000000);
    expect(totals.shortfallPaise).toBe(0);
  });

  it('ignores a nonzero deduction attached to a non damage finding', () => {
    const totals = computeDepositStatement({
      depositPaise: 10000000,
      claimedPaise: 2500000,
      findings: [{ classification: 'WEAR_AND_TEAR', recommendedDeductionPaise: 500000 }],
    });
    expect(totals.approvedDeductionPaise).toBe(0);
  });

  it('sums approved damage deductions', () => {
    const totals = computeDepositStatement({
      depositPaise: 10000000,
      claimedPaise: 2500000,
      findings: [
        { classification: 'DAMAGE', recommendedDeductionPaise: 180000 },
        { classification: 'DAMAGE', recommendedDeductionPaise: 120000 },
        { classification: 'WEAR_AND_TEAR', recommendedDeductionPaise: 0 },
      ],
    });
    expect(totals.approvedDeductionPaise).toBe(300000);
    expect(totals.refundPaise).toBe(9700000);
    expect(totals.protectedPaise).toBe(2200000);
    expect(totals.damageCount).toBe(2);
    expect(totals.findingCount).toBe(3);
  });

  it('floors protected and refund at zero and reports a shortfall', () => {
    const totals = computeDepositStatement({
      depositPaise: 100000,
      claimedPaise: 50000,
      findings: [{ classification: 'DAMAGE', recommendedDeductionPaise: 400000 }],
    });
    expect(totals.refundPaise).toBe(0);
    expect(totals.protectedPaise).toBe(0);
    expect(totals.shortfallPaise).toBe(300000);
  });

  it('reports effective deduction safely', () => {
    expect(
      effectiveDeductionPaise({ classification: 'DAMAGE', recommendedDeductionPaise: 100 }),
    ).toBe(100);
    expect(
      effectiveDeductionPaise({ classification: 'DAMAGE', recommendedDeductionPaise: -5 }),
    ).toBe(0);
    expect(
      effectiveDeductionPaise({ classification: 'UNCERTAIN', recommendedDeductionPaise: 100 }),
    ).toBe(0);
  });

  it('validates paise inputs', () => {
    expect(() =>
      computeDepositStatement({ depositPaise: 1.5, claimedPaise: 0, findings: [] }),
    ).toThrow();
    expect(() =>
      computeDepositStatement({ depositPaise: 0, claimedPaise: -1, findings: [] }),
    ).toThrow();
  });
});
