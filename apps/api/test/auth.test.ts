import { afterEach, describe, expect, it } from 'vitest';
import {
  createTestContext,
  login,
  newClient,
  register,
  request,
  type TestContext,
} from './support';

let ctx: TestContext;

afterEach(async () => {
  if (ctx) await ctx.app.close();
});

describe('auth', () => {
  it('registers a user, sets a session cookie and records consents', async () => {
    ctx = await createTestContext();
    const client = newClient();
    const result = await register(ctx, client, {
      email: 'tenant@makaan.test',
      name: 'Priya',
      role: 'tenant',
    });
    expect(result.status).toBe(201);
    expect(result.body.user.role).toBe('tenant');
    expect(result.body.csrfToken).toBeTruthy();
    expect(client.cookie).toContain('makaan_session');

    const session = await request(ctx, client, { method: 'GET', url: '/api/auth/session' });
    expect(session.body.user.email).toBe('tenant@makaan.test');

    const consents = await request(ctx, client, { method: 'GET', url: '/api/me/consents' });
    expect(consents.body.consents).toHaveLength(3);
    expect(consents.body.consents.every((c: { granted: boolean }) => c.granted)).toBe(true);
  });

  it('never returns the password hash', async () => {
    ctx = await createTestContext();
    const client = newClient();
    const result = await register(ctx, client, { email: 'a@b.test', name: 'Anita', role: 'landlord' });
    expect(JSON.stringify(result.body)).not.toContain('scrypt$');
    expect(result.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate email', async () => {
    ctx = await createTestContext();
    const first = newClient();
    await register(ctx, first, { email: 'dup@makaan.test', name: 'One', role: 'tenant' });
    const second = newClient();
    const result = await register(ctx, second, {
      email: 'dup@makaan.test',
      name: 'Two',
      role: 'tenant',
    });
    expect(result.status).toBe(409);
  });

  it('rejects a wrong password and unknown email with the same message', async () => {
    ctx = await createTestContext();
    const client = newClient();
    await register(ctx, client, { email: 'login@makaan.test', name: 'Login', role: 'tenant' });

    const wrongPassword = await login(ctx, newClient(), 'login@makaan.test', 'not-the-password');
    const unknownEmail = await login(ctx, newClient(), 'nobody@makaan.test', 'not-the-password');
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('requires authentication for protected routes', async () => {
    ctx = await createTestContext();
    const result = await request(ctx, newClient(), { method: 'GET', url: '/api/properties' });
    expect(result.status).toBe(401);
  });

  it('requires a csrf token for mutating requests', async () => {
    ctx = await createTestContext();
    const client = newClient();
    await register(ctx, client, { email: 'csrf@makaan.test', name: 'Csrf', role: 'landlord' });
    const withoutToken = { ...client, csrf: null };
    const result = await request(ctx, withoutToken, {
      method: 'POST',
      url: '/api/properties',
      payload: {
        title: 'Flat',
        addressLine: 'Street',
        city: 'bengaluru',
        stateCode: 'KA',
        propertyType: 'apartment',
        bedrooms: 1,
        monthlyRentPaise: 1000,
        defaultDepositPaise: 1000,
      },
    });
    expect(result.status).toBe(403);
  });

  it('logs out and revokes the session', async () => {
    ctx = await createTestContext();
    const client = newClient();
    await register(ctx, client, { email: 'logout@makaan.test', name: 'Out', role: 'tenant' });
    const out = await request(ctx, client, { method: 'POST', url: '/api/auth/logout' });
    expect(out.status).toBe(200);
    const after = await request(ctx, client, { method: 'GET', url: '/api/properties' });
    expect(after.status).toBe(401);
  });
});
