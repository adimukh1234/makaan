import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDeterministicEngine, type AuditEngine } from '@makaan/core';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { loadConfig, type Config } from '../src/config';
import { openDatabase } from '../src/db';
import { SqliteStore, type Store } from '../src/db/store';
import { LocalEvidenceStore } from '../src/storage/local';
import type { EvidenceResolver } from '../src/ai/bedrock';

export interface TestContext {
  app: FastifyInstance;
  store: Store;
  config: Config;
  evidence: LocalEvidenceStore;
}

export async function createTestContext(
  overrides: Partial<NodeJS.ProcessEnv> = {},
): Promise<TestContext> {
  const dir = mkdtempSync(join(tmpdir(), 'makaan-test-'));
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: ':memory:',
    EVIDENCE_DIR: dir,
    SESSION_SECRET: 'test-secret-1234567890',
    MAKAAN_AI_MODE: 'deterministic',
    CORS_ORIGINS: 'http://localhost:5173',
    LOG_LEVEL: 'silent',
    ...overrides,
  } as NodeJS.ProcessEnv);

  const database = openDatabase(':memory:');
  const store = new SqliteStore(database);
  const evidence = new LocalEvidenceStore(config.EVIDENCE_DIR);
  const resolveEvidence: EvidenceResolver = async (evidenceId) => {
    const asset = await store.getEvidenceById(evidenceId);
    if (!asset) return null;
    const object = await evidence.get(asset.storageKey);
    return object ? { data: object.data, mime: asset.mime } : null;
  };
  const auditEngine: AuditEngine = createDeterministicEngine();
  const app = await buildApp({ config, store, evidence, auditEngine, resolveEvidence });
  await app.ready();
  return { app, store, config, evidence };
}

export interface Client {
  cookie: string | null;
  csrf: string | null;
  userId: string | null;
}

export function newClient(): Client {
  return { cookie: null, csrf: null, userId: null };
}

function readSetCookie(header: string | string[] | undefined): string | null {
  if (!header) return null;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return null;
  return value.split(';')[0] ?? null;
}

export async function request(
  ctx: TestContext,
  client: Client,
  options: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    url: string;
    payload?: unknown;
    headers?: Record<string, string>;
    rawPayload?: Buffer;
  },
): Promise<{ status: number; body: any; headers: Record<string, unknown> }> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (client.cookie) headers.cookie = client.cookie;
  if (client.csrf && options.method !== 'GET') headers['x-csrf-token'] = client.csrf;

  const response = (await ctx.app.inject({
    method: options.method,
    url: options.url,
    headers,
    payload: (options.rawPayload ?? options.payload) as string | object | Buffer | undefined,
  })) as unknown as {
    statusCode: number;
    body: string;
    headers: Record<string, string | string[] | undefined>;
  };

  const setCookie = readSetCookie(response.headers['set-cookie']);
  if (setCookie) client.cookie = setCookie;

  let body: any = null;
  if (response.body) {
    try {
      body = JSON.parse(response.body);
    } catch {
      body = response.body;
    }
  }
  return {
    status: response.statusCode,
    body,
    headers: response.headers as Record<string, unknown>,
  };
}

export async function register(
  ctx: TestContext,
  client: Client,
  input: { email: string; name: string; role: 'tenant' | 'landlord'; password?: string },
): Promise<{ status: number; body: any }> {
  const result = await request(ctx, client, {
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: input.email,
      name: input.name,
      role: input.role,
      password: input.password ?? 'correct-horse-battery',
      consent: { service: true, evidence_retention: true, ai_processing: true },
    },
  });
  if (result.body?.csrfToken) client.csrf = result.body.csrfToken;
  if (result.body?.user?.id) client.userId = result.body.user.id;
  return result;
}

export async function login(
  ctx: TestContext,
  client: Client,
  email: string,
  password: string,
): Promise<{ status: number; body: any }> {
  const result = await request(ctx, client, {
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });
  if (result.body?.csrfToken) client.csrf = result.body.csrfToken;
  if (result.body?.user?.id) client.userId = result.body.user.id;
  return result;
}
