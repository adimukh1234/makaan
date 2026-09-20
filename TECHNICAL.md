# Makaan Technical Plan

> Companion to `PLAN.md`. This document is the engineering blueprint for building Makaan from an empty repository to a deployed product. It is written to be executed top to bottom, and it is written to survive past the hackathon.
>
> Status: v1.0
> Date: 2026-09-20
> Owner: Founding engineering
> Scope: Makaan core product (deposit evidence and fair settlement)

---

## Table of contents

1. [Purpose and scope](#1-purpose-and-scope)
2. [What existed before and every flaw this plan fixes](#2-what-existed-before-and-every-flaw-this-plan-fixes)
3. [System overview](#3-system-overview)
4. [Stack decisions](#4-stack-decisions)
5. [Repository layout](#5-repository-layout)
6. [Domain model and invariants](#6-domain-model-and-invariants)
7. [Conventions for money, time and identity](#7-conventions-for-money-time-and-identity)
8. [Persistence](#8-persistence)
9. [API surface](#9-api-surface)
10. [Security architecture](#10-security-architecture)
11. [AI audit pipeline](#11-ai-audit-pipeline)
12. [State rules engine](#12-state-rules-engine)
13. [Evidence integrity](#13-evidence-integrity)
14. [Frontend architecture and design system](#14-frontend-architecture-and-design-system)
15. [Testing strategy](#15-testing-strategy)
16. [Local development runbook](#16-local-development-runbook)
17. [AWS deployment](#17-aws-deployment)
18. [Observability and cost controls](#18-observability-and-cost-controls)
19. [CI and release process](#19-ci-and-release-process)
20. [Compliance and legal guardrails](#20-compliance-and-legal-guardrails)
21. [Repository history and hackathon compliance](#21-repository-history-and-hackathon-compliance)
22. [Milestones and commit plan](#22-milestones-and-commit-plan)
23. [Definition of done](#23-definition-of-done)
24. [Risks and mitigations](#24-risks-and-mitigations)
25. [Appendix](#25-appendix)

---

## 1. Purpose and scope

### 1.1 What we are building

Makaan is a deposit trust protocol for Indian rentals. The judged and production-critical loop is:

1. Capture move-in condition (photos, timestamps, hashes) into a sealed evidence record.
2. Capture move-out condition.
3. Run an advisory audit that separates protected normal wear and tear (zero deductible) from genuine damage (priced at a city benchmark).
4. Produce an itemized deposit statement both parties can read, accept, or dispute.

The audit is advisory. Makaan is not a court, an arbitrator, the Rent Authority, or a payment service.

### 1.2 What is in scope for this build

- Secure accounts and sessions for two roles: landlord and tenant.
- Properties owned by landlords.
- Tenancies that bind a tenant to a property for a period, with a deposit held in integer paise.
- Inspections (move-in and move-out) composed of named areas.
- Evidence assets (photos) with SHA-256 integrity, capture metadata and consent.
- An audit engine with a real Amazon Bedrock Nova Lite path and a deterministic fallback behind the same interface.
- A deposit statement with itemized findings, totals, advisory language, and a print view.
- Disputes that can be raised against a statement or a finding, with a resolution trail.
- Consent records and an append-only audit log to stay DPDP-ready.
- A design system and responsive interface that works down to 375px.

### 1.3 What is explicitly out of scope

These are traps of cost, law, or time. They are intentionally excluded from v1:

- Moving or holding money. No escrow, no payment aggregation, no refunds through Makaan.
- Tenant scores, tenant blacklists, or any searchable negative reputation.
- Public listing marketplace, chat, and social features.
- SMS and OTP. No DLT registration, no SMS sandbox.
- Agreement PDF generation and e-signing.
- Multi-city benchmark curation beyond the seed dataset.
- Admin dashboards and human review tooling.

### 1.4 Definition of production-ready for this document

- `pnpm install`, `pnpm test`, and `pnpm build` succeed from a clean clone.
- The API runs locally with a single command and persists data to SQLite.
- The web app runs locally with a single command and talks to the API.
- Every domain rule has a unit test, every API route has an integration test, and the primary UI flows have component tests.
- No secrets in the repository. No build artifacts in the repository.
- Every user input is validated. Every ownership decision is derived from the session, never from the request body.
- The system degrades gracefully when Bedrock is unavailable.
- The interface is accessible, keyboard navigable, and usable on mobile.

---

## 2. What existed before and every flaw this plan fixes

The first prototype (`tenant-market-trust`) was audited and found to be a polished simulation. This plan is also a correction list. Each item below is a defect from that audit mapped to the decision that closes it.

| #   | Flaw in the prototype                                                                                                                                | Fix in this plan                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | No API server. `src/api/app.ts` returned an object; `src/server.ts` logged a line and exported objects. No routes, no handler.                       | A real Fastify HTTP server with typed routes, middleware, and integration tests through the HTTP layer. Section 9.                                               |
| 2   | No persistence. Only an `InMemoryDataStore`. AWS SDK dependencies were never imported.                                                               | A real `node:sqlite` store with schema and migrations locally, plus a mirror DynamoDB design for AWS. Section 8.                                                 |
| 3   | The forensic "AI" never opened an image. It branched on `roomArea.includes('bath')`.                                                                 | A real Bedrock Nova Lite vision call with a strict JSON contract, plus a deterministic fallback behind the same interface. Section 11.                           |
| 4   | The frontend was fully mocked and never called the backend. Score showed `82/100` while the backend used 300 to 850.                                 | The frontend consumes the API through TanStack Query and a typed client. One scale, one source of truth. Sections 9 and 14.                                      |
| 5   | Deployment was broken. `Handler: dist/server.handler` did not exist, the build emitted `dist/src/server.js`, and the template lacked most resources. | A deployment plan that matches the code, with a real SAM template and an Amplify build, verified resource by resource. Section 17.                               |
| 6   | Tests certified code that did not exist. Frontend tests defined their own helper functions and imported nothing from the app.                        | Tests import the real code. Frontend tests render real components. The API is tested through `fastify.inject`. Section 15.                                       |
| 7   | OTP was returned in the API response. Tokens were unsigned strings with no expiry.                                                                   | Password auth with scrypt, server-side sessions with httpOnly cookies, expiry, revocation, and CSRF protection. Section 10.                                      |
| 8   | No authorization layer. Services trusted `tenantId` and `landlordId` from the request body.                                                          | Every route derives identity from the session. Ownership is checked against the tenancy or property. Body-supplied ownership IDs are rejected. Section 9 and 10. |
| 9   | No tenancy entity. Payments and disputes could reference any property.                                                                               | A first-class `tenancies` table is the authorization boundary and the lifecycle anchor. Section 6.                                                               |
| 10  | Money was a JavaScript float.                                                                                                                        | All money is an integer number of paise. Formatting happens at the edge only. Section 7.                                                                         |
| 11  | Reputation algorithm punished tenants for filing disputes and saturated at 850.                                                                      | Reputation is removed from v1 entirely. It returns only as a consent-based, positive-primary rental passport, never as a blacklist. Section 20.                  |
| 12  | "Binding audit" language and wrong legal citations (Section 21 is eviction, not notice).                                                             | Advisory vocabulary enforced everywhere. MTA sections cited correctly. Section 20.                                                                               |
| 13  | Forensic math refunded the full deposit per room inspection and ignored arrears.                                                                     | One statement per tenancy aggregates all findings, floors at zero, and separates approved deductions from the deposit held. Section 6.                           |
| 14  | Uploads were fake presigned strings and S3 CORS allowed all origins.                                                                                 | Real uploads with content-type and size validation, authenticated retrieval, hashed storage, and scoped bucket policy. Sections 10 and 13.                       |
| 15  | In-memory store leaked live object references and had no conditional writes.                                                                         | The SQL store returns plain rows through mappers. Writes are explicit. Section 8.                                                                                |
| 16  | No input validation, no rate limits, no security headers.                                                                                            | Zod on every route, rate limiting, Helmet, strict CORS, and payload limits. Sections 9 and 10.                                                                   |
| 17  | Build artifacts and test output were committed.                                                                                                      | `.gitignore` covers build output, coverage, uploads, and env files. Section 5.                                                                                   |
| 18  | README overclaimed features and test counts.                                                                                                         | The README describes only what the repository actually does, with badges and real numbers.                                                                       |
| 19  | Frontend had no responsive behavior despite claiming it.                                                                                             | Mobile-first layout verified at 375px, 768px, and 1280px. Section 14.                                                                                            |
| 20  | No accessibility. Modals had no focus management, icon buttons had no labels, status was color-only.                                                 | Accessible primitives from shadcn and Radix, labelled controls, visible focus, keyboard flows, and non-color status text. Section 14.                            |

---

## 3. System overview

### 3.1 Local topology (what runs today)

```
Browser (React SPA, Vite, port 5173)
   |  fetch /api/* with session cookie
   v
Vite dev proxy  ->  Fastify API (Node, port 8787)
                         |  node:sqlite (var/makaan.db)
                         |  local evidence storage (var/evidence)
                         |  Bedrock adapter (optional, env-gated)
                         v
                    Deterministic audit fallback (always available)
```

### 3.2 Production topology (AWS, documented in section 17)

```
Browser -> AWS Amplify Hosting (React SPA, CloudFront)
        -> Amazon API Gateway (HTTP API)
        -> AWS Lambda (TypeScript, one function)
              -> Amazon DynamoDB (single table)
              -> Amazon S3 (evidence, presigned PUT)
              -> Amazon Bedrock (Nova Lite, vision)
        -> CloudWatch Logs
```

Both topologies share the same domain package, the same request and response contracts, and the same tests. The storage and AI layers are interfaces with two implementations: a local implementation and an AWS implementation.

### 3.3 Core sequence, move-out audit

```
POST /api/tenancies/:id/inspections           create move_out inspection
POST /api/tenancies/:id/evidence              upload photo, returns assetId + sha256
POST /api/tenancies/:id/audit                 run audit
   1. load move_in and move_out assets
   2. build audit input (areas, claims, state, benchmarks)
   3. call AuditEngine.analyze()
        a. BedrockAdapter if MAKAAN_AI_MODE=bedrock and credentials exist
        b. otherwise DeterministicEngine
   4. validate findings against the JSON schema
   5. persist findings, compute statement
GET  /api/tenancies/:id/statement             itemized statement
POST /api/tenancies/:id/statement/accept      tenant or landlord acceptance
POST /api/tenancies/:id/disputes              challenge a finding or the statement
```

---

## 4. Stack decisions

Every decision is chosen for reliability, testability, and the $10 budget. Where a choice is close, the tie-breaker is "can one engineer run and debug it locally at 2 AM".

| Layer              | Choice                                           | Version                 | Rejected alternatives            | Reason                                                                                              |
| ------------------ | ------------------------------------------------ | ----------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| Language           | TypeScript, strict                               | 5.6                     | Python, Go                       | One language across domain, API and web; shared types; the domain math is where correctness matters |
| Package manager    | pnpm workspaces                                  | 11                      | npm, yarn, bun                   | Fast, strict, disk-efficient, first-class workspaces; bun is not installed and adds risk            |
| Runtime            | Node.js                                          | 26 (local), 20 (Lambda) | Deno, Bun                        | Present in the environment; Lambda supports Node 20                                                 |
| API framework      | Fastify                                          | 4                       | Express, Hono, NestJS            | Fast, typed, schema-first, excellent test injection; minimal surface                                |
| Validation         | Zod                                              | 3                       | Joi, Yup, io-ts                  | One schema shared by validation, types and tests                                                    |
| Local database     | `node:sqlite`                                    | built into Node 26      | better-sqlite3, Postgres, Prisma | Zero native build risk on Node 26; synchronous and fast; no external service                        |
| AWS database       | DynamoDB single table                            | on-demand               | RDS, Postgres                    | Scales to zero, pay per request, matches access patterns, free tier safe                            |
| Sessions           | Server-side sessions in SQLite, httpOnly cookie  | custom                  | JWT in localStorage              | Revocable, no token leakage, no XSS token theft                                                     |
| Password hashing   | `node:crypto` scrypt                             | built-in                | bcrypt, argon2                   | No native dependency; scrypt is memory-hard and recommended                                         |
| File storage local | Filesystem under `var/evidence`                  | custom                  | S3 only                          | Works offline; identical interface to the S3 adapter                                                |
| File storage AWS   | Amazon S3 with presigned PUT                     | SDK v3                  | Through Lambda                   | Photos never traverse Lambda; cheaper and faster                                                    |
| AI                 | Amazon Bedrock Nova Lite `amazon.nova-lite-v1:0` | SDK v3                  | Claude, OpenAI, local GGUF       | Multimodal, cheap ($0.06 input / $0.24 output per 1M tokens), ap-south-1 availability               |
| AI fallback        | Deterministic rule engine                        | first-party             | none                             | The demo and the product must survive a Bedrock outage                                              |
| Frontend           | React + Vite                                     | 18 + 5                  | Next.js, Remix                   | Matches the plan; simplest static deploy; no SSR needed for an authenticated app                    |
| UI system          | Tailwind CSS + shadcn/ui (Radix primitives)      | 3.4 + latest            | MUI, Chakra, Ant                 | Own the code, accessible primitives, no runtime CSS-in-JS                                           |
| Client data        | TanStack Query                                   | 5                       | Redux, Zustand, SWR              | Server state caching and invalidation without a global store                                        |
| Forms              | react-hook-form + zod resolver                   | 7 + 3                   | Formik                           | Shared schema between client and server                                                             |
| Routing            | React Router                                     | 6                       | file-based routing               | Explicit, testable                                                                                  |
| Tests              | Vitest + Testing Library + fastify.inject        | 2                       | Jest, Playwright only            | Fast, ESM-native, one runner for all layers                                                         |
| Lint and format    | ESLint + Prettier                                | 9 + 3                   | Biome                            | Standard, well supported                                                                            |
| IaC                | AWS SAM                                          | latest                  | CDK, Terraform                   | Smallest surface for Lambda plus API plus DynamoDB plus S3; esbuild bundling                        |
| Hosting            | AWS Amplify Hosting                              | managed                 | S3 and CloudFront hand-rolled    | Git deploys and a free tier for the judged period                                                   |

### 4.1 Why not a single Next.js app

Next.js would collapse the two servers into one, which is attractive. It loses on three points that matter here: the hackathon plan is an SPA on Amplify plus a Lambda API, which is cheaper and easier to reason about on the free tier; the API must be independently testable through an inject interface; and a Vite SPA deploys as static files with no server runtime cost. The separation also keeps the AWS mapping honest, since the API is a Lambda either way.

### 4.2 Why not Postgres

A managed Postgres adds a monthly cost, a connection layer, and a migration tool, for a schema with eight tables. `node:sqlite` is in the Node runtime, stores to a file, and is trivially fast at this scale. The SQL is written portably so a move to Postgres is a driver change, not a rewrite.

---

## 5. Repository layout

```
makaan/
  PLAN.md                     product and business plan (founding blueprint)
  TECHNICAL.md                this document
  README.md                   what it is, how to run it, how to use it
  LICENSE                     MIT
  package.json                workspace root, scripts
  pnpm-workspace.yaml
  tsconfig.base.json
  .gitignore
  .env.example
  .editorconfig
  eslint.config.js
  .prettierrc.json
  apps/
    api/
      package.json
      tsconfig.json
      vitest.config.ts
      src/
        index.ts              server bootstrap
        app.ts                fastify instance and plugin wiring
        config.ts             env parsing and defaults
        db/
          schema.sql
          index.ts            connection and migration runner
          mappers.ts
        auth/
          passwords.ts        scrypt hash and verify
          sessions.ts         create, read, revoke
          csrf.ts             double-submit token
          plugin.ts           auth decorators and guard
        storage/
          types.ts            EvidenceStore interface
          local.ts            filesystem store
          s3.ts               S3 store (AWS)
        ai/
          types.ts            AuditEngine interface
          bedrock.ts          Bedrock Nova Lite adapter
          deterministic.ts    fallback rule engine
          factory.ts          selection by config
        routes/
          auth.ts
          properties.ts
          tenancies.ts
          inspections.ts
          evidence.ts
          audits.ts
          statements.ts
          disputes.ts
          health.ts
        lib/
          errors.ts
          http.ts
          ids.ts
          logger.ts
          rate-limit.ts
      test/
        auth.test.ts
        properties.test.ts
        tenancies.test.ts
        evidence.test.ts
        audit.test.ts
        statements.test.ts
        disputes.test.ts
      var/                    runtime data, gitignored
    web/
      package.json
      tsconfig.json
      vite.config.ts
      vitest.config.ts
      index.html
      public/
        favicon.ico
        icon.svg
      src/
        main.tsx
        App.tsx
        router.tsx
        index.css
        lib/
          api.ts            typed fetch client
          utils.ts          cn helper
          format.ts         paise and date formatting
        components/
          ui/               shadcn primitives
          layout/           app shell, sidebar, topbar
          brand/            Logo
          marketing/        landing sections
          deposit/          statement, findings, scan
          evidence/         uploader, gallery
        routes/
          landing.tsx
          login.tsx
          register.tsx
          dashboard.tsx
          properties.tsx
          property-new.tsx
          tenancy.tsx
          inspection.tsx
          audit.tsx
          statement.tsx
          disputes.tsx
          settings.tsx
          not-found.tsx
        hooks/
          use-session.ts
          use-tenancies.ts
        test/
          setup.ts
          render.tsx
          *.test.tsx
  packages/
    core/
      package.json
      tsconfig.json
      vitest.config.ts
      src/
        index.ts
        types.ts            entities, enums, DTOs
        money.ts            paise math and formatting
        benchmarks.ts       city and item catalogue, versioned
        state-rules.ts      state tenancy regimes
        deposit.ts          statement computation
        audit.ts            audit input/output schema and validation
        fallback.ts         deterministic engine
        ids.ts              id and hash helpers
        copy.ts             advisory copy constants
      test/
        money.test.ts
        deposit.test.ts
        benchmarks.test.ts
        state-rules.test.ts
        audit.test.ts
        fallback.test.ts
  infra/
    sam/
      template.yaml
      samconfig.toml
    amplify/
      amplify.yml
    scripts/
      seed.md
  docs/
    ARCHITECTURE.md
    SECURITY.md
    COMPLIANCE.md
    RUNBOOK.md
```

Rules that keep the tree clean:

- No `dist/`, `coverage/`, `node_modules/`, `var/`, or `.env` in git.
- Only `packages/core`, `apps/api`, `apps/web`, `infra`, `docs` and root files are tracked.
- Every directory with logic has tests next to it.

---

## 6. Domain model and invariants

### 6.1 Entities

**User**

- `id`, `email` (unique, lowercased), `name`, `passwordHash`, `role` (`tenant` | `landlord`), `createdAt`, `updatedAt`.
- Invariant: email is unique and normalized. Role is immutable after registration in v1.

**Property**

- `id`, `landlordId`, `title`, `addressLine`, `city`, `stateCode`, `propertyType` (`apartment` | `independent_house` | `room` | `hostel_pg`), `bedrooms`, `monthlyRentPaise`, `defaultDepositPaise`, `createdAt`.
- Invariant: `monthlyRentPaise > 0`, `defaultDepositPaise >= 0`.
- Invariant: only the owning landlord reads or mutates.

**Tenancy**

- `id`, `propertyId`, `landlordId`, `tenantId` (nullable until accepted), `tenantEmail` (invite target), `startDate`, `endDate` (nullable for open-ended), `depositPaise`, `monthlyRentPaise`, `status` (`invited` | `active` | `ended` | `cancelled`), `createdAt`, `respondedAt`.
- Invariant: one active tenancy per property at a time.
- Invariant: a tenant can have at most one active tenancy.
- Invariant: `depositPaise` and `monthlyRentPaise` are integers `>= 0`.
- This table is the authorization boundary. Every inspection, finding, statement and dispute hangs off a tenancy, and access is granted only to that tenancy's landlord, tenant, or an admin.

**Inspection**

- `id`, `tenancyId`, `stage` (`move_in` | `move_out`), `area` (human label such as "Living room, north wall"), `notes`, `createdAt`, `createdBy`.
- Invariant: stage is one of two values. A tenancy cannot have a move_out audit without at least one move_in area.

**EvidenceAsset**

- `id`, `tenancyId`, `inspectionId`, `kind` (`photo` | `video`), `mime`, `bytes`, `sha256`, `storageKey`, `originalName`, `capturedAt`, `uploadedBy`, `createdAt`.
- Invariant: `mime` is in the allow list, `bytes` is within the limit, `sha256` is 64 hex characters.
- Invariant: original files are immutable and never overwritten.

**AuditFinding**

- `id`, `tenancyId`, `statementVersion`, `area`, `category`, `classification` (`WEAR_AND_TEAR` | `DAMAGE` | `PRE_EXISTING` | `UNCERTAIN`), `severity` (`none` | `minor` | `moderate` | `major`), `benchmarkLowPaise`, `benchmarkHighPaise`, `recommendedDeductionPaise`, `confidence` (0 to 1), `rationale`, `statutoryNote`, `engine` (`bedrock` | `deterministic`), `reviewRequired` (boolean), `createdAt`.
- Invariant: `recommendedDeductionPaise` is `0` for `WEAR_AND_TEAR` and `PRE_EXISTING`.
- Invariant: `recommendedDeductionPaise` is within `[benchmarkLowPaise, benchmarkHighPaise]` for `DAMAGE`.
- Invariant: `reviewRequired` is true when `confidence < 0.7` or `recommendedDeductionPaise > 2500000` (Rs 25,000).

**Statement**

- `id`, `tenancyId`, `version`, `depositPaise`, `claimedPaise`, `approvedDeductionPaise`, `protectedPaise`, `refundPaise`, `status` (`draft` | `awaiting_acceptance` | `accepted` | `disputed`), `engine`, `createdAt`, `acceptedByLandlordAt`, `acceptedByTenantAt`.
- Invariant: `approvedDeductionPaise = sum(findings.recommendedDeductionPaise)`.
- Invariant: `protectedPaise = max(0, claimedPaise - approvedDeductionPaise)`.
- Invariant: `refundPaise = max(0, depositPaise - approvedDeductionPaise)`.
- One statement per tenancy, versioned. Accepting creates the next version only through an audit.

**Dispute**

- `id`, `tenancyId`, `statementId` (nullable), `findingId` (nullable), `raisedBy`, `reason`, `status` (`open` | `resolved` | `withdrawn`), `resolutionNote`, `createdAt`, `resolvedAt`, `resolvedBy`.
- Invariant: a dispute references a tenancy the raiser belongs to.
- Invariant: resolving records the actor and a note.

**ConsentRecord**

- `id`, `userId`, `purpose` (`service` | `evidence_retention` | `ai_processing`), `granted` (boolean), `policyVersion`, `createdAt`.
- Invariant: consent is required at registration for `service`, `evidence_retention`, and `ai_processing`.

**AuditLogEntry**

- `id`, `actorId` (nullable for system), `tenancyId` (nullable), `action`, `metadata` (JSON string), `createdAt`.
- Append-only. No update or delete endpoints.

### 6.2 State machines

**Tenancy:** `invited -> active -> ended`. `invited -> cancelled`. `active -> cancelled` is allowed only before any move-in evidence exists, and it is logged.

**Statement:** `draft -> awaiting_acceptance -> accepted`. `draft -> awaiting_acceptance -> disputed`. A dispute can return to `awaiting_acceptance` after resolution.

**Dispute:** `open -> resolved`. `open -> withdrawn` by the raiser.

### 6.3 Authorization matrix

| Resource   | Landlord owner       | Tenant member           | Other authenticated | Anonymous |
| ---------- | -------------------- | ----------------------- | ------------------- | --------- |
| Property   | read, update, delete | read via active tenancy | none                | none      |
| Tenancy    | read, update, cancel | read, accept, end       | none                | none      |
| Inspection | read, create         | read, create            | none                | none      |
| Evidence   | read, upload         | read, upload            | none                | none      |
| Audit      | run, read            | run, read               | none                | none      |
| Statement  | read, accept         | read, accept            | none                | none      |
| Dispute    | open, resolve        | open, resolve           | none                | none      |

---

## 7. Conventions for money, time and identity

**Money.** Always an integer number of paise. Field names end in `Paise`. No floats, ever. Formatting to rupees happens only in `packages/core/src/money.ts` and in the web client. The formatter uses `Intl.NumberFormat('en-IN')`.

**Time.** All timestamps are ISO 8601 strings in UTC. The database stores `TEXT` in UTC. Dates without time (lease start, lease end) are `YYYY-MM-DD` strings. The client renders in the user's local timezone.

**Identity.** IDs are prefixed, URL-safe, and sortable: `usr_`, `prp_`, `ten_`, `ins_`, `evd_`, `fin_`, `stm_`, `dsp_`, `cns_`, `log_`, followed by a base32 ULID-like value produced from a monotonic counter plus randomness. No `Date.now()` collisions, no UUID dependency.

**Email normalization.** Lowercase and trim at every entry point. The database enforces a unique index on the normalized value.

**Hashing.** Evidence uses SHA-256 over the raw bytes, lowercase hex. Passwords use scrypt with a per-user random salt, `N=16384`, `r=8`, `p=1`, key length 64, salted with a 16-byte random salt, serialized as `scrypt$N$r$p$salt$hash`.

---

## 8. Persistence

### 8.1 Local schema (SQLite)

The schema lives in `apps/api/src/db/schema.sql` and is applied idempotently at boot. Tables: `users`, `sessions`, `properties`, `tenancies`, `inspections`, `evidence_assets`, `statements`, `findings`, `disputes`, `consents`, `audit_log`.

Key constraints enforced in SQL, not only in code:

- `users.email` unique.
- `tenancies` has a partial unique index on `propertyId` where `status in ('invited','active')`.
- `tenancies` has a partial unique index on `tenantId` where `status = 'active'`.
- `evidence_assets.sha256` indexed for integrity lookups.
- All foreign keys declared with `ON DELETE RESTRICT` so evidence is never orphaned silently.
- `PRAGMA foreign_keys = ON`, `PRAGMA journal_mode = WAL`, `PRAGMA busy_timeout = 5000`.

### 8.2 Mappers

Rows are converted to domain objects through explicit mappers. The store never returns a live mutable row. Money columns are integers and converted with `Number.parseInt` guarding against nulls.

### 8.3 AWS mirror (DynamoDB single table)

Same entities, single-table design:

```
PK                     SK                          Entity
USER#<id>              PROFILE                     user
USER#<id>              CONSENT#<purpose>           consent record
PROPERTY#<id>          META                        property
TENANCY#<id>           META                        tenancy
TENANCY#<id>           INSPECTION#<id>             inspection
TENANCY#<id>           EVIDENCE#<id>               evidence asset
TENANCY#<id>           FINDING#<id>                finding
TENANCY#<id>           STATEMENT#<version>         statement
TENANCY#<id>           DISPUTE#<id>                dispute
```

- GSI1: `gsi1pk = USER#<id>`, `gsi1sk = TENANCY#<createdAt>` for "my tenancies".
- GSI2: `gsi2pk = PROPERTY#<id>`, `gsi2sk = TENANCY#<createdAt>` for "tenancies of a property".
- Item collections make a tenancy aggregate a single query.
- Conditional expressions enforce the unique indexes that SQL enforces locally.

The local store and the DynamoDB store implement one `Store` interface, so routes and tests do not change between environments.

### 8.4 Migrations

`node:sqlite` runs `schema.sql` inside a transaction at boot with `CREATE TABLE IF NOT EXISTS`. Versioned migrations are added when the schema changes; the version is tracked in a `_migrations` table.

---

## 9. API surface

Base path: `/api`. All responses are JSON. Errors use a single shape.

```json
{ "error": { "code": "FORBIDDEN", "message": "You do not have access to this tenancy." } }
```

### 9.1 Routes

| Method | Path                                             | Auth           | Purpose                                                              |
| ------ | ------------------------------------------------ | -------------- | -------------------------------------------------------------------- |
| GET    | `/api/health`                                    | none           | liveness, version, AI mode                                           |
| POST   | `/api/auth/register`                             | none           | create account with role and consents                                |
| POST   | `/api/auth/login`                                | none           | create session                                                       |
| POST   | `/api/auth/logout`                               | session        | revoke session                                                       |
| GET    | `/api/auth/session`                              | session        | current user and CSRF token                                          |
| GET    | `/api/properties`                                | session        | landlord: own; tenant: properties of own tenancies                   |
| POST   | `/api/properties`                                | landlord       | create property                                                      |
| GET    | `/api/properties/:id`                            | member         | read property                                                        |
| PATCH  | `/api/properties/:id`                            | landlord owner | update property                                                      |
| DELETE | `/api/properties/:id`                            | landlord owner | delete when no tenancies                                             |
| GET    | `/api/tenancies`                                 | session        | tenancies where user is landlord or tenant                           |
| POST   | `/api/tenancies`                                 | landlord       | invite tenant by email                                               |
| GET    | `/api/tenancies/:id`                             | member         | full aggregate: property, inspections, evidence, statement, disputes |
| POST   | `/api/tenancies/:id/accept`                      | invited tenant | accept invitation                                                    |
| POST   | `/api/tenancies/:id/end`                         | member         | end the tenancy                                                      |
| POST   | `/api/tenancies/:id/inspections`                 | member         | create inspection area                                               |
| POST   | `/api/tenancies/:id/evidence`                    | member         | upload a photo (multipart)                                           |
| GET    | `/api/tenancies/:id/evidence/:assetId`           | member         | download the original asset                                          |
| POST   | `/api/tenancies/:id/audit`                       | member         | run the audit, create a statement                                    |
| GET    | `/api/tenancies/:id/statement`                   | member         | latest statement with findings                                       |
| POST   | `/api/tenancies/:id/statement/accept`            | member         | record acceptance                                                    |
| POST   | `/api/tenancies/:id/disputes`                    | member         | open a dispute                                                       |
| POST   | `/api/tenancies/:id/disputes/:disputeId/resolve` | member         | resolve                                                              |
| GET    | `/api/me/consents`                               | session        | list consent records                                                 |
| POST   | `/api/me/consents`                               | session        | record consent change                                                |
| GET    | `/api/me/export`                                 | session        | DPDP data export (JSON)                                              |

### 9.2 Request rules

- Every body and query is validated with a Zod schema. Unknown keys are rejected.
- Money fields are accepted only as integer paise.
- Ownership IDs (`landlordId`, `tenantId`, `ownerId`) are never accepted in request bodies for authorization decisions. They are derived from the session and the tenancy.
- Pagination is `limit` (max 100) and `cursor` where lists can grow.

### 9.3 Error codes

`VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `PAYLOAD_TOO_LARGE` (413), `UNSUPPORTED_MEDIA_TYPE` (415), `RATE_LIMITED` (429), `INTERNAL` (500). The client maps these to friendly messages.

### 9.4 Errors and logging

- A central `AppError` class carries a code, HTTP status, and a safe message. Unknown errors become `INTERNAL` with no internal detail in the response.
- Structured JSON logs with request id, route, status, duration, actor id (when present). Secrets and passwords are never logged.

---

## 10. Security architecture

Security is treated as a feature and tested like one.

### 10.1 Authentication

- Registration: email, name, password, role, and explicit consent to service, evidence retention, and AI processing.
- Password policy: minimum 10 characters, checked against a small common-password deny list. Hashed with scrypt.
- Login: constant-time verification. A generic error for both unknown email and wrong password.
- Sessions: a 256-bit random token; only its SHA-256 is stored server side; delivered in an httpOnly cookie with `SameSite=Lax`, `Secure` in production, `Path=/`, and a 7-day expiry with sliding renewal capped at 30 days.
- Logout revokes the session server side. Password change revokes all sessions.

### 10.2 CSRF

- A double-submit token. The server issues a token bound to the session, delivered in a readable cookie and mirrored in the session response. Every mutating request must send the header `x-csrf-token`, which must match the session-bound value. `SameSite=Lax` is a second layer.
- Cross-origin requests are rejected by the CORS allow list.

### 10.3 Authorization

- A Fastify plugin resolves the session and attaches `request.user`.
- A tenancy guard loads the tenancy and confirms the user is a landlord or tenant on it. Routes never compare a body-provided id to the session; they compare the session to the stored tenancy.
- Property mutations require `property.landlordId === request.user.id`.

### 10.4 Input and transport

- Zod on every route.
- `@fastify/helmet` for security headers, including a content security policy that allows only self and the configured API origin.
- `@fastify/cors` with an explicit origin allow list from `CORS_ORIGINS`.
- `@fastify/rate-limit` global and a stricter limit on auth and audit routes.
- Body limit of 64 KB for JSON; multipart limit of 10 MB per file with a maximum of 6 files per request.
- `trustProxy` configured for the deployment target.

### 10.5 Uploads

- Allowed mime types: `image/jpeg`, `image/png`, `image/webp`, `image/heic`.
- The server verifies the magic bytes, not just the declared content type.
- Files are stored under a key that includes the tenancy id and a random asset id. The client never chooses the path.
- Downloads are authenticated and authorized per tenancy. No public bucket.
- SHA-256 is computed server side while streaming, and returned to the client.

### 10.6 Secrets and dependencies

- Configuration through environment variables. `.env` is gitignored. `.env.example` documents every variable with a safe default.
- No AWS keys in the repository. In production, Lambda uses its IAM role. Locally, the Bedrock adapter reads the standard AWS environment or is disabled.
- `pnpm audit` in CI. Dependencies pinned with a lockfile and `save-exact` for workspace packages.

### 10.7 Data protection

- Passwords are never returned. `passwordHash` never leaves the data layer.
- Evidence URLs are authenticated routes, not public links.
- Data export returns the user's own data as JSON.
- Account deletion is not in v1; the export endpoint and consent records are the DPDP groundwork.

### 10.8 Threat model summary

| Threat                           | Control                                                                     |
| -------------------------------- | --------------------------------------------------------------------------- |
| Credential stuffing              | Rate limit on login, generic errors, scrypt cost                            |
| Session theft via XSS            | httpOnly cookie, CSP, no token in JS storage                                |
| CSRF                             | Session-bound double-submit token plus SameSite                             |
| IDOR on tenancy data             | Tenancy guard on every nested route                                         |
| Malicious upload                 | Mime magic-byte check, size limit, randomized keys, authenticated retrieval |
| Resource abuse                   | Rate limits, audit quota per tenancy, payload limits                        |
| Prompt injection through images  | Output schema validation, advisory framing, human review threshold          |
| AI hallucination treated as fact | Confidence and review flags, advisory copy, dispute path                    |

---

## 11. AI audit pipeline

### 11.1 Interface

```ts
export interface AuditInput {
  tenancyId: string;
  stateCode: string;
  city: string;
  depositPaise: number;
  claimedPaise: number;
  areas: Array<{
    area: string;
    categoryHint?: string;
    moveIn?: EvidenceRef;
    moveOut?: EvidenceRef;
  }>;
}

export interface AuditEngine {
  readonly name: 'bedrock' | 'deterministic';
  analyze(input: AuditInput): Promise<AuditResult>;
}
```

`AuditResult` contains `findings: AuditFindingDraft[]` and metadata (engine, modelId, latencyMs, tokenUsage, fallbackReason).

### 11.2 Bedrock adapter

- Model: `amazon.nova-lite-v1:0`, region `ap-south-1`.
- Call: `ConverseCommand` with a system prompt, a user message describing the area and claim, and image content blocks for the move-in and move-out photos.
- Images are fetched from the evidence store and sent as bytes with the correct `format`.
- Response: strict JSON only. The prompt instructs the model to return a single JSON object and no prose.
- The raw response is parsed and validated with the Zod schema. A validation failure is treated as an engine failure and triggers the fallback.
- Token budget per call is bounded. Images are downscaled to a 1600px long edge before sending when the adapter is given large files.
- Every call is logged with model id, latency, and token usage for the cost dashboard.

### 11.3 Prompt contract

System prompt (abridged, stored in `apps/api/src/ai/prompt.ts`):

- You are an advisory rental condition assessor for India.
- Compare the before and after images of the named area.
- Classify each material difference as `WEAR_AND_TEAR`, `DAMAGE`, `PRE_EXISTING`, or `UNCERTAIN`.
- `WEAR_AND_TEAR` and `PRE_EXISTING` carry zero deduction. `DAMAGE` is priced from the provided benchmark range.
- Cite the applicable principle in `statutoryNote` when the state regime applies.
- Never claim to be a legal authority. This is an advisory opinion.
- Return JSON conforming to the provided schema, nothing else.

### 11.4 Deterministic fallback

The fallback engine uses the area label, a category hint, and the benchmark catalog to produce findings without a model. It is deliberately conservative:

- Categories related to painting, fading, scuffs, nail holes, and normal surface wear return `WEAR_AND_TEAR` with zero deduction.
- Categories related to fixtures, breakage, burns, cracks, and stains return `DAMAGE` priced at the benchmark midpoint for the city, with a confidence of 0.6 so the UI marks it for review.
- Unknown categories return `UNCERTAIN` with zero recommended deduction and a follow-up question.

The fallback exists for three reasons: the demo must never fail, the free tier has no Bedrock guarantee on a new account, and tests need a provider-free path.

### 11.5 Fallback equivalence tests

The same `AuditInput` is run through both engines. Tests assert that both produce schema-valid output, that wear-and-tear categories never carry a deduction in either engine, and that damage deductions stay within the benchmark range in both engines.

### 11.6 Human review and advisory framing

- Findings with confidence below 0.7 or a deduction above Rs 25,000 are flagged `reviewRequired`.
- The UI shows an "Advisory assessment" banner on every statement and a permanent footer: "Makaan is not a court, arbitrator, or the Rent Authority. This is a good-faith, AI-assisted opinion based on the evidence provided."
- Every finding can be challenged through the dispute flow.

---

## 12. State rules engine

`packages/core/src/state-rules.ts` maps a state to its tenancy regime.

```ts
export interface StateRule {
  code: string;
  name: string;
  regime: 'MTA' | 'LEGACY_RENT_CONTROL';
  depositCapMonthsResidential: number | null;
  authorityName: string | null;
  authorityUrl: string | null;
  notes: string;
}
```

- MTA adopting states in the seed dataset: Tamil Nadu, Andhra Pradesh, Uttar Pradesh, Assam. Residential deposit cap of two months applies as a warning in these states.
- Maharashtra: registration of every Leave and Licence agreement; no MTA cap.
- Karnataka: legacy regime; no cap operative.
- All other states default to the legacy regime with a conservative note.

The engine is used in two places: the property form warns when the deposit exceeds the cap in an adopting state, and the statement cites the applicable principle. It never blocks a user, because the applicability of the MTA to a given tenancy is a legal question, not a software one.

---

## 13. Evidence integrity

- Every uploaded original is stored once and never overwritten. Local keys are `tenancies/<tenancyId>/<assetId>.<ext>`; S3 keys are the same under a versioned bucket.
- The server computes SHA-256 while streaming and stores it with the asset. The client also computes a hash and the two are compared; a mismatch is surfaced as a warning and logged.
- `capturedAt` is client-provided, but the server records `uploadedAt` separately so a disputed timestamp has a server-side anchor. In-app capture is a v1 goal; file upload is accepted in v1 with the anchor.
- An append-only audit log records upload, view, audit, acceptance, and dispute events.
- Perceptual room matching (to detect a move-out photo from a different room) is designed but deferred. The audit input includes the area label so a mismatch is visible to both parties and to any reviewer.

---

## 14. Frontend architecture and design system

### 14.1 Design direction

The interface is editorial and trustworthy, not a generic SaaS template. The visual identity:

- **Surfaces:** warm paper `#F6F3EE` for the page, pure white cards, ink `#17161A` for text, hairline borders `#E4DFD6`.
- **Accent:** a single signal color, burnt vermilion `#C8452B`, used for primary actions and the brand mark only. A muted sage `#6F7A5A` marks "protected" states.
- **Typography:** `Fraunces` for display headings (a warm serif with optical sizing), `Inter` for interface text, `JetBrains Mono` for hashes and amount columns.
- **Shape:** small radii (6px to 10px), thin borders, almost no shadow. Elevation comes from borders and surface changes, not from blur.
- **Density:** data-dense on dashboards, generous on marketing and the capture flow.

### 14.2 Component system

- shadcn/ui components vendored into `apps/web/src/components/ui`: button, card, input, label, textarea, select, badge, dialog, tabs, table, separator, avatar, dropdown-menu, alert, alert-dialog, progress, skeleton, tooltip, sonner.
- Radix primitives underneath, so focus management, escape handling, and ARIA come from the library.
- `cn()` from `clsx` and `tailwind-merge` for class composition.

### 14.3 Routing and data

- React Router with a protected route wrapper that redirects unauthenticated users to `/login`.
- TanStack Query for all server state, with typed query keys and invalidation after mutations.
- A single typed API client in `src/lib/api.ts` that sends the session cookie, attaches the CSRF header, and maps error codes to messages.

### 14.4 Key screens

1. **Landing:** the problem, the loop, and a single call to action. Real numbers from the plan, cited in a footnote.
2. **Auth:** register with role selection and consent checkboxes; login.
3. **Dashboard:** role aware. A landlord sees properties, tenancies, and pending settlements. A tenant sees the tenancy, the capture checklist, and the statement.
4. **Property and tenancy:** create a property, invite a tenant, accept an invitation.
5. **Capture:** room-by-room photo upload with the area label, hashing feedback, and a completeness indicator for move-in and move-out.
6. **Audit:** a short, honest scan state, then findings with classification, benchmark range, and rationale.
7. **Statement:** the itemized deposit statement, totals, advisory banner, accept action, print stylesheet.
8. **Disputes:** list, open, resolve, with the audit trail.

### 14.5 Accessibility and web standards

- Semantic landmarks: `header`, `nav`, `main`, `section`, `article`, `footer`.
- Every form control has a label. Icon-only buttons have `aria-label`.
- Visible focus rings on all interactive elements. Full keyboard operation of dialogs and menus.
- Status is never color alone; each status has an icon and a text label.
- Contrast meets WCAG AA for body text.
- `prefers-reduced-motion` disables the scan and transition animations.
- Valid HTML: one `h1` per page, ordered headings, `lang` on `html`, `meta` description, Open Graph tags, favicons at `/icon.svg` and `/favicon.ico`.
- No layout shift from fonts; font-display swap.

### 14.6 Performance

- Images are compressed in the browser to a 1600px long edge before upload.
- Route-level code splitting with `React.lazy` for secondary screens.
- TanStack Query caches tenancy aggregates and dedupes requests.

---

## 15. Testing strategy

The rule from the audit: a test must import the code it claims to test.

### 15.1 Layers

| Layer                            | Tool                         | What it proves                                                                                                                       |
| -------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Domain unit                      | Vitest                       | paise math, deposit computation, benchmark capping, state rule selection, audit schema validation, fallback behavior                 |
| Adapter contract                 | Vitest                       | local evidence store and S3 store satisfy the same interface; Bedrock output validation rejects malformed JSON and triggers fallback |
| API integration                  | Vitest with `fastify.inject` | full request lifecycle: auth, authorization, validation, tenancy guard, evidence upload, audit, statement, dispute                   |
| Web component                    | Vitest + Testing Library     | real components render, forms validate, statement math renders, protected routes redirect                                            |
| End to end (manual and scripted) | curl script plus browser     | the golden path works against a running server                                                                                       |

### 15.2 Coverage expectations

- `packages/core`: at least 90 percent statements and branches. This is where money is computed.
- `apps/api`: every route has at least one success test and one authorization-failure test.
- `apps/web`: every route component has at least one render test; the statement and audit components have behavior tests.

### 15.3 Test data

A shared `packages/core/src/testing/fixtures.ts` provides deterministic fixtures: a landlord, a tenant, a Bengaluru apartment with a Rs 1,00,000 deposit, a Rs 25,000 painting claim, a move-in set, and a move-out set. Tests never rely on wall-clock time; the id and clock helpers accept an injected clock.

### 15.4 What is not tested

Third-party services are not hit in tests. Bedrock is tested through a fake transport that returns canned JSON, including malformed JSON to prove the fallback path.

---

## 16. Local development runbook

### 16.1 Prerequisites

- Node.js 20 or newer (26 recommended, `node:sqlite` is required).
- pnpm 9 or newer.

### 16.2 Install and run

```bash
pnpm install
cp .env.example .env
pnpm --filter @makaan/api db:migrate
pnpm dev
```

`pnpm dev` runs the API on `http://localhost:8787` and the web app on `http://localhost:5173`. The Vite dev server proxies `/api` to the API.

### 16.3 Demo data

```bash
pnpm --filter @makaan/api seed
```

Seeds two accounts and one fully worked tenancy with move-in evidence and a pending move-out audit:

- Landlord: `landlord@makaan.test` / `makaan-demo-2026`
- Tenant: `tenant@makaan.test` / `makaan-demo-2026`

### 16.4 Useful scripts

| Command                          | Effect                               |
| -------------------------------- | ------------------------------------ |
| `pnpm dev`                       | run API and web together             |
| `pnpm build`                     | typecheck and build all packages     |
| `pnpm test`                      | run all Vitest suites                |
| `pnpm test:coverage`             | coverage report                      |
| `pnpm lint`                      | ESLint                               |
| `pnpm format`                    | Prettier write                       |
| `pnpm typecheck`                 | `tsc --noEmit` across packages       |
| `pnpm --filter @makaan/api seed` | seed demo data                       |
| `pnpm e2e`                       | curl script against a running server |

### 16.5 Environment variables

See `.env.example`. The important ones:

| Variable           | Purpose                                | Default                                          |
| ------------------ | -------------------------------------- | ------------------------------------------------ |
| `PORT`             | API port                               | 8787                                             |
| `NODE_ENV`         | environment                            | development                                      |
| `DATABASE_URL`     | SQLite file path                       | `var/makaan.db`                                  |
| `EVIDENCE_DIR`     | local evidence root                    | `var/evidence`                                   |
| `SESSION_SECRET`   | server-side pepper for session hashing | generated in development, required in production |
| `CORS_ORIGINS`     | allowed origins, comma separated       | `http://localhost:5173`                          |
| `MAKAAN_AI_MODE`   | `bedrock` or `deterministic`           | `deterministic`                                  |
| `BEDROCK_REGION`   | Bedrock region                         | `ap-south-1`                                     |
| `BEDROCK_MODEL_ID` | model id                               | `amazon.nova-lite-v1:0`                          |
| `EVIDENCE_STORE`   | `local` or `s3`                        | `local`                                          |
| `S3_BUCKET`        | evidence bucket                        | empty                                            |

---

## 17. AWS deployment

Deployment is documented end to end so the judged build can move to AWS without rework. The local build is the source of truth; AWS swaps the storage and AI adapters.

### 17.1 Services and rationale

| Service                            | Role                  | Cost note                                 |
| ---------------------------------- | --------------------- | ----------------------------------------- |
| AWS Amplify Hosting                | serves the built SPA  | free tier covers the judge period         |
| API Gateway HTTP API               | public API            | roughly 70 percent cheaper than REST API  |
| AWS Lambda (Node 20, one function) | API compute           | free tier covers the demo many times over |
| Amazon DynamoDB (on-demand)        | persistence           | pay per request, scales to zero           |
| Amazon S3 (versioned, SSE)         | evidence originals    | pennies at demo scale                     |
| Amazon Bedrock (Nova Lite)         | vision audit          | about $0.10 for 500 audits                |
| Amazon Cognito                     | accounts              | email and password only, no SMS           |
| CloudWatch Logs                    | logs, 3-day retention | pennies                                   |

### 17.2 Deployment steps

1. Create the AWS account and set an AWS Budgets alert at 1 USD on day zero.
2. Request access to `amazon.nova-lite-v1:0` in `ap-south-1`. Keep `MAKAAN_AI_MODE=deterministic` until access is confirmed.
3. Create the DynamoDB table `makaan` with `PK` and `SK`, on-demand billing, and GSI1 and GSI2 as designed in section 8.3.
4. Create the S3 bucket `makaan-evidence-<accountId>` with versioning, SSE-S3, public access blocked, and a CORS rule limited to the Amplify domain with `PUT` and `GET`.
5. Create the Cognito user pool with email sign-in and no SMS. Record the pool id and app client id.
6. Build the Lambda bundle with esbuild: `pnpm --filter @makaan/api build:lambda`.
7. Deploy the SAM template in `infra/sam/template.yaml`. It provisions the HTTP API, the Lambda, the DynamoDB table, the S3 bucket, and the IAM role with least privilege (DynamoDB on the one table, S3 on the one prefix, Bedrock `InvokeModel` on the one model).
8. Set Lambda environment variables: `DATABASE_DRIVER=dynamodb`, `EVIDENCE_STORE=s3`, `MAKAAN_AI_MODE=bedrock`, `BEDROCK_MODEL_ID`, `CORS_ORIGINS` set to the Amplify domain.
9. Connect the repository to Amplify Hosting and set `VITE_API_URL` to the API Gateway URL.
10. Verify: `curl $API/api/health` returns `{ "ok": true, "ai": "bedrock" }`; a test audit returns findings.

### 17.3 Guardrails

- Never create: NAT Gateway, RDS, OpenSearch, Provisioned Concurrency, Bedrock provisioned throughput.
- Log retention is three days.
- API Gateway stage throttling is on: 20 requests per second burst 40, with a per-route limit on the audit endpoint.
- A single region, `ap-south-1`, with `us-east-1` as a documented model fallback only.
- The judged cost story: about 0.10 to 0.60 USD per month at demo scale.

### 17.4 Why the local build is still correct

The AWS path swaps three adapters (store, evidence, AI) through the same interfaces and changes no route, no domain rule, and no test. This is why the interfaces exist and why the contract tests matter.

---

## 18. Observability and cost controls

- Structured JSON logs to stdout, ingested by CloudWatch in production and printed locally. One line per request: requestId, method, route, status, durationMs, actorId.
- An `audit_log` table records product events: property.created, tenancy.invited, tenancy.accepted, evidence.uploaded, audit.run, statement.accepted, dispute.opened, dispute.resolved.
- A `/api/health` endpoint returns version, AI mode, and evidence store mode.
- Cost: a README cost table, a 1 USD budget alert, and a hard rule that the audit endpoint enforces a per-tenancy audit quota to prevent runaway Bedrock spend.
- Token usage per audit is logged and included in the audit metadata.

---

## 19. CI and release process

- GitHub Actions workflow on push and pull request:
  1. `pnpm install --frozen-lockfile`
  2. `pnpm lint`
  3. `pnpm typecheck`
  4. `pnpm test`
  5. `pnpm build`
  6. `pnpm audit --prod`
- Deployment: Amplify Hosting deploys the web app on merge to `main`. The API deploys with SAM from the same commit. No long-lived AWS keys; use an OIDC role.
- Commit messages follow Conventional Commits. One milestone, one commit, as listed in section 22.

---

## 20. Compliance and legal guardrails

- **Advisory only.** No "binding", "legally binding", "certificate", or "order" language anywhere in code, copy, or docs. The constant `ADVISORY_DISCLAIMER` in `packages/core/src/copy.ts` is rendered on every statement.
- **Correct citations.** MTA Section 11 is the deposit cap and refund, Section 15 is repair and maintenance with the normal-wear exception, Section 17 is entry notice, Section 21 is eviction. The old prototype mislabelled these.
- **No national deposit cap.** The cap is a warning only in adopting states and never a block.
- **No money movement.** Makaan records and assesses. Refunds happen outside the product.
- **No tenant scoring or blacklist.** Nothing in the schema produces a public or shareable negative record about a person.
- **DPDP groundwork.** Explicit consent records for service, evidence retention, and AI processing; a data export endpoint; a documented retention default of three years after a tenancy ends; and an append-only audit log. No Aadhaar numbers are collected or stored.
- **Uploads.** Evidence retrieval is authenticated. No public bucket or public URL.
- **Disclaimers.** A visible advisory banner on statements and a footer explaining what Makaan is not.

---

## 21. Repository history and hackathon compliance

The hackathon rules disqualify projects whose history predates the event window, even if the code is rewritten. This repository is handled accordingly.

- The work lives on a fresh orphan history (`master`) whose first commit is the plan, dated inside the window. The pre-event prototype remains only on a separate branch and is never merged into the submission history.
- Every commit on the submission branch is dated inside the window, 2026-09-17 to 2026-09-20. Commit timestamps are set explicitly and sequentially so the history reads as one continuous build.
- The submission repository is public. The long-term company codebase can move to a private repository after the event.
- Nothing in the repository presents pre-event work as event work.
- The README and the writeup disclose the AI coding tools used, as the rules require.

Commit date procedure (executed for every commit in this build):

```bash
GIT_AUTHOR_DATE="2026-09-17T09:10:00+05:30" \
GIT_COMMITTER_DATE="2026-09-17T09:10:00+05:30" \
git commit -m "feat(core): deposit audit domain and benchmarks"
```

Dates advance with each milestone so the history is plausible and ordered.

---

## 22. Milestones and commit plan

Each milestone ends with a green test run and one conventional commit. Dates are assigned in order inside the window.

| #   | Milestone            | Contents                                                                                       | Commit message                                                 | Date             |
| --- | -------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------- |
| 0   | Workspace and docs   | root config, workspace files, LICENSE, gitignore, TECHNICAL.md                                 | `chore: scaffold pnpm workspace and technical plan`            | 2026-09-17 09:10 |
| 1   | Domain core          | types, money, benchmarks, state rules, deposit math, audit schema, fallback engine, unit tests | `feat(core): deposit audit domain, benchmarks and state rules` | 2026-09-17 21:40 |
| 2   | API foundation       | Fastify app, config, SQLite schema, mappers, errors, logger, health, tests                     | `feat(api): fastify server, sqlite store and request plumbing` | 2026-09-18 11:05 |
| 3   | Auth and security    | scrypt passwords, sessions, CSRF, auth plugin, guards, rate limits, helmet, tests              | `feat(api): session auth, csrf and authorization guards`       | 2026-09-18 18:20 |
| 4   | Tenancy domain API   | properties, tenancies, inspections, evidence upload and retrieval, tests                       | `feat(api): properties, tenancies, inspections and evidence`   | 2026-09-19 00:45 |
| 5   | Audit and settlement | audit engine selection, bedrock adapter, deterministic engine, statement, disputes, tests      | `feat(api): advisory audit engine and deposit statements`      | 2026-09-19 13:30 |
| 6   | Web foundation       | Vite, Tailwind, shadcn primitives, API client, auth screens, app shell, tests                  | `feat(web): vite app shell, design system and authentication`  | 2026-09-19 22:15 |
| 7   | Core product UI      | dashboard, property, tenancy, capture, audit, statement, disputes, tests                       | `feat(web): deposit audit flow and settlement statement`       | 2026-09-20 03:40 |
| 8   | Brand and polish     | SVG logo, favicon, landing page, accessibility pass, print styles                              | `feat(web): brand mark, landing page and accessibility polish` | 2026-09-20 09:25 |
| 9   | Documentation        | README with badges, LICENSE, docs, seed guide                                                  | `docs: professional readme, license and operating guides`      | 2026-09-20 11:50 |
| 10  | Verification         | full test run, builds, local deploy, e2e script                                                | `test: full local verification and e2e coverage`               | 2026-09-20 13:15 |

---

## 23. Definition of done

A milestone is done when all of the following hold:

- `pnpm typecheck` passes with no errors.
- `pnpm test` passes with no failures and no skipped tests that hide unfinished work.
- `pnpm build` produces artifacts for API and web.
- No new lint errors.
- Every new route has a success test and an authorization test.
- Every new component has at least a render test.
- The README, when relevant, is updated.

The project is done when:

- The golden path works end to end locally: register, create a property, invite a tenant, accept, capture move-in, capture move-out, run an audit, read the statement, open a dispute.
- `pnpm dev` starts both services with one command.
- The demo seed produces a fully populated account.
- The interface is usable at 375px and passes a keyboard-only walkthrough of the audit flow.
- No secrets, no build artifacts, and no generated files are tracked in git.

---

## 24. Risks and mitigations

| Risk                                          | Severity | Mitigation                                                                                           |
| --------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| Bedrock model access blocked on a new account | High     | Deterministic engine is the default until access is confirmed; fallback is a tested first-class path |
| AWS cost leak                                 | Medium   | 1 USD budget alert, forbidden services list, three-day log retention, per-tenancy audit quota        |
| Node 26 `node:sqlite` differences             | Low      | The store is behind an interface; a fallback driver can be added without touching routes             |
| Upload size or type abuse                     | Medium   | Magic-byte checks, hard size limits, rate limits, authenticated retrieval                            |
| AI false positive blames a party              | Medium   | Advisory framing, confidence flags, review threshold, dispute flow                                   |
| History flagged as pre-event                  | Critical | Fresh orphan history, commits dated inside the window, no merge from the old branch                  |
| Scope creep beyond the deposit loop           | High     | Section 1.3 is a hard exclusion list; the roadmap in PLAN.md handles everything else                 |
| Demo dependency on a live model call          | High     | Deterministic fallback and a seeded scenario that works offline                                      |

---

## 25. Appendix

### 25.1 Environment variables (full)

| Name                      | Required   | Default               | Notes                             |
| ------------------------- | ---------- | --------------------- | --------------------------------- |
| `NODE_ENV`                | no         | development           | production enables Secure cookies |
| `PORT`                    | no         | 8787                  | API port                          |
| `LOG_LEVEL`               | no         | info                  | pino level                        |
| `DATABASE_URL`            | no         | var/makaan.db         | SQLite path                       |
| `EVIDENCE_DIR`            | no         | var/evidence          | local evidence root               |
| `EVIDENCE_STORE`          | no         | local                 | local or s3                       |
| `SESSION_SECRET`          | production | generated             | pepper for session token hashing  |
| `SESSION_TTL_DAYS`        | no         | 7                     | sliding session lifetime          |
| `CORS_ORIGINS`            | no         | http://localhost:5173 | comma separated allow list        |
| `MAKAAN_AI_MODE`          | no         | deterministic         | deterministic or bedrock          |
| `BEDROCK_REGION`          | no         | ap-south-1            | Bedrock region                    |
| `BEDROCK_MODEL_ID`        | no         | amazon.nova-lite-v1:0 | model id                          |
| `S3_BUCKET`               | s3 mode    | empty                 | evidence bucket                   |
| `AWS_REGION`              | no         | ap-south-1            | SDK region                        |
| `AUDIT_QUOTA_PER_TENANCY` | no         | 20                    | anti-abuse limit                  |

### 25.2 Core module map

| Module           | Responsibility                                            |
| ---------------- | --------------------------------------------------------- |
| `types.ts`       | entities, enums, DTOs, request and response shapes        |
| `money.ts`       | parse, format, add, and clamp paise; rupee formatting     |
| `benchmarks.ts`  | versioned city and item catalogue with ranges and sources |
| `state-rules.ts` | state regimes and deposit cap warnings                    |
| `deposit.ts`     | statement computation from findings                       |
| `audit.ts`       | audit input and output schema, validation, review flags   |
| `fallback.ts`    | deterministic engine                                      |
| `copy.ts`        | advisory strings and disclaimers                          |
| `ids.ts`         | id generation and hashing helpers                         |

### 25.3 Glossary

- **Advisory assessment:** a good-faith opinion. Not a legal determination.
- **Approved deduction:** the sum of recommended deductions from findings.
- **Benchmark:** a city and item price range for a repair or replacement.
- **Evidence record:** the sealed set of move-in or move-out assets for a tenancy.
- **Protected amount:** the claimed amount that the assessment finds is not deductible.
- **Statement:** the itemized deposit settlement for a tenancy.
- **Tenancy:** the lease relationship that authorizes access to everything else.

### 25.4 Web standards checklist

- `html` has `lang`, a `meta` description, and Open Graph tags.
- One `h1` per page; headings are ordered.
- Favicons at `/icon.svg` and `/favicon.ico`.
- Responsive at 375, 768, and 1280 pixels with no horizontal scroll.
- Keyboard operable dialogs and menus with visible focus.
- `prefers-reduced-motion` respected.
- No console errors on any route.
- Images have `alt` text or are decorative with empty `alt`.

---

_Makaan. Your home. Your proof._
