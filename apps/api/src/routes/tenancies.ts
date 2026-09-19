import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import {
  computeDepositStatement,
  createInspectionSchema,
  createTenancySchema,
  openDisputeSchema,
  resolveDisputeSchema,
  reviewRequired,
  type AuditFinding,
  type EvidenceAsset,
} from '@makaan/core';
import type { Deps } from '../deps';
import { parseOrThrow } from '../lib/http';
import { failure } from '../lib/errors';
import { detectImageMime, extensionForMime } from '../lib/mime';
import { sha256Hex } from '../auth/passwords';
import { buildTenancyAggregate, idParamSchema, loadTenancyForUser, requireUser } from './helpers';

const auditSchema = z
  .object({ claimedPaise: z.number().int().min(0).max(100_000_000_000).optional() })
  .strict();
const evidenceQuerySchema = z.object({ inspectionId: z.string().min(3).max(80) }).strict();

const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

function publicEvidence(asset: EvidenceAsset) {
  const { storageKey: _storageKey, ...rest } = asset;
  void _storageKey;
  return rest;
}

export function registerTenancyRoutes(app: FastifyInstance, deps: Deps): void {
  app.get('/api/tenancies', { preHandler: [app.authenticate] }, async (request) => {
    const user = requireUser(request);
    const tenancies = await deps.store.listTenanciesForUser(user.id);
    return { tenancies };
  });

  app.post(
    '/api/tenancies',
    { preHandler: [app.authenticate, app.verifyCsrf] },
    async (request, reply) => {
      const user = requireUser(request);
      if (user.role !== 'landlord') {
        throw failure.forbidden('Only landlords can invite a tenant.');
      }
      const input = parseOrThrow(createTenancySchema, request.body);
      const property = await deps.store.getPropertyById(input.propertyId);
      if (!property) throw failure.notFound('Property not found.');
      if (property.landlordId !== user.id) throw failure.forbidden();

      try {
        const tenancy = await deps.store.createTenancy({
          propertyId: property.id,
          landlordId: user.id,
          tenantEmail: input.tenantEmail,
          startDate: input.startDate,
          endDate: input.endDate ?? null,
          depositPaise: input.depositPaise,
          monthlyRentPaise: input.monthlyRentPaise ?? property.monthlyRentPaise,
        });
        await deps.store.appendAudit({
          actorId: user.id,
          tenancyId: tenancy.id,
          action: 'tenancy.invited',
          metadata: { propertyId: property.id, tenantEmail: input.tenantEmail },
        });
        return reply.status(201).send({ tenancy });
      } catch (error) {
        if (error instanceof Error && error.message.includes('UNIQUE')) {
          throw failure.conflict('This property already has an open tenancy.');
        }
        throw error;
      }
    },
  );

  app.get('/api/tenancies/:id', { preHandler: [app.authenticate] }, async (request) => {
    const user = requireUser(request);
    const { id } = parseOrThrow(idParamSchema, request.params);
    const tenancy = await loadTenancyForUser(deps.store, id, user);
    return buildTenancyAggregate(deps.store, tenancy);
  });

  app.post(
    '/api/tenancies/:id/accept',
    { preHandler: [app.authenticate, app.verifyCsrf] },
    async (request) => {
      const user = requireUser(request);
      const { id } = parseOrThrow(idParamSchema, request.params);
      const tenancy = await deps.store.getTenancyById(id);
      if (!tenancy) throw failure.notFound('Tenancy not found.');
      if (user.role !== 'tenant' || tenancy.tenantEmail !== user.email) {
        throw failure.forbidden('This invitation is not addressed to you.');
      }
      if (tenancy.status !== 'invited') {
        throw failure.conflict('This invitation is no longer open.');
      }
      const updated = await deps.store.updateTenancyStatus(id, 'active', user.id);
      await deps.store.appendAudit({
        actorId: user.id,
        tenancyId: id,
        action: 'tenancy.accepted',
      });
      return { tenancy: updated };
    },
  );

  app.post(
    '/api/tenancies/:id/end',
    { preHandler: [app.authenticate, app.verifyCsrf] },
    async (request) => {
      const user = requireUser(request);
      const { id } = parseOrThrow(idParamSchema, request.params);
      const tenancy = await loadTenancyForUser(deps.store, id, user);
      if (tenancy.status !== 'active')
        throw failure.conflict('Only an active tenancy can be ended.');
      const updated = await deps.store.updateTenancyStatus(id, 'ended');
      await deps.store.appendAudit({ actorId: user.id, tenancyId: id, action: 'tenancy.ended' });
      return { tenancy: updated };
    },
  );

  app.post(
    '/api/tenancies/:id/inspections',
    { preHandler: [app.authenticate, app.verifyCsrf] },
    async (request, reply) => {
      const user = requireUser(request);
      const { id } = parseOrThrow(idParamSchema, request.params);
      const tenancy = await loadTenancyForUser(deps.store, id, user);
      if (tenancy.status === 'cancelled' || tenancy.status === 'ended') {
        throw failure.conflict('This tenancy is closed.');
      }
      const input = parseOrThrow(createInspectionSchema, request.body);
      const inspection = await deps.store.createInspection({
        tenancyId: id,
        stage: input.stage,
        area: input.area,
        notes: '',
        createdBy: user.id,
      });
      await deps.store.appendAudit({
        actorId: user.id,
        tenancyId: id,
        action: 'inspection.created',
        metadata: { stage: inspection.stage, area: inspection.area },
      });
      return reply.status(201).send({ inspection });
    },
  );

  app.post(
    '/api/tenancies/:id/evidence',
    { preHandler: [app.authenticate, app.verifyCsrf] },
    async (request, reply) => {
      const user = requireUser(request);
      const { id } = parseOrThrow(idParamSchema, request.params);
      const tenancy = await loadTenancyForUser(deps.store, id, user);
      const query = parseOrThrow(evidenceQuerySchema, request.query);

      const inspection = await deps.store.getInspectionById(query.inspectionId);
      if (!inspection || inspection.tenancyId !== tenancy.id) {
        throw failure.notFound('Inspection not found for this tenancy.');
      }

      const part = await request.file();
      if (!part) throw failure.validation('Attach a photo.');
      const buffer = await part.toBuffer();
      if (part.file.truncated || buffer.length > MAX_EVIDENCE_BYTES) {
        throw failure.tooLarge('Photos must be 10 MB or smaller.');
      }
      const detected = detectImageMime(buffer);
      if (!detected) {
        throw failure.mediaType('Only JPEG, PNG, WebP or HEIC photos are accepted.');
      }

      const sha256 = sha256Hex(buffer);
      const storageKey = `tenancies/${tenancy.id}/${randomUUID()}.${extensionForMime(detected)}`;
      await deps.evidence.put(storageKey, buffer, detected);

      const asset = await deps.store.createEvidence({
        tenancyId: tenancy.id,
        inspectionId: inspection.id,
        kind: 'photo',
        mime: detected,
        bytes: buffer.length,
        sha256,
        storageKey,
        originalName: part.filename.slice(0, 200),
        capturedAt: null,
        uploadedBy: user.id,
      });
      await deps.store.appendAudit({
        actorId: user.id,
        tenancyId: tenancy.id,
        action: 'evidence.uploaded',
        metadata: { evidenceId: asset.id, inspectionId: inspection.id, sha256 },
      });
      return reply.status(201).send({ evidence: publicEvidence(asset) });
    },
  );

  app.get(
    '/api/tenancies/:id/evidence/:assetId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = requireUser(request);
      const { id } = parseOrThrow(idParamSchema, request.params);
      const tenancy = await loadTenancyForUser(deps.store, id, user);
      const params = request.params as { id: string; assetId?: string };
      const assetId = params.assetId ?? '';
      const asset = await deps.store.getEvidenceById(assetId);
      if (!asset || asset.tenancyId !== tenancy.id) {
        throw failure.notFound('Evidence not found.');
      }
      const object = await deps.evidence.get(asset.storageKey);
      if (!object) throw failure.notFound('Evidence file is missing.');
      await deps.store.appendAudit({
        actorId: user.id,
        tenancyId: tenancy.id,
        action: 'evidence.viewed',
        metadata: { evidenceId: asset.id },
      });
      return reply.type(asset.mime).send(object.data);
    },
  );

  app.post(
    '/api/tenancies/:id/audit',
    {
      preHandler: [app.authenticate, app.verifyCsrf],
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const user = requireUser(request);
      const { id } = parseOrThrow(idParamSchema, request.params);
      const tenancy = await loadTenancyForUser(deps.store, id, user);
      const body = parseOrThrow(auditSchema, request.body ?? {});

      const property = await deps.store.getPropertyById(tenancy.propertyId);
      if (!property) throw failure.notFound('Property not found.');

      const priorCount = await deps.store.countStatements(tenancy.id);
      if (priorCount >= deps.config.AUDIT_QUOTA_PER_TENANCY) {
        throw failure.conflict('This tenancy has reached its audit limit.');
      }

      const inspections = await deps.store.listInspectionsByTenancy(tenancy.id);
      const evidence = await deps.store.listEvidenceByTenancy(tenancy.id);
      const moveOut = inspections.filter((inspection) => inspection.stage === 'move_out');
      if (moveOut.length === 0) {
        throw failure.conflict('Capture at least one move-out area before running the audit.');
      }

      const areas = moveOut.map((inspection) => {
        const outEvidence = evidence.find((asset) => asset.inspectionId === inspection.id);
        const matchingIn = inspections.find(
          (candidate) =>
            candidate.stage === 'move_in' &&
            candidate.area.trim().toLowerCase() === inspection.area.trim().toLowerCase(),
        );
        const inEvidence = matchingIn
          ? evidence.find((asset) => asset.inspectionId === matchingIn.id)
          : undefined;
        return {
          area: inspection.area,
          moveInRef: inEvidence?.id,
          moveOutRef: outEvidence?.id,
        };
      });

      const claimedPaise = body.claimedPaise ?? 0;
      const result = await deps.auditEngine.analyze({
        tenancyId: tenancy.id,
        stateCode: property.stateCode,
        city: property.city,
        depositPaise: tenancy.depositPaise,
        claimedPaise,
        areas,
      });

      const totals = computeDepositStatement({
        depositPaise: tenancy.depositPaise,
        claimedPaise,
        findings: result.findings,
      });

      const version = priorCount + 1;
      const statement = await deps.store.createStatement({
        tenancyId: tenancy.id,
        version,
        depositPaise: totals.depositPaise,
        claimedPaise: totals.claimedPaise,
        approvedDeductionPaise: totals.approvedDeductionPaise,
        protectedPaise: totals.protectedPaise,
        shortfallPaise: totals.shortfallPaise,
        refundPaise: totals.refundPaise,
        engine: result.engine,
      });

      const findings: AuditFinding[] = await deps.store.createFindings(
        result.findings.map((finding) => ({
          tenancyId: tenancy.id,
          statementVersion: version,
          area: finding.area,
          category: finding.category,
          classification: finding.classification,
          severity: finding.severity,
          benchmarkLowPaise: finding.benchmarkLowPaise,
          benchmarkHighPaise: finding.benchmarkHighPaise,
          recommendedDeductionPaise: finding.recommendedDeductionPaise,
          confidence: finding.confidence,
          rationale: finding.rationale,
          statutoryNote: finding.statutoryNote,
          engine: result.engine,
          reviewRequired: reviewRequired(finding),
        })),
      );

      await deps.store.appendAudit({
        actorId: user.id,
        tenancyId: tenancy.id,
        action: 'audit.run',
        metadata: { engine: result.engine, version, findings: findings.length },
      });

      return reply.status(201).send({
        statement,
        findings,
        engine: result.engine,
        fallbackReason: result.fallbackReason ?? null,
      });
    },
  );

  app.get('/api/tenancies/:id/statement', { preHandler: [app.authenticate] }, async (request) => {
    const user = requireUser(request);
    const { id } = parseOrThrow(idParamSchema, request.params);
    const tenancy = await loadTenancyForUser(deps.store, id, user);
    const statement = await deps.store.getLatestStatement(tenancy.id);
    if (!statement) throw failure.notFound('No statement has been produced yet.');
    const findings = await deps.store.listFindingsByStatement(tenancy.id, statement.version);
    return { statement, findings };
  });

  app.post(
    '/api/tenancies/:id/statement/accept',
    { preHandler: [app.authenticate, app.verifyCsrf] },
    async (request) => {
      const user = requireUser(request);
      const { id } = parseOrThrow(idParamSchema, request.params);
      const tenancy = await loadTenancyForUser(deps.store, id, user);
      const statement = await deps.store.getLatestStatement(tenancy.id);
      if (!statement) throw failure.notFound('No statement to accept.');
      const actorRole = tenancy.landlordId === user.id ? 'landlord' : 'tenant';
      const otherAccepted =
        actorRole === 'landlord'
          ? statement.acceptedByTenantAt !== null
          : statement.acceptedByLandlordAt !== null;
      const updated = await deps.store.updateStatementStatus(
        statement.id,
        otherAccepted ? 'accepted' : 'awaiting_acceptance',
        actorRole,
      );
      await deps.store.appendAudit({
        actorId: user.id,
        tenancyId: tenancy.id,
        action: 'statement.accepted',
        metadata: { version: statement.version, actorRole },
      });
      return { statement: updated };
    },
  );

  app.post(
    '/api/tenancies/:id/disputes',
    { preHandler: [app.authenticate, app.verifyCsrf] },
    async (request, reply) => {
      const user = requireUser(request);
      const { id } = parseOrThrow(idParamSchema, request.params);
      const tenancy = await loadTenancyForUser(deps.store, id, user);
      const input = parseOrThrow(openDisputeSchema, request.body);

      if (input.statementId) {
        const statement = await deps.store.getStatementById(input.statementId);
        if (!statement || statement.tenancyId !== tenancy.id) {
          throw failure.validation('statementId does not belong to this tenancy.');
        }
      }
      if (input.findingId) {
        const statement = await deps.store.getLatestStatement(tenancy.id);
        const findings = statement
          ? await deps.store.listFindingsByStatement(tenancy.id, statement.version)
          : [];
        if (!findings.some((finding) => finding.id === input.findingId)) {
          throw failure.validation('findingId does not belong to this tenancy.');
        }
      }

      const dispute = await deps.store.createDispute({
        tenancyId: tenancy.id,
        statementId: input.statementId ?? null,
        findingId: input.findingId ?? null,
        raisedBy: user.id,
        reason: input.reason,
      });
      await deps.store.appendAudit({
        actorId: user.id,
        tenancyId: tenancy.id,
        action: 'dispute.opened',
        metadata: { disputeId: dispute.id },
      });
      return reply.status(201).send({ dispute });
    },
  );

  app.post(
    '/api/tenancies/:id/disputes/:disputeId/resolve',
    { preHandler: [app.authenticate, app.verifyCsrf] },
    async (request) => {
      const user = requireUser(request);
      const { id } = parseOrThrow(idParamSchema, request.params);
      const tenancy = await loadTenancyForUser(deps.store, id, user);
      const params = request.params as { id: string; disputeId?: string };
      const dispute = await deps.store.getDisputeById(params.disputeId ?? '');
      if (!dispute || dispute.tenancyId !== tenancy.id) {
        throw failure.notFound('Dispute not found.');
      }
      if (dispute.status !== 'open') throw failure.conflict('This dispute is already closed.');
      const input = parseOrThrow(resolveDisputeSchema, request.body);
      const resolved = await deps.store.resolveDispute(dispute.id, user.id, input.resolutionNote);
      await deps.store.appendAudit({
        actorId: user.id,
        tenancyId: tenancy.id,
        action: 'dispute.resolved',
        metadata: { disputeId: dispute.id },
      });
      return { dispute: resolved };
    },
  );
}
