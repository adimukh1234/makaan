import { describe, expect, it } from 'vitest';
import { createPropertySchema, loginSchema, registerSchema } from '../src/schemas';

describe('request schemas', () => {
  it('accepts a valid registration and normalizes the email', () => {
    const parsed = registerSchema.parse({
      email: '  Tenant@Makaan.TEST ',
      name: 'Priya Sundaram',
      password: 'a-long-enough-password',
      role: 'tenant',
      consent: { service: true, evidence_retention: true, ai_processing: true },
    });
    expect(parsed.email).toBe('tenant@makaan.test');
  });

  it('requires every consent at registration', () => {
    const outcome = registerSchema.safeParse({
      email: 'tenant@makaan.test',
      name: 'Priya Sundaram',
      password: 'a-long-enough-password',
      role: 'tenant',
      consent: { service: true, evidence_retention: false, ai_processing: true },
    });
    expect(outcome.success).toBe(false);
  });

  it('rejects a short password', () => {
    const outcome = registerSchema.safeParse({
      email: 'tenant@makaan.test',
      name: 'Priya Sundaram',
      password: 'short',
      role: 'tenant',
      consent: { service: true, evidence_retention: true, ai_processing: true },
    });
    expect(outcome.success).toBe(false);
  });

  it('rejects unknown keys', () => {
    const outcome = loginSchema.safeParse({
      email: 'tenant@makaan.test',
      password: 'a-long-enough-password',
      admin: true,
    });
    expect(outcome.success).toBe(false);
  });

  it('rejects negative money on a property', () => {
    const outcome = createPropertySchema.safeParse({
      title: 'Two bedroom',
      addressLine: '12th Main',
      city: 'bengaluru',
      stateCode: 'ka',
      propertyType: 'apartment',
      monthlyRentPaise: -1,
      defaultDepositPaise: 0,
    });
    expect(outcome.success).toBe(false);
  });

  it('uppercases the state code', () => {
    const parsed = createPropertySchema.parse({
      title: 'Two bedroom',
      addressLine: '12th Main',
      city: 'bengaluru',
      stateCode: 'ka',
      propertyType: 'apartment',
      monthlyRentPaise: 1000,
      defaultDepositPaise: 0,
      bedrooms: 2,
    });
    expect(parsed.stateCode).toBe('KA');
  });
});
