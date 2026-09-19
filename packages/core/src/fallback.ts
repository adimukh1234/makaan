import { BENCHMARKS, getBenchmark, type BenchmarkKey } from './benchmarks';
import {
  normalizeFinding,
  reviewRequired,
  type AuditEngine,
  type AuditInput,
  type AuditResult,
  type FindingDraft,
} from './audit';

/**
 * Deterministic audit engine.
 *
 * It reads the area label and an optional category hint, maps them to the
 * benchmark catalogue, and returns conservative findings. It never calls the
 * network, so the product and the demo work with no AI credentials.
 */

const WEAR_CONFIDENCE = 0.78;
const DAMAGE_CONFIDENCE = 0.62;
const UNCERTAIN_CONFIDENCE = 0.35;

const ALL_KEYS = Object.keys(BENCHMARKS) as BenchmarkKey[];

/**
 * Maps free text to benchmark keys. When any damage keyword matches, damage
 * keys take precedence so a broken fixture is never hidden behind a generic
 * wall match.
 */
export function matchBenchmarkKeys(text: string): BenchmarkKey[] {
  const haystack = text.toLowerCase();
  const damageMatches: BenchmarkKey[] = [];
  const wearMatches: BenchmarkKey[] = [];

  for (const key of ALL_KEYS) {
    const item = BENCHMARKS[key];
    const hit = item.keywords.some((keyword) => haystack.includes(keyword));
    if (!hit) continue;
    if (item.classification === 'DAMAGE') {
      damageMatches.push(key);
    } else {
      wearMatches.push(key);
    }
  }

  const chosen = damageMatches.length > 0 ? damageMatches : wearMatches;
  return chosen.slice(0, 2);
}

function draftForArea(
  area: string,
  key: BenchmarkKey,
  city: string,
  statutoryNote: string,
): FindingDraft {
  const item = BENCHMARKS[key];
  const quote = getBenchmark(key, city);
  const isDamage = item.classification === 'DAMAGE';

  return normalizeFinding({
    area,
    category: key,
    classification: isDamage ? 'DAMAGE' : 'WEAR_AND_TEAR',
    severity: 'none',
    benchmarkLowPaise: quote.lowPaise,
    benchmarkHighPaise: quote.highPaise,
    recommendedDeductionPaise: isDamage ? quote.midPaise : 0,
    confidence: isDamage ? DAMAGE_CONFIDENCE : WEAR_CONFIDENCE,
    rationale: isDamage
      ? `${item.label} priced at the ${city} benchmark range. Flagged for review because the deterministic engine did not see the photograph.`
      : `${item.label}. Treated as protected normal wear and tear with no deduction.`,
    statutoryNote,
  });
}

function uncertainDraft(area: string, statutoryNote: string): FindingDraft {
  return normalizeFinding({
    area,
    category: 'unclassified',
    classification: 'UNCERTAIN',
    severity: 'none',
    benchmarkLowPaise: 0,
    benchmarkHighPaise: 0,
    recommendedDeductionPaise: 0,
    confidence: UNCERTAIN_CONFIDENCE,
    rationale:
      'The area label did not match a known category. No deduction is proposed. Add a clearer area label or send it for review.',
    statutoryNote,
    followUpQuestion: 'What was damaged, and can you upload a close up of the change?',
  });
}

export interface DeterministicEngineOptions {
  statutoryNote: string;
  benchmarkVersion: string;
}

export function createDeterministicEngine(options: DeterministicEngineOptions): AuditEngine {
  return {
    name: 'deterministic',
    async analyze(input: AuditInput): Promise<AuditResult> {
      const started = Date.now();
      const findings: FindingDraft[] = [];

      for (const areaInput of input.areas) {
        const text = [areaInput.area, areaInput.categoryHint ?? ''].join(' ');
        const keys = matchBenchmarkKeys(text);
        if (keys.length === 0) {
          findings.push(uncertainDraft(areaInput.area, options.statutoryNote));
          continue;
        }
        for (const key of keys) {
          findings.push(draftForArea(areaInput.area, key, input.city, options.statutoryNote));
        }
      }

      if (findings.length === 0) {
        findings.push(uncertainDraft('Unspecified area', options.statutoryNote));
      }

      return {
        findings,
        engine: 'deterministic',
        latencyMs: Date.now() - started,
      };
    },
  };
}

export function hasReviewRequired(result: AuditResult): boolean {
  return result.findings.some((finding) => reviewRequired(finding));
}
