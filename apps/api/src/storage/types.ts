export interface StoredObject {
  data: Buffer;
  contentType: string;
}

/**
 * Evidence storage boundary. Two implementations exist: a local filesystem
 * store for development and tests, and an S3 store for AWS. Routes depend only
 * on this interface.
 */
export interface EvidenceStore {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  remove(key: string): Promise<void>;
}

export const ALLOWED_EVIDENCE_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

export type AllowedEvidenceMime = (typeof ALLOWED_EVIDENCE_MIME)[number];
