import type { FastifyInstance } from 'fastify';
import { createPropertySchema, updatePropertySchema, depositCapWarning } from '@makaan/core';
import type { Deps } from '../deps';
import { parseOrThrow } from '../lib/http';
import { failure } from '../lib/errors';
import { assertPropertyReadable, idParamSchema, requireUser } from './helpers';

export function registerPropertyRoutes(app: FastifyInstance, deps: Deps): void {
  app.get('/api/properties', { preHandler: [app.authenticate] }, async (request) => {
    const user = requireUser(request);
    const properties =
      user.role === 'landlord'
        ? await deps.store.listPropertiesByLandlord(user.id)
        : await deps.store.listPropertiesForTenant(user.id);
    return { properties };
  });

  app.post(
    '/api/properties',
    { preHandler: [app.authenticate, app.verifyCsrf] },
    async (request, reply) => {
      const user = requireUser(request);
      if (user.role !== 'landlord') {
        throw failure.forbidden('Only landlords can create properties.');
      }
      const input = parseOrThrow(createPropertySchema, request.body);
      const property = await deps.store.createProperty({ landlordId: user.id, ...input });
      await deps.store.appendAudit({
        actorId: user.id,
        tenancyId: null,
        action: 'property.created',
        metadata: { propertyId: property.id },
      });
      const warning = depositCapWarning(
        property.stateCode,
        property.monthlyRentPaise,
        property.defaultDepositPaise,
      );
      return reply.status(201).send({ property, warning });
    },
  );

  app.get('/api/properties/:id', { preHandler: [app.authenticate] }, async (request) => {
    const user = requireUser(request);
    const { id } = parseOrThrow(idParamSchema, request.params);
    const property = await deps.store.getPropertyById(id);
    if (!property) throw failure.notFound('Property not found.');
    await assertPropertyReadable(deps.store, property, user);
    const warning = depositCapWarning(
      property.stateCode,
      property.monthlyRentPaise,
      property.defaultDepositPaise,
    );
    return { property, warning };
  });

  app.patch(
    '/api/properties/:id',
    { preHandler: [app.authenticate, app.verifyCsrf] },
    async (request) => {
      const user = requireUser(request);
      const { id } = parseOrThrow(idParamSchema, request.params);
      const property = await deps.store.getPropertyById(id);
      if (!property) throw failure.notFound('Property not found.');
      if (property.landlordId !== user.id) throw failure.forbidden();
      const patch = parseOrThrow(updatePropertySchema, request.body);
      const updated = await deps.store.updateProperty(id, patch);
      await deps.store.appendAudit({
        actorId: user.id,
        tenancyId: null,
        action: 'property.updated',
        metadata: { propertyId: id },
      });
      return { property: updated };
    },
  );

  app.delete(
    '/api/properties/:id',
    { preHandler: [app.authenticate, app.verifyCsrf] },
    async (request) => {
      const user = requireUser(request);
      const { id } = parseOrThrow(idParamSchema, request.params);
      const property = await deps.store.getPropertyById(id);
      if (!property) throw failure.notFound('Property not found.');
      if (property.landlordId !== user.id) throw failure.forbidden();
      try {
        await deps.store.deleteProperty(id);
      } catch {
        throw failure.conflict('This property has tenancies and cannot be deleted.');
      }
      await deps.store.appendAudit({
        actorId: user.id,
        tenancyId: null,
        action: 'property.deleted',
        metadata: { propertyId: id },
      });
      return { ok: true };
    },
  );
}
