import { assertPaise } from './money';

/**
 * Deposit statement computation.
 *
 * Only DAMAGE findings can carry a deduction. Wear and tear, pre existing
 * defects and uncertain findings are always zero. Deductions never exceed the
 * deposit; any excess is reported as a shortfall rather than a negative
 * refund.
 */

export interface DepositFindingInput {
  classification: 'WEAR_AND_TEAR' | 'DAMAGE' | 'PRE_EXISTING' | 'UNCERTAIN';
  recommendedDeductionPaise: number;
}

export interface DepositStatementTotals {
  depositPaise: number;
  claimedPaise: number;
  approvedDeductionPaise: number;
  protectedPaise: number;
  refundPaise: number;
  shortfallPaise: number;
  findingCount: number;
  damageCount: number;
}

export function effectiveDeductionPaise(finding: DepositFindingInput): number {
  if (finding.classification !== 'DAMAGE') {
    return 0;
  }
  if (
    !Number.isInteger(finding.recommendedDeductionPaise) ||
    finding.recommendedDeductionPaise < 0
  ) {
    return 0;
  }
  return finding.recommendedDeductionPaise;
}

export function computeDepositStatement(input: {
  depositPaise: number;
  claimedPaise: number;
  findings: DepositFindingInput[];
}): DepositStatementTotals {
  const { depositPaise, claimedPaise, findings } = input;
  assertPaise(depositPaise, 'depositPaise');
  assertPaise(claimedPaise, 'claimedPaise');

  let approvedDeductionPaise = 0;
  let damageCount = 0;
  for (const finding of findings) {
    const deduction = effectiveDeductionPaise(finding);
    approvedDeductionPaise += deduction;
    if (finding.classification === 'DAMAGE') {
      damageCount += 1;
    }
  }

  const protectedPaise = Math.max(0, claimedPaise - approvedDeductionPaise);
  const refundPaise = Math.max(0, depositPaise - approvedDeductionPaise);
  const shortfallPaise = Math.max(0, approvedDeductionPaise - depositPaise);

  return {
    depositPaise,
    claimedPaise,
    approvedDeductionPaise,
    protectedPaise,
    refundPaise,
    shortfallPaise,
    findingCount: findings.length,
    damageCount,
  };
}
