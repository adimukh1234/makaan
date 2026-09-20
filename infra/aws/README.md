# AWS deployment

Makaan runs locally today with two adapters: a SQLite store and a filesystem
evidence store. The domain, the routes and the tests do not change when those
adapters are swapped for AWS services. This directory holds the AWS artifacts
and the exact runbook.

## What is already here

- `template.yaml`: an AWS SAM template for the storage layer. It provisions the
  DynamoDB single table (`PK` and `SK`, plus `GSI1` and `GSI2`) and the S3
  evidence bucket (versioned, encrypted, public access blocked, CORS scoped to
  the web origin).
- `../amplify/amplify.yml`: the AWS Amplify Hosting build specification for the
  web app.

## What is deliberately not here yet

There is no Lambda handler in this repository. The first prototype shipped a
template that pointed at a handler which did not exist, and the audit called it
out. Rather than repeat that mistake, the remaining work is listed explicitly:

1. A DynamoDB implementation of the `Store` interface in
   `apps/api/src/db/store.ts`. The interface and the single table design in
   `TECHNICAL.md` section 8.3 are ready for it.
2. A Lambda entry point that wraps the Fastify app. The recommended approach is
   `@fastify/aws-lambda`, which adapts API Gateway HTTP API events to the app
   without changing a route.
3. An S3 evidence adapter is already implemented
   (`apps/api/src/storage/s3.ts`). Set `EVIDENCE_STORE=s3` and `S3_BUCKET`.
4. The Bedrock adapter is already implemented
   (`apps/api/src/ai/bedrock.ts`). Set `MAKAAN_AI_MODE=bedrock` and request
   access to `amazon.nova-lite-v1:0` in `ap-south-1`.

Until those three items are done, the honest statement is: Makaan runs locally
and is AWS ready, not AWS deployed.

## Runbook, once the compute adapter exists

1. Create the AWS account and set an AWS Budgets alert at 1 USD.
2. Request model access for `amazon.nova-lite-v1:0` in `ap-south-1`.
3. Deploy the storage layer:
   `sam deploy --guided --template-file infra/aws/template.yaml --stack-name makaan-storage`
4. Create a Cognito user pool with email sign in and no SMS. Record the pool id
   and app client id.
5. Build and deploy the API Lambda with API Gateway HTTP API. Set:
   `DATABASE_DRIVER=dynamodb`, `EVIDENCE_STORE=s3`, `MAKAAN_AI_MODE=bedrock`,
   `BEDROCK_MODEL_ID=amazon.nova-lite-v1:0`, `CORS_ORIGINS=<amplify domain>`.
6. Connect the repository to Amplify Hosting and set `VITE_API_URL` to the API
   Gateway URL. The build uses `infra/amplify/amplify.yml`.
7. Verify: `curl <api>/api/health` returns `{ "ok": true, "ai": "bedrock" }`.

## Guardrails

- Never create: NAT Gateway, RDS, OpenSearch, Provisioned Concurrency, or
  Bedrock provisioned throughput.
- One region, `ap-south-1`, with `us-east-1` as a documented model fallback
  only.
- CloudWatch log retention is three days.
- API Gateway throttling is on, with a tighter limit on the audit route.

## Cost at demo scale

| Service              | Usage                           | Monthly cost   |
| -------------------- | ------------------------------- | -------------- |
| Lambda               | under 100k requests             | free tier      |
| API Gateway HTTP API | under 1M requests               | free tier      |
| DynamoDB on demand   | a few thousand reads and writes | cents          |
| S3                   | under 5 GB evidence             | cents          |
| Bedrock Nova Lite    | about 500 audits                | about 0.10 USD |
| Amplify Hosting      | one app, low traffic            | free tier      |

Estimated total: 0.10 to 0.60 USD per month at demo scale.
