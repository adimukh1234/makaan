import { loadConfig } from './config';
import { openDatabase } from './db';
import { SqliteStore } from './db/store';
import { createEvidenceStore } from './storage/factory';
import { createAuditEngine } from './ai/factory';
import { buildApp } from './app';
import type { EvidenceResolver } from './ai/bedrock';

async function main(): Promise<void> {
  const config = loadConfig();
  const database = openDatabase(config.DATABASE_URL);
  const store = new SqliteStore(database);
  const evidence = createEvidenceStore(config);

  const resolveEvidence: EvidenceResolver = async (evidenceId) => {
    const asset = await store.getEvidenceById(evidenceId);
    if (!asset) return null;
    const object = await evidence.get(asset.storageKey);
    if (!object) return null;
    return { data: object.data, mime: asset.mime };
  };

  const auditEngine = createAuditEngine(config, resolveEvidence, {
    warn: (message, meta) => console.warn(message, meta),
  });

  const app = await buildApp({ config, store, evidence, auditEngine, resolveEvidence });
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  app.log.info(
    { port: config.PORT, ai: config.MAKAAN_AI_MODE, evidence: config.EVIDENCE_STORE },
    'Makaan API ready',
  );
}

main().catch((error) => {
  console.error('Failed to start Makaan API', error);
  process.exit(1);
});
