# Security

## Threat model

| Threat                          | Control                                                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Credential stuffing             | Per-route rate limit on login, generic error messages, scrypt with a per-user salt                             |
| Session theft through XSS       | httpOnly cookie, no token in JavaScript storage, content security policy at the host                           |
| CSRF                            | Session-bound synchronizer token required on every mutating request, plus SameSite=Lax                         |
| IDOR on tenancy data            | Every nested route loads the tenancy and checks membership before doing anything                               |
| Malicious upload                | Magic-byte check, 10 MB limit, one file per request, random storage key, authenticated retrieval               |
| Resource abuse                  | Global rate limit, stricter limits on auth and audit, audit quota per tenancy, 64 KB JSON body limit           |
| Prompt injection through images | Output is validated against a strict schema, findings are advisory, high-value findings are flagged for review |
| Secret leakage                  | No secrets in the repository, environment variables only, cookie and CSRF headers redacted from logs           |

## Authentication and sessions

- Passwords are hashed with scrypt (`N=16384`, `r=8`, `p=1`, 64 byte key) and a
  16 byte random salt, serialized as `scrypt$N$r$p$salt$hash`.
- Verification is constant time.
- A session token is 32 random bytes. The database stores only
  `HMAC-SHA256(token, SESSION_SECRET)`, so a database leak does not leak live
  sessions.
- Sessions expire after `SESSION_TTL_DAYS` and renew on use near expiry.
- Logout deletes the session server side.

## Authorization

The single guard is `loadTenancyForUser`. It loads the tenancy and confirms the
caller is the landlord or the tenant. Property routes check ownership
separately. No route accepts an ownership identifier from the request body.

## Data protection

- `passwordHash` never leaves the data layer.
- Evidence is served through an authenticated route, never a public URL.
- `/api/me/export` returns the caller's own data.
- Consent records are stored per purpose. See `docs/COMPLIANCE.md`.

## Reporting

Report a vulnerability privately to the maintainers. Do not open a public issue
for an unfixed security problem.

## Dependencies

`pnpm audit` runs in CI. Dependencies are pinned through the lockfile.
