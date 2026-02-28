# Monocore Deployment Runbook (Staging + Production)

## Target Domains
- Production web: `app.themonocore.com`
- Production API: `api.themonocore.com`
- Staging web: `staging-app.themonocore.com`
- Staging API: `staging-api.themonocore.com`

## DNS Records
Create the following DNS records in the `themonocore.com` zone:

| Host | Type | Value | Notes |
| --- | --- | --- | --- |
| `app` | CNAME/A | web host target | Next.js app endpoint |
| `api` | CNAME/A | api host target | NestJS API endpoint |
| `staging-app` | CNAME/A | staging web host target | Staging Next.js endpoint |
| `staging-api` | CNAME/A | staging api host target | Staging API endpoint |

If your provider requires apex records, use ALIAS/ANAME or provider-managed records.

## Environment Variables

### Shared
- `DATABASE_URL`: PostgreSQL connection URL (staging/prod should use managed Postgres).
- `REDIS_URL`: Redis connection URL.
- `DEFAULT_LOCALE`: Default app locale (`en` by default).

### API_* (server-only)
- `API_PORT`: API listen port (default `4000`).
- `API_TRUST_PROXY`: `true`/`false`/hop count when behind load balancer.
- `SESSION_SECRET`: 16+ chars secret for session-related security.
- `SESSION_INACTIVITY_DAYS`: Sliding session inactivity timeout (default `30`).
- `SESSION_ABSOLUTE_DAYS`: Absolute session timeout (default `90`).
- `CORS_ORIGINS`: Comma-separated allowlist.
  - Example:
    - `https://app.themonocore.com,https://staging-app.themonocore.com,http://localhost:3000`
- `SESSION_COOKIE_DOMAIN`: `.themonocore.com` for production subdomains.
- `SESSION_COOKIE_SECURE`: `true` in staging/prod.
- `SESSION_COOKIE_SAMESITE`: `none` for cross-subdomain cookie scenarios.
- `CSRF_COOKIE_SAMESITE`: `none` in cross-subdomain production setups.

### WEB_PUBLIC_* (browser-exposed)
- `NEXT_PUBLIC_WEB_PUBLIC_API_URL`: Public API URL used by web client.
  - Production: `https://api.themonocore.com`
  - Staging: `https://staging-api.themonocore.com`

### Seed
- `SEED_PLATFORM_ADMIN_EMAIL`
- `SEED_PLATFORM_ADMIN_PASSWORD`

## Health Endpoints
- API:
  - `GET /healthz` returns `{ "ok": true }`
  - `GET /readyz` verifies DB connectivity
- Web:
  - `GET /healthz` returns `{ "ok": true }`

Local check:
- `pnpm health:check`

## Docker Artifacts
- API image: `apps/api/Dockerfile`
- Web image: `apps/web/Dockerfile`
- Production compose example: `docker-compose.prod.yml`

`docker-compose.prod.yml` is provider-agnostic and expects external DB/Redis through env vars.

## Database Migration Strategy (Staging/Prod)
Do not run migrations automatically on app startup.

Use explicit migration command:
- `pnpm db:migrate:deploy`

Optional seed command (idempotent):
- `pnpm db:seed:prod`

Recommended release sequence:
1. Deploy new app version.
2. Run `pnpm db:migrate:deploy`.
3. Restart/roll apps if required by platform.
4. Run health checks (`/healthz`, `/readyz`).

### Connection Pooling Guidance
- For high-concurrency environments, place PgBouncer (or provider-native pooling) in front of Postgres.
- Keep Prisma connected to the pooled endpoint if required by provider docs.
- Validate transaction/session mode compatibility before switching all workloads.

## GitHub Release Workflows
- CI: `.github/workflows/ci.yml`
- Staging manual release: `.github/workflows/release-staging.yml`
- Production manual release: `.github/workflows/release-production.yml`

Both release workflows are `workflow_dispatch` and contain placeholder deploy steps.
DB migrations are conditional so workflows do not fail when secrets are absent.

Required secrets to enable migration steps:
- `STAGING_DATABASE_URL`
- `PROD_DATABASE_URL`

## Hosting Paths

### Path A: Split hosting
- Web: Vercel
- API: Fly.io or Render
- DB/Redis: Neon/Supabase Postgres + Upstash/managed Redis

### Path B: Single provider
- DigitalOcean App Platform for web + api
- Managed Postgres + managed Redis in same provider

## Staging -> Production Runbook
1. Merge to `main`.
2. Trigger `Release Staging` workflow.
3. Validate staging smoke tests and health endpoints.
4. Trigger `Release Production` with confirmation input `RELEASE`.
5. Run post-deploy checks and audit logs review.

## Rollback Strategy
1. Roll back web/api to previous image/build.
2. If migration introduced breaking schema, restore from latest DB backup.
3. Re-run health checks.
4. Log incident details and follow-up actions.

## Backup/Restore Notes
- Enable automated daily backups for Postgres.
- Test restore process at least monthly in staging.
- Store backup retention policy and restore RTO/RPO in ops docs.

## Go Live Checklist
- [ ] DNS records for `app`, `api`, `staging-app`, `staging-api` are set.
- [ ] TLS certificates active for all subdomains.
- [ ] CORS allowlist contains staging + production web domains.
- [ ] Cookie config verified (`domain`, `secure`, `sameSite`).
- [ ] `API_TRUST_PROXY` configured behind load balancer.
- [ ] `db:migrate:deploy` tested in staging.
- [ ] Health checks integrated with platform monitoring.
- [ ] Backup + restore test completed.
- [ ] Production release workflow tested with protected environment.
