PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('tenant', 'landlord')),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  landlord_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  address_line TEXT NOT NULL,
  city TEXT NOT NULL,
  state_code TEXT NOT NULL,
  property_type TEXT NOT NULL,
  bedrooms INTEGER NOT NULL,
  monthly_rent_paise INTEGER NOT NULL,
  default_deposit_paise INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_properties_landlord ON properties(landlord_id);

CREATE TABLE IF NOT EXISTS tenancies (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  landlord_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  tenant_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  tenant_email TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  deposit_paise INTEGER NOT NULL,
  monthly_rent_paise INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('invited', 'active', 'ended', 'cancelled')),
  created_at TEXT NOT NULL,
  responded_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tenancies_property ON tenancies(property_id);
CREATE INDEX IF NOT EXISTS idx_tenancies_landlord ON tenancies(landlord_id);
CREATE INDEX IF NOT EXISTS idx_tenancies_tenant ON tenancies(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_property ON tenancies(property_id) WHERE status IN ('invited', 'active');
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_tenant ON tenancies(tenant_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS inspections (
  id TEXT PRIMARY KEY,
  tenancy_id TEXT NOT NULL REFERENCES tenancies(id) ON DELETE RESTRICT,
  stage TEXT NOT NULL CHECK (stage IN ('move_in', 'move_out')),
  area TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inspections_tenancy ON inspections(tenancy_id);

CREATE TABLE IF NOT EXISTS evidence_assets (
  id TEXT PRIMARY KEY,
  tenancy_id TEXT NOT NULL REFERENCES tenancies(id) ON DELETE RESTRICT,
  inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('photo', 'video')),
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  original_name TEXT NOT NULL,
  captured_at TEXT,
  uploaded_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evidence_tenancy ON evidence_assets(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_evidence_inspection ON evidence_assets(inspection_id);
CREATE INDEX IF NOT EXISTS idx_evidence_sha ON evidence_assets(sha256);

CREATE TABLE IF NOT EXISTS statements (
  id TEXT PRIMARY KEY,
  tenancy_id TEXT NOT NULL REFERENCES tenancies(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL,
  deposit_paise INTEGER NOT NULL,
  claimed_paise INTEGER NOT NULL,
  approved_deduction_paise INTEGER NOT NULL,
  protected_paise INTEGER NOT NULL,
  shortfall_paise INTEGER NOT NULL,
  refund_paise INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'awaiting_acceptance', 'accepted', 'disputed')),
  engine TEXT NOT NULL,
  created_at TEXT NOT NULL,
  accepted_by_landlord_at TEXT,
  accepted_by_tenant_at TEXT,
  UNIQUE (tenancy_id, version)
);
CREATE INDEX IF NOT EXISTS idx_statements_tenancy ON statements(tenancy_id);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  tenancy_id TEXT NOT NULL REFERENCES tenancies(id) ON DELETE RESTRICT,
  statement_version INTEGER NOT NULL,
  area TEXT NOT NULL,
  category TEXT NOT NULL,
  classification TEXT NOT NULL CHECK (classification IN ('WEAR_AND_TEAR', 'DAMAGE', 'PRE_EXISTING', 'UNCERTAIN')),
  severity TEXT NOT NULL CHECK (severity IN ('none', 'minor', 'moderate', 'major')),
  benchmark_low_paise INTEGER NOT NULL,
  benchmark_high_paise INTEGER NOT NULL,
  recommended_deduction_paise INTEGER NOT NULL,
  confidence REAL NOT NULL,
  rationale TEXT NOT NULL,
  statutory_note TEXT NOT NULL DEFAULT '',
  engine TEXT NOT NULL,
  review_required INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_findings_tenancy ON findings(tenancy_id, statement_version);

CREATE TABLE IF NOT EXISTS disputes (
  id TEXT PRIMARY KEY,
  tenancy_id TEXT NOT NULL REFERENCES tenancies(id) ON DELETE RESTRICT,
  statement_id TEXT REFERENCES statements(id) ON DELETE SET NULL,
  finding_id TEXT REFERENCES findings(id) ON DELETE SET NULL,
  raised_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'withdrawn')),
  resolution_note TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_disputes_tenancy ON disputes(tenancy_id);

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('service', 'evidence_retention', 'ai_processing')),
  granted INTEGER NOT NULL,
  policy_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, purpose)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  tenancy_id TEXT REFERENCES tenancies(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_tenancy ON audit_log(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
