import type { Config } from '../config';
import { LocalEvidenceStore } from './local';
import { S3EvidenceStore } from './s3';
import type { EvidenceStore } from './types';

export function createEvidenceStore(config: Config): EvidenceStore {
  if (config.EVIDENCE_STORE === 's3') {
    return new S3EvidenceStore(config.S3_BUCKET, config.AWS_REGION);
  }
  return new LocalEvidenceStore(config.EVIDENCE_DIR);
}
