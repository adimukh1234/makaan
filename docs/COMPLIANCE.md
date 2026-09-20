# Compliance and legal guardrails

This document is engineering guidance, not legal advice. A public launch needs
an Indian real estate and technology lawyer.

## Advisory language

Makaan never says "binding", "legally binding", "certificate", or "order". Every
statement renders `ADVISORY_DISCLAIMER` from `packages/core/src/copy.ts`:

> This is an advisory condition assessment produced by Makaan from the evidence
> provided. Makaan is not a court, an arbitrator, or the Rent Authority. It does
> not decide liability and it does not move money.

## Tenancy law

- The Model Tenancy Act 2021 is a model law. It binds only states that adopted
  it. Adopting states in the seed dataset are Tamil Nadu, Andhra Pradesh, Uttar
  Pradesh and Assam.
- Section 11 is the security deposit cap and refund rule. Section 15 is repair
  and maintenance, with the "except for normal wear and tear" exception.
  Section 17 is the 24 hour entry notice. Section 21 is eviction.
- The deposit cap is a warning only, and only in adopting states. It never
  blocks a user, because applicability is a legal question, not a software one.

## Money movement

Makaan does not hold or move deposits. There is no escrow, no payment
aggregation, and no refund flow. The RBI Payment Aggregator Master Direction
(September 2025) tightened who may intermediate payments, so any future escrow
or guarantee product requires a legal opinion and a licensed partner first.

## Data protection (DPDP Act 2023 and Rules 2025)

- Consent is captured at registration for three purposes: service, evidence
  retention, and AI processing. Each can be withdrawn in settings.
- A consent record stores the purpose, the grant, the policy version and the
  time.
- `/api/me/export` returns the data principal's own data as JSON.
- Evidence retention default: three years after a tenancy ends, then deletion.
- No Aadhaar number is collected or stored. Any future identity verification
  uses DigiLocker or Aadhaar Paperless Offline eKYC through a licensed partner.
- The `audit_log` table is append only.

## Reviews and user content

Version one has no public reviews. If reviews are added later they must be
verified-stay only, with a right of reply and a clear moderation policy, to keep
intermediary safe harbour under the IT Act and the IT Rules 2021.

## What we refuse to build

- A searchable tenant blacklist or a secret tenant score.
- "Binding" certificates or AI as the final arbiter.
- A percentage of the disputed amount as a fee.
- Any flow that holds tenant money on our books.
