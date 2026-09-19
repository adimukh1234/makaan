import type { FastifyInstance } from 'fastify';
import type { Deps } from '../deps';

export function registerHealthRoutes(app: FastifyInstance, deps: Deps): void {
  app.get('/api/health', async () => ({
    ok: true,
    service: 'makaan-api',
    ai: deps.config.MAKAAN_AI_MODE,
    evidence: deps.config.EVIDENCE_STORE,
    time: new Date().toISOString(),
  }));
}
