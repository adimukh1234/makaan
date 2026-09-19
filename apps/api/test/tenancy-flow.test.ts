import { afterEach, describe, expect, it } from 'vitest';
import { renderRoomImage } from '../src/lib/png';
import {
  createTestContext,
  login,
  newClient,
  register,
  request,
  type Client,
  type TestContext,
} from './support';

let ctx: TestContext;

afterEach(async () => {
  if (ctx) await ctx.app.close();
});

const PASSWORD = 'correct-horse-battery';

function multipart(file: Buffer, filename: string, mime: string) {
  const boundary = '----makaanboundary1234567890';
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
    ),
    file,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

async function uploadPhoto(
  ctx: TestContext,
  client: Client,
  tenancyId: string,
  inspectionId: string,
) {
  const image = renderRoomImage({
    width: 64,
    height: 48,
    wall: [210, 205, 195],
    floor: [140, 110, 80],
  });
  const { body, contentType } = multipart(image, 'room.png', 'image/png');
  return request(ctx, client, {
    method: 'POST',
    url: `/api/tenancies/${tenancyId}/evidence?inspectionId=${inspectionId}`,
    rawPayload: body,
    headers: { 'content-type': contentType },
  });
}

async function setupActiveTenancy() {
  ctx = await createTestContext();
  const landlord = newClient();
  const tenant = newClient();
  await register(ctx, landlord, {
    email: 'landlord@makaan.test',
    name: 'Raghavan',
    role: 'landlord',
  });
  await register(ctx, tenant, { email: 'tenant@makaan.test', name: 'Priya', role: 'tenant' });

  const property = await request(ctx, landlord, {
    method: 'POST',
    url: '/api/properties',
    payload: {
      title: 'Two bedroom in Indiranagar',
      addressLine: '12th Main',
      city: 'bengaluru',
      stateCode: 'KA',
      propertyType: 'apartment',
      bedrooms: 2,
      monthlyRentPaise: 3500000,
      defaultDepositPaise: 10000000,
    },
  });
  const propertyId = property.body.property.id as string;

  const invite = await request(ctx, landlord, {
    method: 'POST',
    url: '/api/tenancies',
    payload: {
      propertyId,
      tenantEmail: 'tenant@makaan.test',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      depositPaise: 10000000,
    },
  });
  const tenancyId = invite.body.tenancy.id as string;

  const accepted = await request(ctx, tenant, {
    method: 'POST',
    url: `/api/tenancies/${tenancyId}/accept`,
  });
  expect(accepted.body.tenancy.status).toBe('active');

  return { landlord, tenant, propertyId, tenancyId };
}

async function captureArea(
  ctx: TestContext,
  landlord: Client,
  tenant: Client,
  tenancyId: string,
  area: string,
) {
  const moveIn = await request(ctx, landlord, {
    method: 'POST',
    url: `/api/tenancies/${tenancyId}/inspections`,
    payload: { stage: 'move_in', area },
  });
  expect(moveIn.status).toBe(201);
  const inUpload = await uploadPhoto(ctx, landlord, tenancyId, moveIn.body.inspection.id);
  expect(inUpload.status).toBe(201);
  expect(inUpload.body.evidence.sha256).toMatch(/^[0-9a-f]{64}$/);

  const moveOut = await request(ctx, tenant, {
    method: 'POST',
    url: `/api/tenancies/${tenancyId}/inspections`,
    payload: { stage: 'move_out', area },
  });
  expect(moveOut.status).toBe(201);
  const outUpload = await uploadPhoto(ctx, tenant, tenancyId, moveOut.body.inspection.id);
  expect(outUpload.status).toBe(201);
}

