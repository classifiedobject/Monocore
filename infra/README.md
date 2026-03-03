# Monocore Infrastructure Guide

Deployment runbook for staging/production is available at [deploy.md](./deploy.md).

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
- `API_PORT`: API server port (default 4000).
- `API_TRUST_PROXY`: Trust proxy setting for load balancers.
- `SESSION_SECRET`: Session secret.
- `SESSION_INACTIVITY_DAYS`: Sliding inactivity timeout for sessions (default 30).
- `SESSION_ABSOLUTE_DAYS`: Absolute session lifetime cap (default 90).
- `CORS_ORIGINS`: Comma-separated web origin allowlist.
- `SESSION_COOKIE_DOMAIN`: Cookie domain (use `.themonocore.com` in prod).
- `SESSION_COOKIE_SECURE`: Secure cookie flag (`true` in staging/prod).
- `SESSION_COOKIE_SAMESITE`: Session cookie same-site policy.
- `CSRF_COOKIE_SAMESITE`: CSRF cookie same-site policy.
- `WEB_PORT`: Web server port (default 3000).
- `NEXT_PUBLIC_WEB_PUBLIC_API_URL`: Browser API base URL.
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

## Finance Core Pro
- Module key: `finance-core`.
- Tenant-owned entities:
  - `FinanceCategory`
  - `FinanceCounterparty`
  - `FinanceAccount`
  - `FinanceProfitCenter`
  - `FinanceAllocationRule`
  - `FinanceAllocationTarget`
  - `FinanceAllocationBatch`
  - `FinanceInvoice`
  - `FinanceInvoiceLine`
  - `FinancePayment`
  - `FinancePaymentAllocation`
  - `FinanceRecurringRule`
  - `FinanceEntry`
- App API endpoints (all gated behind module installation + tenant RBAC):
  - `/app-api/finance/categories`
  - `/app-api/finance/counterparties`
  - `/app-api/finance/accounts`
  - `/app-api/finance/entries`
  - `/app-api/finance/recurring`
  - `/app-api/finance/allocation-rules`
  - `/app-api/finance/allocation-batches`
  - `/app-api/finance/invoices`
  - `/app-api/finance/payments`
  - `/app-api/finance/reports/pnl`
  - `/app-api/finance/reports/cashflow`
  - `/app-api/finance/reports/pnl-by-profit-center`
  - `/app-api/finance/reports/aging`
  - `/app-api/finance/reports/counterparty-balance`
- Recurring runs:
  - Manual per rule: `POST /app-api/finance/recurring/:id/run-now`
  - Batch due run: `POST /app-api/finance/recurring/run-due`
  - Worker placeholder logs scheduling hint in `apps/worker/src/index.ts`
  - For cron later, schedule a secure internal call to `run-due` with service auth.
- Profit Center usage:
  - Create hierarchical centers such as `Vestiyer`, `Vale`, `Event`, `Department`.
  - Assign optional `profitCenterId` on each finance entry.
  - Profit center P&L report includes an `Unassigned` bucket for entries without center.
- Cost Allocation Engine (percentage, v0):
  - Create allocation rules with targets that total `%100`.
  - Apply a rule on one expense entry via `POST /app-api/finance/allocation-rules/:id/apply`.
  - System creates generated entries per target profit center and keeps original source entry unchanged.
  - Same source entry cannot be allocated twice; income entries cannot be allocated.
- AP/AR Lite:
  - `RECEIVABLE` and `PAYABLE` invoices with line-based totals.
  - Incoming/outgoing payments and partial allocation to invoices.
  - Invoice statuses auto-updated (`ISSUED`, `PARTIALLY_PAID`, `PAID`, `VOID`).
  - Aging report (`current`, `1-30`, `31-60`, `61-90`, `90+`) and counterparty outstanding balance list.
  - Fits cari flow: alacak/verecek takibi by counterparty with due-date buckets.
