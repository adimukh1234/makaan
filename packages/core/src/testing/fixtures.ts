import type { Property, Tenancy, User } from '../types';

/**
 * Deterministic fixtures for tests and local seeding.
 * Values are fixed so assertions never depend on wall clock time.
 */

export const FIXTURE_DATE = '2026-09-17T04:00:00.000Z';

export const landlordUser: User = {
  id: 'usr_landlord_fixture_000001',
  email: 'landlord@makaan.test',
  name: 'Raghavan Iyer',
  role: 'landlord',
  createdAt: FIXTURE_DATE,
  updatedAt: FIXTURE_DATE,
};

export const tenantUser: User = {
  id: 'usr_tenant_fixture_00000001',
  email: 'tenant@makaan.test',
  name: 'Priya Sundaram',
  role: 'tenant',
  createdAt: FIXTURE_DATE,
  updatedAt: FIXTURE_DATE,
};

export const bengaluruProperty: Property = {
  id: 'prp_bengaluru_fixture_0001',
  landlordId: landlordUser.id,
  title: 'Two bedroom in Indiranagar',
  addressLine: '12th Main, Indiranagar',
  city: 'bengaluru',
  stateCode: 'KA',
  propertyType: 'apartment',
  bedrooms: 2,
  monthlyRentPaise: 3500000,
  defaultDepositPaise: 10000000,
  createdAt: FIXTURE_DATE,
  updatedAt: FIXTURE_DATE,
};

export const activeTenancy: Tenancy = {
  id: 'ten_fixture_active_00000001',
  propertyId: bengaluruProperty.id,
  landlordId: landlordUser.id,
  tenantId: tenantUser.id,
  tenantEmail: tenantUser.email,
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  depositPaise: 10000000,
  monthlyRentPaise: 3500000,
  status: 'active',
  createdAt: FIXTURE_DATE,
  respondedAt: FIXTURE_DATE,
};

/** Rs 25,000, the classic "full repainting" claim. */
export const PAINTING_CLAIM_PAISE = 2500000;
/** Rs 1,00,000 deposit. */
export const DEPOSIT_PAISE = 10000000;
