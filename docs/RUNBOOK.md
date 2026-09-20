# Runbook

## Start locally

```bash
pnpm install
cp .env.example .env
pnpm --filter @makaan/api seed
pnpm dev
```

Web: http://localhost:5173. API: http://localhost:8787.

## Reset the local database

```bash
rm -f var/makaan.db var/makaan.db-wal var/makaan.db-shm
rm -rf var/evidence
pnpm --filter @makaan/api seed
```

## Run a single test file

```bash
pnpm --filter @makaan/api exec vitest run test/tenancy-flow.test.ts
```

## Change the AI mode

- Deterministic (default, no credentials): `MAKAAN_AI_MODE=deterministic`
- Bedrock: `MAKAAN_AI_MODE=bedrock`, plus AWS credentials with `InvokeModel` on
  `amazon.nova-lite-v1:0` in `BEDROCK_REGION`.

The deterministic engine is always constructed as the fallback, so an audit
never fails because of the model.

## Common tasks

| Task                           | Command                                |
| ------------------------------ | -------------------------------------- |
| Create or migrate the database | `pnpm --filter @makaan/api db:migrate` |
| Seed demo data                 | `pnpm --filter @makaan/api seed`       |
| Typecheck everything           | `pnpm typecheck`                       |
| Run all tests                  | `pnpm test`                            |
| Build everything               | `pnpm build`                           |
| Lint everything                | `pnpm lint`                            |

## Troubleshooting

**Tests cannot find `node:sqlite`.** Use Node.js 20 or newer. The store loads
`node:sqlite` through `createRequire` so bundlers do not try to resolve it.

**Port already in use.** Set `PORT` in `.env` for the API, and the Vite proxy in
`apps/web/vite.config.ts` targets the same port.

**Audit returns an uncertain finding.** The area label did not match a known
category. Add a clearer label, or use the category hint, then re-run.

**Photos do not render.** Evidence is served through an authenticated route.
Make sure you are signed in and are a member of the tenancy.

## Production notes

- Set `NODE_ENV=production` and a `SESSION_SECRET` of at least 32 characters.
- Set `CORS_ORIGINS` to the exact web origin.
- Keep logs at three day retention on AWS.
- Watch the AWS Budgets alert at 1 USD.
