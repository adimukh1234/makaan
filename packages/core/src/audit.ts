import { z } from 'zod';
import type { Classification, EngineName, Severity } from './types';

/** Audit input and output contract. This is the boundary between the API and
 * any engine, and the shape the model must return. */

export const classificationSchema = z.enum([
  'WEAR_AND_TEAR',
  'DAMAGE',
  'PRE_EXISTING',
  'UNCERTAIN',
]);
export const severitySchema = z.enum(['none', 'minor', 'moderate', 'major']);

export const findingDraftSchema = z
  .object({
    area: z.string().trim().min(1).max(160),
    category: z.string().trim().min(1).max(80),
    classification: classificationSchema,
    severity: severitySchema,
    benchmarkLowPaise: z.number().int().min(0).max(100_000_000),
    benchmarkHighPaise: z.number().int().min(0).max(100_000_000),
    recommendedDeductionPaise: z.number().int().min(0).max(100_000_000),
    confidence: z.number().min(0).max(1),
    rationale: z.string().trim().min(1).max(1200),
    statutoryNote: z.string().trim().max(1200).default(''),
    followUpQuestion: z.string().trim().max(400).optional(),
  })
  .strict();

export type FindingDraft = z.infer<typeof findingDraftSchema>;

export const auditResultSchema = z
  .object({
    findings: z.array(findingDraftSchema).min(1).max(50),
  })
  .strict();

export type AuditResultPayload = z.infer<typeof auditResultSchema>;

export interface AuditAreaInput {
  area: string;
  categoryHint?: string;
  moveInRef?: string;
  moveOutRef?: string;
}

export interface AuditInput {
  tenancyId: string;
  stateCode: string;
  city: string;
  depositPaise: number;
  claimedPaise: number;
  areas: AuditAreaInput[];
}

export interface AuditResult {
  findings: FindingDraft[];
  engine: EngineName;
  modelId?: string;
  latencyMs: number;
  fallbackReason?: string;
}

export interface AuditEngine {
  readonly name: EngineName;
  analyze(input: AuditInput): Promise<AuditResult>;
}

export const HIGH_VALUE_REVIEW_PAISE = 2_500_000;
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

export function deriveSeverity(deductionPaise: number): Severity {
  if (deductionPaise <= 0) return 'none';
  if (deductionPaise < 100_000) return 'minor';
  if (deductionPaise < 300_000) return 'moderate';
  return 'major';
}

/**
 * Normalizes a finding so the domain invariants always hold:
 * non damage findings carry zero deduction, damage deductions sit inside the
 * benchmark range, and severity matches the deduction.
 */
export function normalizeFinding(finding: FindingDraft): FindingDraft {
  const low = Math.min(finding.benchmarkLowPaise, finding.benchmarkHighPaise);
  const high = Math.max(finding.benchmarkLowPaise, finding.benchmarkHighPaise);

  if (finding.classification !== 'DAMAGE') {
    return {
      ...finding,
      benchmarkLowPaise: 0,
      benchmarkHighPaise: 0,
      recommendedDeductionPaise: 0,
      severity: 'none',
    };
  }

  const deduction = Math.min(Math.max(finding.recommendedDeductionPaise, low), high);
  return {
    ...finding,
    benchmarkLowPaise: low,
    benchmarkHighPaise: high,
    recommendedDeductionPaise: deduction,
    severity: deriveSeverity(deduction),
  };
}

export function reviewRequired(finding: FindingDraft): boolean {
  if (finding.classification === 'UNCERTAIN') return true;
  if (finding.classification !== 'DAMAGE') return false;
  return (
    finding.confidence < LOW_CONFIDENCE_THRESHOLD ||
    finding.recommendedDeductionPaise > HIGH_VALUE_REVIEW_PAISE
  );
}

export type ValidationOutcome =
  { ok: true; result: AuditResultPayload } | { ok: false; error: string };

export function validateAuditResult(value: unknown): ValidationOutcome {
  const parsed = auditResultSchema.safeParse(value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join('.') ?? 'result';
    return { ok: false, error: `Invalid audit result at ${path}: ${first?.message ?? 'unknown'}` };
  }
  return { ok: true, result: parsed.data };
}
