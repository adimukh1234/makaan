/**
 * Makaan domain types.
 *
 * Money is always an integer number of paise. Field names carry the `Paise`
 * suffix so a float rupee value cannot be passed by accident.
 */

export type Role = 'tenant' | 'landlord';

export type PropertyType = 'apartment' | 'independent_house' | 'room' | 'hostel_pg';

export type TenancyStatus = 'invited' | 'active' | 'ended' | 'cancelled';

export type InspectionStage = 'move_in' | 'move_out';

export type EvidenceKind = 'photo' | 'video';

export type Classification = 'WEAR_AND_TEAR' | 'DAMAGE' | 'PRE_EXISTING' | 'UNCERTAIN';

export type Severity = 'none' | 'minor' | 'moderate' | 'major';

export type StatementStatus = 'draft' | 'awaiting_acceptance' | 'accepted' | 'disputed';

export type DisputeStatus = 'open' | 'resolved' | 'withdrawn';

export type EngineName = 'bedrock' | 'deterministic';

export type ConsentPurpose = 'service' | 'evidence_retention' | 'ai_processing';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface Property {
  id: string;
  landlordId: string;
  title: string;
  addressLine: string;
  city: string;
  stateCode: string;
  propertyType: PropertyType;
  bedrooms: number;
  monthlyRentPaise: number;
  defaultDepositPaise: number;
  createdAt: string;
  updatedAt: string;
}

export interface Tenancy {
  id: string;
  propertyId: string;
  landlordId: string;
  tenantId: string | null;
  tenantEmail: string;
  startDate: string;
  endDate: string | null;
  depositPaise: number;
  monthlyRentPaise: number;
  status: TenancyStatus;
  createdAt: string;
  respondedAt: string | null;
}

export interface Inspection {
  id: string;
  tenancyId: string;
  stage: InspectionStage;
  area: string;
  notes: string;
  createdBy: string;
  createdAt: string;
}

export interface EvidenceAsset {
  id: string;
  tenancyId: string;
  inspectionId: string;
  kind: EvidenceKind;
  mime: string;
  bytes: number;
  sha256: string;
  storageKey: string;
  originalName: string;
  capturedAt: string | null;
  uploadedBy: string;
  createdAt: string;
}

export interface AuditFinding {
  id: string;
  tenancyId: string;
  statementVersion: number;
  area: string;
  category: string;
  classification: Classification;
  severity: Severity;
  benchmarkLowPaise: number;
  benchmarkHighPaise: number;
  recommendedDeductionPaise: number;
  confidence: number;
  rationale: string;
  statutoryNote: string;
  engine: EngineName;
  reviewRequired: boolean;
  createdAt: string;
}

export interface Statement {
  id: string;
  tenancyId: string;
  version: number;
  depositPaise: number;
  claimedPaise: number;
  approvedDeductionPaise: number;
  protectedPaise: number;
  shortfallPaise: number;
  refundPaise: number;
  status: StatementStatus;
  engine: EngineName;
  createdAt: string;
  acceptedByLandlordAt: string | null;
  acceptedByTenantAt: string | null;
}

export interface Dispute {
  id: string;
  tenancyId: string;
  statementId: string | null;
  findingId: string | null;
  raisedBy: string;
  reason: string;
  status: DisputeStatus;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  policyVersion: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  tenancyId: string | null;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface TenancyAggregate {
  tenancy: Tenancy;
  property: Property;
  inspections: Inspection[];
  evidence: EvidenceAsset[];
  statement: Statement | null;
  findings: AuditFinding[];
  disputes: Dispute[];
}
