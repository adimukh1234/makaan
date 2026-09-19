import { afterEach, describe, expect, it } from 'vitest';
import { createTestContext, newClient, register, request, type TestContext } from './support';

let ctx: TestContext;

afterEach(async () => {
  if (ctx) await ctx.app.close();
});

const validProperty = {
  title: 'One bedroom in Koramangala',
  addressLine: '5th Block',
  city: 'bengaluru',
  stateCode: 'KA',
  propertyType: 'apartment',
  bedrooms: 1,
  monthlyRentPaise: 2500000,
  defaultDepositPaise: 5000000,
};

describe('properties', () => {
  it('lets a landlord create and list a property', async () => {
    ctx = await createTestContext();
    const landlord = newClient();
    await register(ctx, landlord, { email: 'l@makaan.test', name: 'Landlord', role: 'landlord' });
    const created = await request(ctx, landlord, {
      method: 'POST',
      url: '/api/properties',
      payload: validProperty,
    });
    expect(created.status).toBe(201);
    expect(created.body.property.stateCode).toBe('KA');

    const list = await request(ctx, landlord, { method: 'GET', url: '/api/properties' });
    expect(list.body.properties).toHaveLength(1);
  });

  it('blocks a tenant from creating a property', async () => {
    ctx = await createTestContext();
    const tenant = newClient();
    await register(ctx, tenant, { email: 't@makaan.test', name: 'Tenant', role: 'tenant' });
    const created = await request(ctx, tenant, {
      method: 'POST',
      url: '/api/properties',
      payload: validProperty,
    });
    expect(created.status).toBe(403);
  });

  it('rejects invalid money and unknown fields', async () => {
    ctx = await createTestContext();
    const landlord = newClient();
    await register(ctx, landlord, { email: 'l2@makaan.test', name: 'Landlord', role: 'landlord' });
    const negative = await request(ctx, landlord, {
      method: 'POST',
      url: '/api/properties',
      payload: { ...validProperty, monthlyRentPaise: -100 },
    });
    expect(negative.status).toBe(400);

    const extra = await request(ctx, landlord, {
      method: 'POST',
      url: '/api/properties',
      payload: { ...validProperty, landlordId: 'usr_forged' },
    });
    expect(extra.status).toBe(400);
  });

  it('warns when a deposit exceeds the Model Tenancy Act cap', async () => {
    ctx = await createTestContext();
    const landlord = newClient();
    await register(ctx, landlord, { email: 'l3@makaan.test', name: 'Landlord', role: 'landlord' });
    const created = await request(ctx, landlord, {
      method: 'POST',
      url: '/api/properties',
      payload: {
        ...validProperty,
        stateCode: 'TN',
        monthlyRentPaise: 1000000,
        defaultDepositPaise: 5000000,
      },
    });
    expect(created.status).toBe(201);
    expect(created.body.warning).toContain('Tamil Nadu');
  });

  it('denies access to another landlord property', async () => {
    ctx = await createTestContext();
    const owner = newClient();
    const other = newClient();
    await register(ctx, owner, { email: 'owner@makaan.test', name: 'Owner', role: 'landlord' });
    await register(ctx, other, { email: 'other@makaan.test', name: 'Other', role: 'landlord' });
    const created = await request(ctx, owner, {
      method: 'POST',
      url: '/api/properties',
      payload: validProperty,
    });
    const id = created.body.property.id as string;
    const denied = await request(ctx, other, { method: 'GET', url: `/api/properties/${id}` });
    expect(denied.status).toBe(403);
  });
});
