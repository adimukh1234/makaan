import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type ImageFormat,
} from '@aws-sdk/client-bedrock-runtime';
import {
  ADVISORY_DISCLAIMER,
  normalizeFinding,
  validateAuditResult,
  type AuditEngine,
  type AuditInput,
  type AuditResult,
  type FindingDraft,
} from '@makaan/core';

export type EvidenceResolver = (
  evidenceId: string,
) => Promise<{ data: Buffer; mime: string } | null>;

export interface BedrockEngineOptions {
  region: string;
  modelId: string;
  resolveEvidence: EvidenceResolver;
  fallback: AuditEngine;
  logger?: { warn: (message: string, meta?: unknown) => void };
}

const SYSTEM_PROMPT = `You are an advisory rental condition assessor for India.
You compare a move-in photograph and a move-out photograph of a named area and report only material changes.
Rules:
- "WEAR_AND_TEAR" and "PRE_EXISTING" are never deductible and must carry recommendedDeductionPaise 0.
- "DAMAGE" may carry a deduction inside the provided benchmark range only.
- "UNCERTAIN" means the photos are unclear. Use it instead of guessing.
- Normal painting, fading, scuffs, nail holes and floor finish wear are WEAR_AND_TEAR.
- You are not a court, an arbitrator, or the Rent Authority. Your output is an advisory opinion.
Return one JSON object and nothing else, with this exact shape:
{"findings":[{"area":string,"category":string,"classification":"WEAR_AND_TEAR"|"DAMAGE"|"PRE_EXISTING"|"UNCERTAIN","severity":"none"|"minor"|"moderate"|"major","benchmarkLowPaise":number,"benchmarkHighPaise":number,"recommendedDeductionPaise":number,"confidence":number,"rationale":string,"statutoryNote":string,"followUpQuestion":string?}]}
${ADVISORY_DISCLAIMER}`;

function imageFormat(mime: string): ImageFormat | null {
  switch (mime) {
    case 'image/jpeg':
      return 'jpeg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return null;
  }
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model returned no JSON object');
  }
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Amazon Bedrock Nova Lite adapter. It fetches the referenced evidence, asks
 * the model for strict JSON, validates it, and falls back to the deterministic
 * engine on any failure.
 */
export function createBedrockEngine(options: BedrockEngineOptions): AuditEngine {
  const client = new BedrockRuntimeClient({ region: options.region });

  return {
    name: 'bedrock',
    async analyze(input: AuditInput): Promise<AuditResult> {
      const started = Date.now();
      try {
        const content: ContentBlock[] = [
          {
            text: `City: ${input.city}. State regime reference: ${input.stateCode}. Deposit: ${input.depositPaise} paise. Landlord claim: ${input.claimedPaise} paise.`,
          },
        ];

        for (const area of input.areas) {
          const parts = [area.area, area.categoryHint ?? ''].filter(Boolean).join(' / ');
          content.push({ text: `Area under inspection: ${parts}` });
          for (const ref of [area.moveInRef, area.moveOutRef]) {
            if (!ref) continue;
            const asset = await options.resolveEvidence(ref);
            if (!asset) continue;
            const format = imageFormat(asset.mime);
            if (!format) continue;
            content.push({
              text: ref === area.moveInRef ? 'Move-in photograph:' : 'Move-out photograph:',
            });
            content.push({
              image: { format, source: { bytes: new Uint8Array(asset.data) } },
            });
          }
        }

        content.push({
          text: 'Return the JSON object now for each area listed above.',
        });

        const response = await client.send(
          new ConverseCommand({
            modelId: options.modelId,
            system: [{ text: SYSTEM_PROMPT }],
            messages: [{ role: 'user', content }],
            inferenceConfig: { maxTokens: 2500, temperature: 0.1 },
          }),
        );

        const blocks = response.output?.message?.content ?? [];
        const text = blocks
          .map((block) => ('text' in block && typeof block.text === 'string' ? block.text : ''))
          .join('\n')
          .trim();
        const parsed = extractJson(text);
        const validation = validateAuditResult(parsed);
        if (!validation.ok) {
          throw new Error(validation.error);
        }
        const findings: FindingDraft[] = validation.result.findings.map(normalizeFinding);
        return {
          findings,
          engine: 'bedrock',
          modelId: options.modelId,
          latencyMs: Date.now() - started,
        };
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown Bedrock failure';
        options.logger?.warn('Bedrock audit failed, using deterministic fallback', { reason });
        const result = await options.fallback.analyze(input);
        return { ...result, latencyMs: Date.now() - started, fallbackReason: reason };
      }
    },
  };
}
