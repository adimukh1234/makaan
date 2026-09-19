import { createDeterministicEngine, type AuditEngine } from '@makaan/core';
import type { Config } from '../config';
import { createBedrockEngine, type EvidenceResolver } from './bedrock';

/**
 * Chooses the audit engine. The deterministic engine is always constructed as
 * the fallback, so the product never depends on the model for correctness.
 */
export function createAuditEngine(
  config: Config,
  resolveEvidence: EvidenceResolver,
  logger?: { warn: (message: string, meta?: unknown) => void },
): AuditEngine {
  const fallback = createDeterministicEngine();
  if (config.MAKAAN_AI_MODE === 'bedrock') {
    return createBedrockEngine({
      region: config.BEDROCK_REGION,
      modelId: config.BEDROCK_MODEL_ID,
      resolveEvidence,
      fallback,
      logger,
    });
  }
  return fallback;
}