- Budget & Forecast (Sprint 11):
  - `FinanceBudget` + `FinanceBudgetLine` for annual budgets with monthly lines.
  - Optional `categoryId` and `profitCenterId` on budget lines for granular planning.
  - Budget endpoints:
    - `/app-api/finance/budgets`
    - `/app-api/finance/budgets/:id`
    - `/app-api/finance/budgets/:id/lines`
    - `/app-api/finance/budgets/:id/duplicate`
    - `/app-api/finance/budgets/:id/activate|deactivate`
  - Budget vs Actual report:
    - `/app-api/finance/reports/budget-vs-actual`
    - Returns monthly breakdown + totals + variance and variance percent.
- Cashflow Projection v0:
  - Includes open AP/AR invoices by due date, recurring rule occurrences, and manual forecast items.
  - Manual forecast entity: `FinanceCashflowForecastItem`.
  - Endpoints:
    - `/app-api/finance/cashflow-forecast-items`
    - `/app-api/finance/reports/cashflow-projection`
  - Projection is weekly bucketed in v0 and returns source split: invoices / recurring / manual.

## Inventory Core
- Module key: `inventory-core`.
- Tenant-owned entities:
  - `InventoryWarehouse`
  - `InventoryItem`
  - `InventoryStockMovement`
- App API endpoints (module installation + tenant RBAC enforced):
  - `/app-api/inventory/capabilities`
  - `/app-api/inventory/warehouses`
  - `/app-api/inventory/items`
  - `/app-api/inventory/movements`
  - `/app-api/inventory/transfer`
  - `/app-api/inventory/stock-balance`
- Rules:
  - Strict negative stock protection for `OUT` and `TRANSFER_OUT` operations.
  - Transfer creates two linked movements (`TRANSFER_OUT` + `TRANSFER_IN`).
  - Stock balance is derived from movement sums by item+warehouse.
- UI route:
  - `/app/inventory` with tabs: Items, Warehouses, Stock, Movements.
- Smoke flow:
  - `pnpm inventory:smoke` creates A/B warehouses + one item, stocks in 100, transfers 40, verifies `A=60`, `B=40`.

## Recipe + Sales Core
- Module keys:
  - `recipe-core` for product + BOM management.
  - `sales-core` for sales ledger posting.
- Tenant-owned entities:
  - `SalesProduct`
  - `Recipe`
  - `RecipeLine`
  - `SalesOrder`
  - `SalesOrderLine`
- Posting flow:
  - Sales post requires recipe for each product.
  - Consumes ingredient stock from selected warehouse (`InventoryStockMovement` with `relatedDocumentType="sale"`).
  - Computes COGS using `InventoryItem.lastPurchaseUnitCost` (v1 simple cost model).
  - Creates finance entries linked to sales order:
    - `Sales Revenue` (income)
    - `COGS` (expense)
  - Optional `profitCenterId` is forwarded to generated finance entries.
- Endpoints:
  - Recipe: `/app-api/recipes/products`, `/app-api/recipes/recipes`
  - Sales: `/app-api/sales/orders`, `/app-api/sales/orders/:id/post`, `/app-api/sales/orders/:id/void`
  - Inventory cost edit: `/app-api/inventory/items/:id/cost`
- Smoke flow:
  - `pnpm sales:smoke` validates: item cost=10, recipe consumption 2/unit, order 3x50, stock 100->94, revenue=150, cogs=60.

## Inventory Core
- Module key: `inventory-core`.
- Tenant-owned entities:
  - `InventoryWarehouse`
  - `InventoryItem`
  - `InventoryStockMovement`
- App API endpoints (module installation + tenant RBAC enforced):
  - `/app-api/inventory/capabilities`
  - `/app-api/inventory/warehouses`
  - `/app-api/inventory/items`
  - `/app-api/inventory/movements`
  - `/app-api/inventory/transfer`
  - `/app-api/inventory/stock-balance`
- Rules:
  - Strict negative stock protection for `OUT` and `TRANSFER_OUT` operations.
  - Transfer creates two linked movements (`TRANSFER_OUT` + `TRANSFER_IN`).
  - Stock balance is derived from movement sums by item+warehouse.
- UI route:
  - `/app/inventory` with tabs: Items, Warehouses, Stock, Movements.
- Smoke flow:
  - `pnpm inventory:smoke` creates A/B warehouses + one item, stocks in 100, transfers 40, verifies `A=60`, `B=40`.

