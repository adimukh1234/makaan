import {
  newId,
  type AuditFinding,
  type AuditLogEntry,
  type Classification,
  type ConsentPurpose,
  type ConsentRecord,
  type Dispute,
  type DisputeStatus,
  type EvidenceAsset,
  type Inspection,
  type InspectionStage,
  type Property,
  type PropertyType,
  type Role,
  type Severity,
  type Statement,
  type StatementStatus,
  type Tenancy,
  type TenancyStatus,
  type User,
} from '@makaan/core';
import type { Database } from './index';

export interface StoredUser extends User {
  passwordHash: string;
}

export interface SessionRecord {
  tokenHash: string;
  userId: string;
  csrfToken: string;
  createdAt: string;
  expiresAt: string;
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
}

export interface CreatePropertyInput {
  landlordId: string;
  title: string;
  addressLine: string;
  city: string;
  stateCode: string;
  propertyType: PropertyType;
  bedrooms: number;
  monthlyRentPaise: number;
  defaultDepositPaise: number;
}

export interface CreateTenancyInput {
  propertyId: string;
  landlordId: string;
  tenantEmail: string;
  startDate: string;
  endDate: string | null;
  depositPaise: number;
  monthlyRentPaise: number;
}

export interface CreateInspectionInput {
  tenancyId: string;
  stage: InspectionStage;
  area: string;
  notes: string;
  createdBy: string;
}

export interface CreateEvidenceInput {
  tenancyId: string;
  inspectionId: string;
  kind: 'photo' | 'video';
  mime: string;
  bytes: number;
  sha256: string;
  storageKey: string;
  originalName: string;
  capturedAt: string | null;
  uploadedBy: string;
}

export interface CreateStatementInput {
  tenancyId: string;
  version: number;
  depositPaise: number;
  claimedPaise: number;
  approvedDeductionPaise: number;
  protectedPaise: number;
  shortfallPaise: number;
  refundPaise: number;
  engine: 'bedrock' | 'deterministic';
}

export interface CreateFindingInput {
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
  engine: 'bedrock' | 'deterministic';
  reviewRequired: boolean;
}

export interface CreateDisputeInput {
  tenancyId: string;
  statementId: string | null;
  findingId: string | null;
  raisedBy: string;
  reason: string;
}

export interface Store {
  createUser(input: CreateUserInput): Promise<StoredUser>;
  getUserByEmail(email: string): Promise<StoredUser | null>;
  getUserById(id: string): Promise<User | null>;

  createSession(record: SessionRecord): Promise<void>;
  getSession(tokenHash: string): Promise<SessionRecord | null>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteSessionsForUser(userId: string): Promise<void>;
  touchSession(tokenHash: string, expiresAt: string): Promise<void>;

  createProperty(input: CreatePropertyInput): Promise<Property>;
  getPropertyById(id: string): Promise<Property | null>;
  listPropertiesByLandlord(landlordId: string): Promise<Property[]>;
  listPropertiesForTenant(tenantId: string): Promise<Property[]>;
  updateProperty(id: string, patch: Partial<CreatePropertyInput>): Promise<Property>;
  deleteProperty(id: string): Promise<void>;

  createTenancy(input: CreateTenancyInput): Promise<Tenancy>;
  getTenancyById(id: string): Promise<Tenancy | null>;
  listTenanciesForUser(userId: string): Promise<Tenancy[]>;
  updateTenancyStatus(
    id: string,
    status: TenancyStatus,
    tenantId?: string | null,
  ): Promise<Tenancy>;

  createInspection(input: CreateInspectionInput): Promise<Inspection>;
  getInspectionById(id: string): Promise<Inspection | null>;
  listInspectionsByTenancy(tenancyId: string): Promise<Inspection[]>;

  createEvidence(input: CreateEvidenceInput): Promise<EvidenceAsset>;
  getEvidenceById(id: string): Promise<EvidenceAsset | null>;
  listEvidenceByTenancy(tenancyId: string): Promise<EvidenceAsset[]>;
  listEvidenceByInspection(inspectionId: string): Promise<EvidenceAsset[]>;

