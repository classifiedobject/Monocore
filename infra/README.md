# Monocore Infrastructure Guide

## Overview
Monocore uses a single PostgreSQL database with strict tenant isolation and two API/UI namespaces:
- Platform plane: `/platform/*` and `/platform-api/*`
- Customer plane: `/app/*` and `/app-api/*`

## Local Setup
1. Copy `.env.example` to `.env`.
2. Run `pnpm install`.
3. Start infrastructure: `pnpm compose:up`.
4. Generate Prisma client: `pnpm db:generate`.
5. Apply migrations: `pnpm db:migrate`.
6. Seed initial data: `pnpm db:seed`.
7. Start apps: `pnpm dev`.

One-shot startup command:
- `pnpm dev:all`

## Environment Variables
- `DATABASE_URL`: PostgreSQL connection string.
- `REDIS_URL`: Redis URL.
- `SESSION_SECRET`: Session secret seed.
- `SESSION_INACTIVITY_DAYS`: Sliding inactivity timeout for sessions (default 30).
- `SESSION_ABSOLUTE_DAYS`: Absolute session lifetime cap (default 90).
- `API_PORT`: API server port (default 4000).
- `WEB_PORT`: Web server port (default 3000).
- `NEXT_PUBLIC_API_URL`: Browser API base URL.
- `SEED_PLATFORM_ADMIN_EMAIL`: Seed admin user email.
- `SEED_PLATFORM_ADMIN_PASSWORD`: Seed admin password.

## Database Migrations
- Schema: `packages/db/prisma/schema.prisma`
- SQL migration: `packages/db/prisma/migrations/0001_init/migration.sql`
- Commands:
  - `pnpm db:migrate`
  - `pnpm db:seed`

## RBAC Model
Two independent RBAC namespaces:
- Platform RBAC:
  - `PlatformMembership`, `PlatformRole`, `PlatformPermission`
  - Applied only to `/platform-api/*`
- Company RBAC:
  - `CompanyMembership`, `CompanyRole`, `CompanyPermission`
  - Applied only to `/app-api/*`
  - Requires tenant context via `x-company-id`

Tenant ownership is enforced with `companyId` checks on all customer writes.

## Auth & Security
- Email/password auth with Argon2 hashing.
- Session token stored in secure HTTP-only cookie.
- Session rows stored in database (`Session` table).
- CSRF middleware with double-submit token (`csrf_token` cookie + `x-csrf-token` header).
- Basic rate-limiting via Nest Throttler.

## Logging & Auditing
- Structured JSON request and error logs in API.
- Audit tables:
  - `PlatformAuditLog`
  - `CompanyAuditLog`
- Hooked on login/logout, company creation, invites, role/permission updates, i18n updates.

## Module System
- `Module`: global platform-owned registry.
- `ModuleInstallation`: tenant installation state and config.

## i18n Foundation
- Language keys stored in `LanguagePack` table (`locale`, `namespace`, `key`, `value`).
- Platform UI page `/platform/i18n` supports editing translations for `en` and `tr`.

## Base Flows
1. Register/login (`/auth/register`, `/auth/login`)
2. Create/select company (`/app/company`)
3. Invite member (`/app/team`)
4. Assign roles/permissions (`/app/roles`, `/platform/roles`)
5. Review audit logs (`/app/audit-logs`)
6. Platform tenant/module/i18n management (`/platform/tenants`, `/platform/modules`, `/platform/i18n`)
7. Invite lifecycle (`/platform-api/invites/*`, `/app-api/invites/*`, `/auth/accept-invite`)
