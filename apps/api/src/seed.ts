import { randomUUID } from 'node:crypto';
import {
  computeDepositStatement,
  createDeterministicEngine,
  reviewRequired,
  toPaise,
  type ConsentPurpose,
} from '@makaan/core';
import { loadConfig } from './config';
import { openDatabase } from './db';
import { SqliteStore } from './db/store';
import { createEvidenceStore } from './storage/factory';
import { hashPassword, sha256Hex } from './auth/passwords';
import { renderRoomImage } from './lib/png';

const DEMO_PASSWORD = 'makaan-demo-2026';
const PURPOSES: ConsentPurpose[] = ['service', 'evidence_retention', 'ai_processing'];

interface AreaPlan {
  label: string;
  moveInMarks: Parameters<typeof renderRoomImage>[0]['marks'];
  moveOutMarks: Parameters<typeof renderRoomImage>[0]['marks'];
  wall: [number, number, number];
  floor: [number, number, number];
}

const AREAS: AreaPlan[] = [
  {
    label: 'Living room walls and skirting',
    wall: [226, 220, 208],
    floor: [150, 116, 82],
    moveInMarks: [],
    moveOutMarks: [
      { x: 140, y: 300, w: 120, h: 26, color: [150, 140, 128], opacity: 0.55 },
      { x: 520, y: 360, w: 90, h: 20, color: [150, 140, 128], opacity: 0.45 },
    ],
  },
  {
    label: 'Master bathroom exhaust fan',
    wall: [198, 214, 214],
    floor: [176, 184, 184],
    moveInMarks: [{ x: 430, y: 120, w: 120, h: 120, color: [232, 232, 232], opacity: 0.9 }],
    moveOutMarks: [
      { x: 430, y: 120, w: 120, h: 120, color: [232, 232, 232], opacity: 0.9 },
      { x: 470, y: 150, w: 40, h: 60, color: [60, 60, 60], opacity: 0.8 },
    ],
  },
  {
    label: 'Kitchen counter and hob',
    wall: [222, 214, 198],
    floor: [120, 120, 124],
    moveInMarks: [{ x: 200, y: 380, w: 560, h: 120, color: [70, 72, 76], opacity: 0.95 }],
    moveOutMarks: [
      { x: 200, y: 380, w: 560, h: 120, color: [70, 72, 76], opacity: 0.95 },
      { x: 420, y: 420, w: 90, h: 50, color: [40, 28, 20], opacity: 0.85 },
    ],
  },
];

async function main(): Promise<void> {
  const config = loadConfig();
  const database = openDatabase(config.DATABASE_URL);
  const store = new SqliteStore(database);
  const evidence = createEvidenceStore(config);

  const landlordEmail = 'landlord@makaan.test';
  const existing = await store.getUserByEmail(landlordEmail);
  if (existing) {
    console.log('Demo data already present. Delete the database file to reseed.');
    return;
  }

  const landlord = await store.createUser({
    email: landlordEmail,
    name: 'Raghavan Iyer',
    role: 'landlord',
    passwordHash: await hashPassword(DEMO_PASSWORD),
  });
  const tenant = await store.createUser({
    email: 'tenant@makaan.test',
    name: 'Priya Sundaram',
    role: 'tenant',
    passwordHash: await hashPassword(DEMO_PASSWORD),
  });

  for (const user of [landlord, tenant]) {
    for (const purpose of PURPOSES) {
      await store.upsertConsent(user.id, purpose, true);
    }
  }

  const property = await store.createProperty({
    landlordId: landlord.id,
    title: 'Two bedroom in Indiranagar',
    addressLine: '12th Main Road, Indiranagar',
    city: 'bengaluru',
    stateCode: 'KA',
    propertyType: 'apartment',
    bedrooms: 2,
    monthlyRentPaise: toPaise(35000),
    defaultDepositPaise: toPaise(100000),
  });

  const tenancy = await store.createTenancy({
    propertyId: property.id,
    landlordId: landlord.id,
    tenantEmail: tenant.email,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    depositPaise: toPaise(100000),
    monthlyRentPaise: toPaise(35000),
  });
  await store.updateTenancyStatus(tenancy.id, 'active', tenant.id);

  for (const plan of AREAS) {
    for (const stage of ['move_in', 'move_out'] as const) {
      const inspection = await store.createInspection({
        tenancyId: tenancy.id,
        stage,
        area: plan.label,
        notes: '',
        createdBy: stage === 'move_in' ? landlord.id : tenant.id,
      });
      const image = renderRoomImage({
        wall: plan.wall,
        floor: plan.floor,
        marks: stage === 'move_in' ? plan.moveInMarks : plan.moveOutMarks,
      });
      const sha256 = sha256Hex(image);
      const storageKey = `tenancies/${tenancy.id}/${randomUUID()}.png`;
      await evidence.put(storageKey, image, 'image/png');
      await store.createEvidence({
        tenancyId: tenancy.id,
        inspectionId: inspection.id,
        kind: 'photo',
        mime: 'image/png',
        bytes: image.length,
        sha256,
        storageKey,
        originalName: `${plan.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stage}.png`,
        capturedAt: stage === 'move_in' ? '2026-01-01T05:00:00.000Z' : '2026-08-31T05:00:00.000Z',
        uploadedBy: stage === 'move_in' ? landlord.id : tenant.id,
      });
    }
  }

  const inspections = await store.listInspectionsByTenancy(tenancy.id);
  const assets = await store.listEvidenceByTenancy(tenancy.id);
  const moveOut = inspections.filter((inspection) => inspection.stage === 'move_out');
  const areas = moveOut.map((inspection) => {
    const outEvidence = assets.find((asset) => asset.inspectionId === inspection.id);
    const matchingIn = inspections.find(
      (candidate) =>
        candidate.stage === 'move_in' &&
        candidate.area.trim().toLowerCase() === inspection.area.trim().toLowerCase(),
    );
    const inEvidence = matchingIn
      ? assets.find((asset) => asset.inspectionId === matchingIn.id)
      : undefined;
    return { area: inspection.area, moveInRef: inEvidence?.id, moveOutRef: outEvidence?.id };
  });

  const engine = createDeterministicEngine();
  const claimedPaise = toPaise(25000);
  const result = await engine.analyze({
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
  await store.createStatement({
    tenancyId: tenancy.id,
    version: 1,
    depositPaise: totals.depositPaise,
    claimedPaise: totals.claimedPaise,
    approvedDeductionPaise: totals.approvedDeductionPaise,
    protectedPaise: totals.protectedPaise,
    shortfallPaise: totals.shortfallPaise,
    refundPaise: totals.refundPaise,
    engine: result.engine,
  });
  await store.createFindings(
    result.findings.map((finding) => ({
      tenancyId: tenancy.id,
      statementVersion: 1,
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

  console.log('Makaan demo data ready.');
  console.log('Landlord: landlord@makaan.test /', DEMO_PASSWORD);
  console.log('Tenant:   tenant@makaan.test /', DEMO_PASSWORD);
  console.log(
    `Statement: deposit Rs ${totals.depositPaise / 100}, approved deduction Rs ${totals.approvedDeductionPaise / 100}, refund Rs ${totals.refundPaise / 100}`,
  );
}

main().catch((error) => {
  console.error('Seed failed', error);
  process.exit(1);
});
