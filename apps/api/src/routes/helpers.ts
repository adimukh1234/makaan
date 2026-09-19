import type { FastifyRequest } from 'fastify';
import type { SessionUser, Tenancy, TenancyAggregate, Property } from '@makaan/core';
import { failure } from '../lib/errors';
import type { Store } from '../db/store';

export function requireUser(request: FastifyRequest): SessionUser {
  if (!request.sessionUser) {
    throw failure.unauthenticated();
  }
  return request.sessionUser;
}

export const idParamSchema = {
  safeParse(
    value: unknown,
  ):
    | { success: true; data: { id: string } }
    | {
        success: false;
        error: { issues: Array<{ path: Array<string | number>; message: string }> };
      } {
    const maybe = value as { id?: unknown } | null;
    const id = maybe && typeof maybe.id === 'string' ? maybe.id : '';
    if (id.length < 3 || id.length > 80) {
      return {
        success: false,
        error: { issues: [{ path: ['id'], message: 'Invalid identifier' }] },
      };
    }
    return { success: true, data: { id } };
  },
};

export function isMember(tenancy: Tenancy, user: SessionUser): boolean {
  return tenancy.landlordId === user.id || tenancy.tenantId === user.id;
}

/**
 * Loads a tenancy and confirms the caller is the landlord or the tenant.
 * This is the authorization boundary for every nested resource.
 */
export async function loadTenancyForUser(
  store: Store,
  tenancyId: string,
  user: SessionUser,
): Promise<Tenancy> {
  const tenancy = await store.getTenancyById(tenancyId);
  if (!tenancy) {
    throw failure.notFound('Tenancy not found.');
  }
  if (!isMember(tenancy, user)) {
    throw failure.forbidden('You do not have access to this tenancy.');
  }
  return tenancy;
}

export async function buildTenancyAggregate(
  store: Store,
  tenancy: Tenancy,
): Promise<TenancyAggregate> {
  const [property, inspections, evidence, statement, disputes] = await Promise.all([
    store.getPropertyById(tenancy.propertyId),
    store.listInspectionsByTenancy(tenancy.id),
    store.listEvidenceByTenancy(tenancy.id),
    store.getLatestStatement(tenancy.id),
    store.listDisputesByTenancy(tenancy.id),
  ]);
  if (!property) {
    throw failure.notFound('Property not found.');
  }
  const findings = statement
    ? await store.listFindingsByStatement(tenancy.id, statement.version)
    : [];
  return { tenancy, property, inspections, evidence, statement, findings, disputes };
}

export async function assertPropertyReadable(
  store: Store,
  property: Property,
  user: SessionUser,
): Promise<void> {
  if (property.landlordId === user.id) return;
  const tenancies = await store.listTenanciesForUser(user.id);
  const linked = tenancies.some((tenancy) => tenancy.propertyId === property.id);
  if (!linked) {
    throw failure.forbidden('You do not have access to this property.');
  }
}
