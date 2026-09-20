# Architecture

## Layers

```
apps/web        React SPA. Talks to the API over JSON with a session cookie.
apps/api        Fastify HTTP API. Owns auth, authorization, persistence and the audit run.
packages/core   Pure domain logic. No I/O. Shared by the API and the web client.
```

`packages/core` holds the rules that must be correct: money in paise, the
deposit computation, the benchmark catalogue, the state tenancy regimes, the
audit output contract and the deterministic audit engine. It has no database or
network access, which is why it is the most heavily tested part of the system.

## Request lifecycle

1. `onRequest`: the auth plugin reads the session cookie, looks up the session,
   checks expiry, and attaches the user, the session hash and the CSRF token to
   the request.
2. `preHandler`: `authenticate` requires a session. `verifyCsrf` requires a
   matching `x-csrf-token` header on mutating methods.
3. Route handler: parses the request with a Zod schema, loads the tenancy with
   `loadTenancyForUser`, and performs the work.
4. Error handler: known errors map to a typed code and status. Unknown errors
   become a generic 500 and are logged with the request id.

Authorization for anything nested under a tenancy goes through one guard. A
route never trusts a body-supplied `tenantId` or `landlordId`.

## Data model

Eight aggregate tables in SQLite: `users`, `sessions`, `properties`,
`tenancies`, `inspections`, `evidence_assets`, `statements`, `findings`,
`disputes`, plus `consents` and `audit_log`.

The tenancy is the anchor. Inspections, evidence, statements, findings and
disputes all reference a tenancy, and access to all of them is decided by
membership of that tenancy.

The AWS mirror is a DynamoDB single table with item collections per tenancy and
two GSIs (`USER#id` to tenancy, `PROPERTY#id` to tenancy). The full key design is
in `TECHNICAL.md` section 8.3.

## Money and time

All money is an integer number of paise. Field names end in `Paise`. Formatting
happens only at the edges. All timestamps are ISO 8601 UTC strings. Dates
without time are `YYYY-MM-DD`.

## The audit engine

`AuditEngine` is an interface:

- `bedrock`: fetches the referenced evidence, sends the images to Amazon
  Bedrock Nova Lite with a strict JSON contract, validates the response, and
  falls back on any failure.
- `deterministic`: maps the area label and an optional category hint to the
  benchmark catalogue. It never touches the network.

Both return the same `AuditResult`. Findings are normalized so the invariants
always hold: non-damage findings carry zero deduction, damage deductions sit
inside the benchmark range, and uncertain or low-confidence findings are flagged
for review.

## Adapters

| Concern     | Local                       | AWS                                 |
| ----------- | --------------------------- | ----------------------------------- |
| Persistence | `SqliteStore`               | DynamoDB store (planned)            |
| Evidence    | `LocalEvidenceStore`        | `S3EvidenceStore` (implemented)     |
| Audit       | `createDeterministicEngine` | `createBedrockEngine` (implemented) |

Routes depend on interfaces, so swapping an adapter changes no route and no
test.

## Extension points

- Add a benchmark item in `packages/core/src/benchmarks.ts`. The fallback engine
  and the pricing tests pick it up.
- Add a state regime in `packages/core/src/state-rules.ts`.
- Add a route by creating a file in `apps/api/src/routes` and registering it in
  `apps/api/src/app.ts`.
