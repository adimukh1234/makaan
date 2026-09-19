import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: z.string().default('var/makaan.db'),
  EVIDENCE_DIR: z.string().default('var/evidence'),
  EVIDENCE_STORE: z.enum(['local', 's3']).default('local'),
  SESSION_SECRET: z.string().min(16).default('dev-only-change-me-2f8c1a5d9e3b7c4a'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  MAKAAN_AI_MODE: z.enum(['deterministic', 'bedrock']).default('deterministic'),
  BEDROCK_REGION: z.string().default('ap-south-1'),
  BEDROCK_MODEL_ID: z.string().default('amazon.nova-lite-v1:0'),
  AUDIT_QUOTA_PER_TENANCY: z.coerce.number().int().min(1).max(500).default(20),
  S3_BUCKET: z.string().default(''),
  AWS_REGION: z.string().default('ap-south-1'),
});

export type Config = z.infer<typeof envSchema> & {
  corsOrigins: string[];
  sessionTtlMs: number;
  isProduction: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `Invalid configuration: ${issue?.path.join('.') ?? 'env'} ${issue?.message ?? ''}`,
    );
  }
  const value = parsed.data;

  if (value.NODE_ENV === 'production') {
    if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
      throw new Error('SESSION_SECRET must be set to at least 32 characters in production');
    }
    if (value.EVIDENCE_STORE === 's3' && value.S3_BUCKET === '') {
      throw new Error('S3_BUCKET is required when EVIDENCE_STORE is s3');
    }
  }

  return {
    ...value,
    corsOrigins: value.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    sessionTtlMs: value.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    isProduction: value.NODE_ENV === 'production',
  };
}