describe('tenancy lifecycle', () => {
  it('runs the golden path from invite to settled statement', async () => {
    const { landlord, tenant, tenancyId } = await setupActiveTenancy();
    await captureArea(ctx, landlord, tenant, tenancyId, 'Living room walls and skirting');
    await captureArea(ctx, landlord, tenant, tenancyId, 'Master bathroom exhaust fan');

    const audit = await request(ctx, tenant, {
      method: 'POST',
      url: `/api/tenancies/${tenancyId}/audit`,
      payload: { claimedPaise: 2500000 },
    });
    expect(audit.status).toBe(201);
    const statement = audit.body.statement;
    expect(statement.claimedPaise).toBe(2500000);
    expect(statement.approvedDeductionPaise).toBeGreaterThan(0);
    expect(statement.refundPaise).toBe(10000000 - statement.approvedDeductionPaise);
    expect(statement.protectedPaise).toBe(2500000 - statement.approvedDeductionPaise);
    expect(statement.engine).toBe('deterministic');

    const wallFinding = audit.body.findings.find((f: { area: string }) =>
      f.area.includes('Living room'),
    );
    expect(wallFinding.classification).toBe('WEAR_AND_TEAR');
    expect(wallFinding.recommendedDeductionPaise).toBe(0);

    const fetched = await request(ctx, tenant, {
      method: 'GET',
      url: `/api/tenancies/${tenancyId}/statement`,
    });
    expect(fetched.body.statement.id).toBe(statement.id);
    expect(fetched.body.findings.length).toBe(audit.body.findings.length);

    const tenantAccept = await request(ctx, tenant, {
      method: 'POST',
      url: `/api/tenancies/${tenancyId}/statement/accept`,
    });
    expect(tenantAccept.body.statement.acceptedByTenantAt).toBeTruthy();
    expect(tenantAccept.body.statement.status).toBe('awaiting_acceptance');

    const landlordAccept = await request(ctx, landlord, {
      method: 'POST',
      url: `/api/tenancies/${tenancyId}/statement/accept`,
    });
    expect(landlordAccept.body.statement.status).toBe('accepted');

    const dispute = await request(ctx, tenant, {
      method: 'POST',
      url: `/api/tenancies/${tenancyId}/disputes`,
      payload: {
        reason: 'I disagree with the exhaust fan deduction amount.',
        findingId: wallFinding.id,
      },
    });
    expect(dispute.status).toBe(201);
    expect(dispute.body.dispute.status).toBe('open');

    const resolved = await request(ctx, landlord, {
      method: 'POST',
      url: `/api/tenancies/${tenancyId}/disputes/${dispute.body.dispute.id}/resolve`,
      payload: { resolutionNote: 'Agreed to split the difference.' },
    });
    expect(resolved.body.dispute.status).toBe('resolved');
  });

  it('blocks outsiders from a tenancy and its nested resources', async () => {
    const { tenancyId } = await setupActiveTenancy();
    const outsider = newClient();
    await register(ctx, outsider, {
      email: 'outsider@makaan.test',
      name: 'Outsider',
      role: 'tenant',
    });

    const read = await request(ctx, outsider, {
      method: 'GET',
      url: `/api/tenancies/${tenancyId}`,
    });
    expect(read.status).toBe(403);

    const inspect = await request(ctx, outsider, {
      method: 'POST',
      url: `/api/tenancies/${tenancyId}/inspections`,
      payload: { stage: 'move_out', area: 'Hack' },
    });
    expect(inspect.status).toBe(403);
  });

  it('rejects a second open tenancy on the same property', async () => {
    const { landlord, propertyId } = await setupActiveTenancy();
    const second = await request(ctx, landlord, {
      method: 'POST',
      url: '/api/tenancies',
      payload: {
        propertyId,
        tenantEmail: 'another@makaan.test',
        startDate: '2026-02-01',
        depositPaise: 1000000,
      },
    });
    expect(second.status).toBe(409);
  });

  it('rejects an audit before any move-out capture', async () => {
    const { tenant, tenancyId } = await setupActiveTenancy();
    const audit = await request(ctx, tenant, {
      method: 'POST',
      url: `/api/tenancies/${tenancyId}/audit`,
      payload: { claimedPaise: 0 },
    });
    expect(audit.status).toBe(409);
  });

  it('rejects a non image upload', async () => {
    const { landlord, tenant, tenancyId } = await setupActiveTenancy();
    const inspection = await request(ctx, landlord, {
      method: 'POST',
      url: `/api/tenancies/${tenancyId}/inspections`,
      payload: { stage: 'move_in', area: 'Hallway' },
    });
    const { body, contentType } = multipart(Buffer.from('not an image'), 'notes.txt', 'text/plain');
    const bad = await request(ctx, tenant, {
      method: 'POST',
      url: `/api/tenancies/${tenancyId}/evidence?inspectionId=${inspection.body.inspection.id}`,
      rawPayload: body,
      headers: { 'content-type': contentType },
    });
    expect(bad.status).toBe(415);
  });

  it('serves uploaded evidence only to members', async () => {
    const { landlord, tenant, tenancyId } = await setupActiveTenancy();
    const inspection = await request(ctx, landlord, {
      method: 'POST',
      url: `/api/tenancies/${tenancyId}/inspections`,
      payload: { stage: 'move_in', area: 'Living room walls and skirting' },
    });
    const upload = await uploadPhoto(ctx, landlord, tenancyId, inspection.body.inspection.id);
    const assetId = upload.body.evidence.id as string;

    const ok = await request(ctx, tenant, {
      method: 'GET',
      url: `/api/tenancies/${tenancyId}/evidence/${assetId}`,
    });
    expect(ok.status).toBe(200);

    const outsider = newClient();
    await register(ctx, outsider, {
      email: 'outsider2@makaan.test',
      name: 'Outsider',
      role: 'landlord',
    });
    const denied = await request(ctx, outsider, {
      method: 'GET',
      url: `/api/tenancies/${tenancyId}/evidence/${assetId}`,
    });
    expect(denied.status).toBe(403);
  });

  it('logs in an existing account', async () => {
    await setupActiveTenancy();
    const client = newClient();
    const result = await login(ctx, client, 'tenant@makaan.test', PASSWORD);
    expect(result.status).toBe(200);
    expect(result.body.user.email).toBe('tenant@makaan.test');
  });
});
