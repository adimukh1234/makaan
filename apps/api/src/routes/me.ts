import type { FastifyInstance } from 'fastify';
import { consentUpdateSchema } from '@makaan/core';
import type { Deps } from '../deps';
import { parseOrThrow } from '../lib/http';
import { requireUser } from './helpers';

export function registerMeRoutes(app: FastifyInstance, deps: Deps): void {
  app.get('/api/me/consents', { preHandler: [app.authenticate] }, async (request) => {
    const user = requireUser(request);
    const consents = await deps.store.listConsents(user.id);
    return { consents };
  });

  app.post(
    '/api/me/consents',
    { preHandler: [app.authenticate, app.verifyCsrf] },
    async (request) => {
      const user = requireUser(request);
      const input = parseOrThrow(consentUpdateSchema, request.body);
      const consent = await deps.store.upsertConsent(user.id, input.purpose, input.granted);
      await deps.store.appendAudit({
        actorId: user.id,
        tenancyId: null,
        action: 'consent.updated',
        metadata: { purpose: input.purpose, granted: input.granted },
      });
      return { consent };
    },
  );

  app.get('/api/me/export', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = requireUser(request);
    const data = await deps.store.exportUserData(user.id);
    reply.header('content-disposition', 'attachment; filename="makaan-export.json"');
    return data;
  });
}