  createStatement(input: CreateStatementInput): Promise<Statement>;
  createFindings(inputs: CreateFindingInput[]): Promise<AuditFinding[]>;
  getLatestStatement(tenancyId: string): Promise<Statement | null>;
  getStatementById(id: string): Promise<Statement | null>;
  listFindingsByStatement(tenancyId: string, version: number): Promise<AuditFinding[]>;
  countStatements(tenancyId: string): Promise<number>;
  updateStatementStatus(
    id: string,
    status: StatementStatus,
    actorRole: 'landlord' | 'tenant',
  ): Promise<Statement>;

  createDispute(input: CreateDisputeInput): Promise<Dispute>;
  getDisputeById(id: string): Promise<Dispute | null>;
  listDisputesByTenancy(tenancyId: string): Promise<Dispute[]>;
  resolveDispute(id: string, resolvedBy: string, note: string): Promise<Dispute>;

  upsertConsent(userId: string, purpose: ConsentPurpose, granted: boolean): Promise<ConsentRecord>;
  listConsents(userId: string): Promise<ConsentRecord[]>;

  appendAudit(entry: {
    actorId: string | null;
    tenancyId: string | null;
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  listAuditForTenancy(tenancyId: string): Promise<AuditLogEntry[]>;

  exportUserData(userId: string): Promise<Record<string, unknown>>;
}

type Row = Record<string, unknown>;

function nowIso(): string {
  return new Date().toISOString();
}

function str(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== 'string') throw new Error(`Expected string column ${key}`);
  return value;
}

function nullableStr(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

function num(row: Row, key: string): number {
  const value = row[key];
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  throw new Error(`Expected numeric column ${key}`);
}

function bool(row: Row, key: string): boolean {
  return num(row, key) === 1;
}

export class SqliteStore implements Store {
  constructor(private readonly db: Database) {}

  private run(sql: string, params: Array<string | number | null> = []): void {
    this.db.prepare(sql).run(...params);
  }

  private get(sql: string, params: Array<string | number | null> = []): Row | undefined {
    return this.db.prepare(sql).get(...params) as Row | undefined;
  }

  private all(sql: string, params: Array<string | number | null> = []): Row[] {
    return this.db.prepare(sql).all(...params) as Row[];
  }

  async createUser(input: CreateUserInput): Promise<StoredUser> {
    const id = newId('usr');
    const timestamp = nowIso();
    this.run(
      `INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.email, input.name, input.role, input.passwordHash, timestamp, timestamp],
    );
    return {
      id,
      email: input.email,
      name: input.name,
      role: input.role,
      passwordHash: input.passwordHash,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  async getUserByEmail(email: string): Promise<StoredUser | null> {
    const row = this.get('SELECT * FROM users WHERE email = ?', [email]);
    return row ? rowToStoredUser(row) : null;
  }

  async getUserById(id: string): Promise<User | null> {
    const row = this.get('SELECT * FROM users WHERE id = ?', [id]);
    return row ? rowToUser(row) : null;
  }

  async createSession(record: SessionRecord): Promise<void> {
    this.run(
      `INSERT INTO sessions (token_hash, user_id, csrf_token, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [record.tokenHash, record.userId, record.csrfToken, record.createdAt, record.expiresAt],
    );
  }

  async getSession(tokenHash: string): Promise<SessionRecord | null> {
    const row = this.get('SELECT * FROM sessions WHERE token_hash = ?', [tokenHash]);
    if (!row) return null;
    return {
      tokenHash: str(row, 'token_hash'),
      userId: str(row, 'user_id'),
      csrfToken: str(row, 'csrf_token'),
      createdAt: str(row, 'created_at'),
      expiresAt: str(row, 'expires_at'),
    };
  }

  async deleteSession(tokenHash: string): Promise<void> {
    this.run('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
  }

  async deleteSessionsForUser(userId: string): Promise<void> {
    this.run('DELETE FROM sessions WHERE user_id = ?', [userId]);
  }

  async touchSession(tokenHash: string, expiresAt: string): Promise<void> {
    this.run('UPDATE sessions SET expires_at = ? WHERE token_hash = ?', [expiresAt, tokenHash]);
  }

  async createProperty(input: CreatePropertyInput): Promise<Property> {
    const id = newId('prp');
    const timestamp = nowIso();
    this.run(
      `INSERT INTO properties (id, landlord_id, title, address_line, city, state_code, property_type,
        bedrooms, monthly_rent_paise, default_deposit_paise, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.landlordId,
        input.title,
        input.addressLine,
        input.city,
        input.stateCode,
        input.propertyType,
        input.bedrooms,
        input.monthlyRentPaise,
        input.defaultDepositPaise,
        timestamp,
        timestamp,
      ],
    );
    const created = await this.getPropertyById(id);
    if (!created) throw new Error('Failed to read created property');
    return created;
  }

  async getPropertyById(id: string): Promise<Property | null> {
    const row = this.get('SELECT * FROM properties WHERE id = ?', [id]);
    return row ? rowToProperty(row) : null;
  }

  async listPropertiesByLandlord(landlordId: string): Promise<Property[]> {
    return this.all('SELECT * FROM properties WHERE landlord_id = ? ORDER BY created_at DESC', [
      landlordId,
    ]).map(rowToProperty);
  }

  async listPropertiesForTenant(tenantId: string): Promise<Property[]> {
    return this.all(
      `SELECT p.* FROM properties p
       JOIN tenancies t ON t.property_id = p.id
       WHERE t.tenant_id = ? AND t.status = 'active'
       ORDER BY t.created_at DESC`,
      [tenantId],
    ).map(rowToProperty);
  }

  async updateProperty(id: string, patch: Partial<CreatePropertyInput>): Promise<Property> {
    const existing = await this.getPropertyById(id);
    if (!existing) throw new Error('Property not found');
    const merged = {
      title: patch.title ?? existing.title,
      addressLine: patch.addressLine ?? existing.addressLine,
      city: patch.city ?? existing.city,
      stateCode: patch.stateCode ?? existing.stateCode,
      propertyType: patch.propertyType ?? existing.propertyType,
      bedrooms: patch.bedrooms ?? existing.bedrooms,
      monthlyRentPaise: patch.monthlyRentPaise ?? existing.monthlyRentPaise,
      defaultDepositPaise: patch.defaultDepositPaise ?? existing.defaultDepositPaise,
    };
    this.run(
      `UPDATE properties SET title = ?, address_line = ?, city = ?, state_code = ?, property_type = ?,
       bedrooms = ?, monthly_rent_paise = ?, default_deposit_paise = ?, updated_at = ? WHERE id = ?`,
      [
        merged.title,
        merged.addressLine,
        merged.city,
        merged.stateCode,
        merged.propertyType,
        merged.bedrooms,
        merged.monthlyRentPaise,
        merged.defaultDepositPaise,
        nowIso(),
        id,
      ],
    );
    const updated = await this.getPropertyById(id);
    if (!updated) throw new Error('Property not found');
    return updated;
  }

  async deleteProperty(id: string): Promise<void> {
    this.run('DELETE FROM properties WHERE id = ?', [id]);
  }

  async createTenancy(input: CreateTenancyInput): Promise<Tenancy> {
    const id = newId('ten');
    const timestamp = nowIso();
    this.run(
      `INSERT INTO tenancies (id, property_id, landlord_id, tenant_id, tenant_email, start_date, end_date,
        deposit_paise, monthly_rent_paise, status, created_at, responded_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, 'invited', ?, NULL)`,
      [
        id,
        input.propertyId,
        input.landlordId,
        input.tenantEmail,
        input.startDate,
        input.endDate,
        input.depositPaise,
        input.monthlyRentPaise,
        timestamp,
      ],
    );
    const created = await this.getTenancyById(id);
    if (!created) throw new Error('Failed to read created tenancy');
    return created;
  }

  async getTenancyById(id: string): Promise<Tenancy | null> {
    const row = this.get('SELECT * FROM tenancies WHERE id = ?', [id]);
    return row ? rowToTenancy(row) : null;
  }

  async listTenanciesForUser(userId: string): Promise<Tenancy[]> {
    return this.all(
      `SELECT * FROM tenancies WHERE landlord_id = ? OR tenant_id = ? ORDER BY created_at DESC`,
      [userId, userId],
    ).map(rowToTenancy);
  }

  async updateTenancyStatus(
    id: string,
    status: TenancyStatus,
    tenantId?: string | null,
  ): Promise<Tenancy> {
    if (tenantId !== undefined) {
      this.run('UPDATE tenancies SET status = ?, tenant_id = ?, responded_at = ? WHERE id = ?', [
        status,
        tenantId,
        nowIso(),
        id,
      ]);
    } else {
      this.run('UPDATE tenancies SET status = ? WHERE id = ?', [status, id]);
    }
    const updated = await this.getTenancyById(id);
    if (!updated) throw new Error('Tenancy not found');
    return updated;
  }

  async createInspection(input: CreateInspectionInput): Promise<Inspection> {
    const id = newId('ins');
    const timestamp = nowIso();
    this.run(
      `INSERT INTO inspections (id, tenancy_id, stage, area, notes, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.tenancyId, input.stage, input.area, input.notes, input.createdBy, timestamp],
    );
    const created = await this.getInspectionById(id);
    if (!created) throw new Error('Failed to read created inspection');
    return created;
  }

  async getInspectionById(id: string): Promise<Inspection | null> {
    const row = this.get('SELECT * FROM inspections WHERE id = ?', [id]);
    return row ? rowToInspection(row) : null;
  }

  async listInspectionsByTenancy(tenancyId: string): Promise<Inspection[]> {
    return this.all('SELECT * FROM inspections WHERE tenancy_id = ? ORDER BY created_at ASC', [
      tenancyId,
    ]).map(rowToInspection);
  }

  async createEvidence(input: CreateEvidenceInput): Promise<EvidenceAsset> {
    const id = newId('evd');
    const timestamp = nowIso();
    this.run(
      `INSERT INTO evidence_assets (id, tenancy_id, inspection_id, kind, mime, bytes, sha256, storage_key,
        original_name, captured_at, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.tenancyId,
        input.inspectionId,
        input.kind,
        input.mime,
        input.bytes,
        input.sha256,
        input.storageKey,
        input.originalName,
        input.capturedAt,
        input.uploadedBy,
        timestamp,
      ],
    );
    const created = await this.getEvidenceById(id);
    if (!created) throw new Error('Failed to read created evidence');
    return created;
  }

  async getEvidenceById(id: string): Promise<EvidenceAsset | null> {
    const row = this.get('SELECT * FROM evidence_assets WHERE id = ?', [id]);
    return row ? rowToEvidence(row) : null;
  }

  async listEvidenceByTenancy(tenancyId: string): Promise<EvidenceAsset[]> {
    return this.all('SELECT * FROM evidence_assets WHERE tenancy_id = ? ORDER BY created_at ASC', [
      tenancyId,
    ]).map(rowToEvidence);
  }

  async listEvidenceByInspection(inspectionId: string): Promise<EvidenceAsset[]> {
    return this.all(
      'SELECT * FROM evidence_assets WHERE inspection_id = ? ORDER BY created_at ASC',
      [inspectionId],
    ).map(rowToEvidence);
  }

  async createStatement(input: CreateStatementInput): Promise<Statement> {
    const id = newId('stm');
    const timestamp = nowIso();
    this.run(
      `INSERT INTO statements (id, tenancy_id, version, deposit_paise, claimed_paise, approved_deduction_paise,
        protected_paise, shortfall_paise, refund_paise, status, engine, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_acceptance', ?, ?)`,
      [
        id,
        input.tenancyId,
        input.version,
        input.depositPaise,
        input.claimedPaise,
        input.approvedDeductionPaise,
        input.protectedPaise,
        input.shortfallPaise,
        input.refundPaise,
        input.engine,
        timestamp,
      ],
    );
    const created = await this.getStatementById(id);
    if (!created) throw new Error('Failed to read created statement');
    return created;
  }

  async createFindings(inputs: CreateFindingInput[]): Promise<AuditFinding[]> {
    const created: AuditFinding[] = [];
    for (const input of inputs) {
      const id = newId('fin');
      const timestamp = nowIso();
      this.run(
        `INSERT INTO findings (id, tenancy_id, statement_version, area, category, classification, severity,
          benchmark_low_paise, benchmark_high_paise, recommended_deduction_paise, confidence, rationale,
          statutory_note, engine, review_required, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.tenancyId,
          input.statementVersion,
          input.area,
          input.category,
          input.classification,
          input.severity,
          input.benchmarkLowPaise,
          input.benchmarkHighPaise,
          input.recommendedDeductionPaise,
          input.confidence,
          input.rationale,
          input.statutoryNote,
          input.engine,
          input.reviewRequired ? 1 : 0,
          timestamp,
        ],
      );
      created.push({
        id,
        tenancyId: input.tenancyId,
        statementVersion: input.statementVersion,
        area: input.area,
        category: input.category,
        classification: input.classification,
        severity: input.severity,
        benchmarkLowPaise: input.benchmarkLowPaise,
        benchmarkHighPaise: input.benchmarkHighPaise,
        recommendedDeductionPaise: input.recommendedDeductionPaise,
        confidence: input.confidence,
        rationale: input.rationale,
        statutoryNote: input.statutoryNote,
        engine: input.engine,
        reviewRequired: input.reviewRequired,
        createdAt: timestamp,
      });
    }
    return created;
  }

  async getLatestStatement(tenancyId: string): Promise<Statement | null> {
    const row = this.get(
      'SELECT * FROM statements WHERE tenancy_id = ? ORDER BY version DESC LIMIT 1',
      [tenancyId],
    );
    return row ? rowToStatement(row) : null;
  }

  async getStatementById(id: string): Promise<Statement | null> {
    const row = this.get('SELECT * FROM statements WHERE id = ?', [id]);
    return row ? rowToStatement(row) : null;
  }

  async listFindingsByStatement(tenancyId: string, version: number): Promise<AuditFinding[]> {
    return this.all(
      'SELECT * FROM findings WHERE tenancy_id = ? AND statement_version = ? ORDER BY created_at ASC',
      [tenancyId, version],
    ).map(rowToFinding);
  }

  async countStatements(tenancyId: string): Promise<number> {
    const row = this.get('SELECT COUNT(*) AS count FROM statements WHERE tenancy_id = ?', [
      tenancyId,
    ]);
    return row ? num(row, 'count') : 0;
  }

  async updateStatementStatus(
    id: string,
    status: StatementStatus,
    actorRole: 'landlord' | 'tenant',
  ): Promise<Statement> {
    const column = actorRole === 'landlord' ? 'accepted_by_landlord_at' : 'accepted_by_tenant_at';
    this.run(`UPDATE statements SET status = ?, ${column} = ? WHERE id = ?`, [
      status,
      nowIso(),
      id,
    ]);
    const updated = await this.getStatementById(id);
    if (!updated) throw new Error('Statement not found');
    return updated;
  }

  async createDispute(input: CreateDisputeInput): Promise<Dispute> {
    const id = newId('dsp');
    const timestamp = nowIso();
    this.run(
      `INSERT INTO disputes (id, tenancy_id, statement_id, finding_id, raised_by, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
      [
        id,
        input.tenancyId,
        input.statementId,
        input.findingId,
        input.raisedBy,
        input.reason,
        timestamp,
      ],
    );
    const created = await this.getDisputeById(id);
    if (!created) throw new Error('Failed to read created dispute');
    return created;
  }

  async getDisputeById(id: string): Promise<Dispute | null> {
    const row = this.get('SELECT * FROM disputes WHERE id = ?', [id]);
    return row ? rowToDispute(row) : null;
  }

  async listDisputesByTenancy(tenancyId: string): Promise<Dispute[]> {
    return this.all('SELECT * FROM disputes WHERE tenancy_id = ? ORDER BY created_at DESC', [
      tenancyId,
    ]).map(rowToDispute);
  }

  async resolveDispute(id: string, resolvedBy: string, note: string): Promise<Dispute> {
    this.run(
      `UPDATE disputes SET status = 'resolved', resolution_note = ?, resolved_at = ?, resolved_by = ? WHERE id = ?`,
      [note, nowIso(), resolvedBy, id],
    );
    const updated = await this.getDisputeById(id);
    if (!updated) throw new Error('Dispute not found');
    return updated;
  }

  async upsertConsent(
    userId: string,
    purpose: ConsentPurpose,
    granted: boolean,
  ): Promise<ConsentRecord> {
    const existing = this.get('SELECT * FROM consents WHERE user_id = ? AND purpose = ?', [
      userId,
      purpose,
    ]);
    const timestamp = nowIso();
    if (existing) {
      this.run('UPDATE consents SET granted = ?, created_at = ? WHERE id = ?', [
        granted ? 1 : 0,
        timestamp,
        str(existing, 'id'),
      ]);
      return {
        id: str(existing, 'id'),
        userId,
        purpose,
        granted,
        policyVersion: str(existing, 'policy_version'),
        createdAt: timestamp,
      };
    }
    const id = newId('cns');
    const policyVersion = '2026.09';
    this.run(
      `INSERT INTO consents (id, user_id, purpose, granted, policy_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, purpose, granted ? 1 : 0, policyVersion, timestamp],
    );
    return { id, userId, purpose, granted, policyVersion, createdAt: timestamp };
  }

  async listConsents(userId: string): Promise<ConsentRecord[]> {
    return this.all('SELECT * FROM consents WHERE user_id = ? ORDER BY purpose ASC', [userId]).map(
      (row) => ({
        id: str(row, 'id'),
        userId: str(row, 'user_id'),
        purpose: str(row, 'purpose') as ConsentPurpose,
        granted: bool(row, 'granted'),
        policyVersion: str(row, 'policy_version'),
        createdAt: str(row, 'created_at'),
      }),
    );
  }

  async appendAudit(entry: {
    actorId: string | null;
    tenancyId: string | null;
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    this.run(
      `INSERT INTO audit_log (id, actor_id, tenancy_id, action, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        newId('log'),
        entry.actorId,
        entry.tenancyId,
        entry.action,
        JSON.stringify(entry.metadata ?? {}),
        nowIso(),
      ],
    );
  }

  async listAuditForTenancy(tenancyId: string): Promise<AuditLogEntry[]> {
    return this.all('SELECT * FROM audit_log WHERE tenancy_id = ? ORDER BY created_at ASC', [
      tenancyId,
    ]).map((row) => ({
      id: str(row, 'id'),
      actorId: nullableStr(row, 'actor_id'),
      tenancyId: nullableStr(row, 'tenancy_id'),
      action: str(row, 'action'),
      metadata: safeJson(str(row, 'metadata')),
      createdAt: str(row, 'created_at'),
    }));
  }

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.getUserById(userId);
    const tenancies = await this.listTenanciesForUser(userId);
    const consents = await this.listConsents(userId);
    return {
      exportedAt: nowIso(),
      user,
      tenancies,
      consents,
    };
  }
}

function safeJson(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function rowToUser(row: Row): User {
  return {
    id: str(row, 'id'),
    email: str(row, 'email'),
    name: str(row, 'name'),
    role: str(row, 'role') as Role,
    createdAt: str(row, 'created_at'),
    updatedAt: str(row, 'updated_at'),
  };
}

function rowToStoredUser(row: Row): StoredUser {
  return { ...rowToUser(row), passwordHash: str(row, 'password_hash') };
}

function rowToProperty(row: Row): Property {
  return {
    id: str(row, 'id'),
    landlordId: str(row, 'landlord_id'),
    title: str(row, 'title'),
    addressLine: str(row, 'address_line'),
    city: str(row, 'city'),
    stateCode: str(row, 'state_code'),
    propertyType: str(row, 'property_type') as PropertyType,
    bedrooms: num(row, 'bedrooms'),
    monthlyRentPaise: num(row, 'monthly_rent_paise'),
    defaultDepositPaise: num(row, 'default_deposit_paise'),
    createdAt: str(row, 'created_at'),
    updatedAt: str(row, 'updated_at'),
  };
}

function rowToTenancy(row: Row): Tenancy {
  return {
    id: str(row, 'id'),
    propertyId: str(row, 'property_id'),
    landlordId: str(row, 'landlord_id'),
    tenantId: nullableStr(row, 'tenant_id'),
    tenantEmail: str(row, 'tenant_email'),
    startDate: str(row, 'start_date'),
    endDate: nullableStr(row, 'end_date'),
    depositPaise: num(row, 'deposit_paise'),
    monthlyRentPaise: num(row, 'monthly_rent_paise'),
    status: str(row, 'status') as TenancyStatus,
    createdAt: str(row, 'created_at'),
    respondedAt: nullableStr(row, 'responded_at'),
  };
}

function rowToInspection(row: Row): Inspection {
  return {
    id: str(row, 'id'),
    tenancyId: str(row, 'tenancy_id'),
    stage: str(row, 'stage') as InspectionStage,
    area: str(row, 'area'),
    notes: str(row, 'notes'),
    createdBy: str(row, 'created_by'),
    createdAt: str(row, 'created_at'),
  };
}

function rowToEvidence(row: Row): EvidenceAsset {
  return {
    id: str(row, 'id'),
    tenancyId: str(row, 'tenancy_id'),
    inspectionId: str(row, 'inspection_id'),
    kind: str(row, 'kind') as 'photo' | 'video',
    mime: str(row, 'mime'),
    bytes: num(row, 'bytes'),
    sha256: str(row, 'sha256'),
    storageKey: str(row, 'storage_key'),
    originalName: str(row, 'original_name'),
    capturedAt: nullableStr(row, 'captured_at'),
    uploadedBy: str(row, 'uploaded_by'),
    createdAt: str(row, 'created_at'),
  };
}

function rowToStatement(row: Row): Statement {
  return {
    id: str(row, 'id'),
    tenancyId: str(row, 'tenancy_id'),
    version: num(row, 'version'),
    depositPaise: num(row, 'deposit_paise'),
    claimedPaise: num(row, 'claimed_paise'),
    approvedDeductionPaise: num(row, 'approved_deduction_paise'),
    protectedPaise: num(row, 'protected_paise'),
    shortfallPaise: num(row, 'shortfall_paise'),
    refundPaise: num(row, 'refund_paise'),
    status: str(row, 'status') as StatementStatus,
    engine: str(row, 'engine') as 'bedrock' | 'deterministic',
    createdAt: str(row, 'created_at'),
    acceptedByLandlordAt: nullableStr(row, 'accepted_by_landlord_at'),
    acceptedByTenantAt: nullableStr(row, 'accepted_by_tenant_at'),
  };
}

function rowToFinding(row: Row): AuditFinding {
  return {
    id: str(row, 'id'),
    tenancyId: str(row, 'tenancy_id'),
    statementVersion: num(row, 'statement_version'),
    area: str(row, 'area'),
    category: str(row, 'category'),
    classification: str(row, 'classification') as Classification,
    severity: str(row, 'severity') as Severity,
    benchmarkLowPaise: num(row, 'benchmark_low_paise'),
    benchmarkHighPaise: num(row, 'benchmark_high_paise'),
    recommendedDeductionPaise: num(row, 'recommended_deduction_paise'),
    confidence: num(row, 'confidence'),
    rationale: str(row, 'rationale'),
    statutoryNote: str(row, 'statutory_note'),
    engine: str(row, 'engine') as 'bedrock' | 'deterministic',
    reviewRequired: bool(row, 'review_required'),
    createdAt: str(row, 'created_at'),
  };
}

function rowToDispute(row: Row): Dispute {
  return {
    id: str(row, 'id'),
    tenancyId: str(row, 'tenancy_id'),
    statementId: nullableStr(row, 'statement_id'),
    findingId: nullableStr(row, 'finding_id'),
    raisedBy: str(row, 'raised_by'),
    reason: str(row, 'reason'),
    status: str(row, 'status') as DisputeStatus,
    resolutionNote: nullableStr(row, 'resolution_note'),
    createdAt: str(row, 'created_at'),
    resolvedAt: nullableStr(row, 'resolved_at'),
    resolvedBy: nullableStr(row, 'resolved_by'),
  };
}
