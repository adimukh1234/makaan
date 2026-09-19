import type { AuditEngine } from '@makaan/core';
import type { Config } from './config';
import type { Store } from './db/store';
import type { EvidenceStore } from './storage/types';
import type { EvidenceResolver } from './ai/bedrock';

export interface Deps {
  store: Store;
  config: Config;
  evidence: EvidenceStore;
  auditEngine: AuditEngine;
  resolveEvidence: EvidenceResolver;
}