## Recipe + Sales Core
- Module keys:
  - `recipe-core` for product + BOM management.
  - `sales-core` for sales ledger posting.
- Tenant-owned entities:
  - `SalesProduct`
  - `Recipe`
  - `RecipeLine`
  - `SalesOrder`
  - `SalesOrderLine`
- Posting flow:
  - Sales post requires recipe for each product.
  - Consumes ingredient stock from selected warehouse (`InventoryStockMovement` with `relatedDocumentType="sale"`).
  - Computes COGS using `InventoryItem.lastPurchaseUnitCost` (v1 simple cost model).
  - Creates finance entries linked to sales order:
    - `Sales Revenue` (income)
    - `COGS` (expense)
  - Optional `profitCenterId` is forwarded to generated finance entries.
- Endpoints:
  - Recipe: `/app-api/recipes/products`, `/app-api/recipes/recipes`
  - Sales: `/app-api/sales/orders`, `/app-api/sales/orders/:id/post`, `/app-api/sales/orders/:id/void`
  - Inventory cost edit: `/app-api/inventory/items/:id/cost`
- Smoke flow:
  - `pnpm sales:smoke` validates: item cost=10, recipe consumption 2/unit, order 3x50, stock 100->94, revenue=150, cogs=60.

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
8. Finance smoke flow (`pnpm finance:smoke`)
9. Inventory smoke flow (`pnpm inventory:smoke`)
10. Sales/Recipe smoke flow (`pnpm sales:smoke`)
11. Task Core smoke flow (`pnpm tasks:smoke`)
12. Reservation Core smoke flow (`pnpm reservations:smoke`)
13. Reservation operations (`/app/reservations`)

## Reservation & CRM Core
- Module key: `reservation-core`.
- Tenant-owned entities:
  - `Customer`
  - `CustomerTag`
  - `CustomerTagLink`
  - `Reservation`
- App API endpoints (module installation + tenant RBAC enforced):
  - `/app-api/reservations/capabilities`
  - `/app-api/reservations/customers`
  - `/app-api/reservations/customer-tags`
  - `/app-api/reservations/reservations`
  - `/app-api/reservations/reports/reservation-summary`
- Reservation lifecycle:
  - `BOOKED -> CONFIRMED -> SEATED -> COMPLETED`
  - terminal statuses: `CANCELED`, `NO_SHOW`
  - On completion, customer visit count increments and last visit date updates.
- Sales linkage (v0):
  - `SalesOrder.reservationId` can reference reservation.
  - When linked order is posted, customer `totalSpend` is incremented by order revenue.
  - If posted order is voided, that amount is decremented.
- UI route:
  - `/app/reservations` with tabs: Calendar/List, Customers, Reports.
- Smoke flow:
  - `pnpm reservations:smoke` creates customer+reservation, marks completed, verifies visit count increment.

## Task & Workforce Core
- Module key: `task-core`.
- Tenant-owned entities:
  - `TaskBoard`
  - `TaskTemplate`
  - `TaskInstance`
  - `TaskComment`
- App API endpoints (module installation + tenant RBAC enforced):
  - `/app-api/tasks/capabilities`
  - `/app-api/tasks/boards`
  - `/app-api/tasks/templates`
  - `/app-api/tasks`
  - `/app-api/tasks/:id/complete`
  - `/app-api/tasks/:id/reopen`
  - `/app-api/tasks/generate`
  - `/app-api/tasks/reports/summary`
  - `/app-api/tasks/reports/overdue-by-assignee`
- Assignment model:
  - Task template/instance assignment can target either a company user or a company role.
  - Role-based assignment reuses existing company RBAC role definitions for lightweight workforce mapping.
- Recurring generation:
  - `POST /app-api/tasks/generate?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - Generation is idempotent per template/date, so running the same range twice does not duplicate tasks.
- UI route:
  - `/app/tasks` with tabs: My Tasks, Team Tasks, Templates, Reports.
- Smoke flow:
  - `pnpm tasks:smoke` creates a daily template, generates 7-day tasks, verifies idempotency, completes one task, and checks summary reporting.
