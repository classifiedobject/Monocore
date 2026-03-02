CREATE TYPE "FinanceCounterpartyType" AS ENUM ('VENDOR', 'CUSTOMER', 'OTHER');
CREATE TYPE "FinanceAccountType" AS ENUM ('CASH', 'BANK', 'POS', 'OTHER');
CREATE TYPE "FinanceDirection" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "FinanceFrequency" AS ENUM ('WEEKLY', 'MONTHLY');

CREATE TABLE "FinanceCounterparty" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "type" "FinanceCounterpartyType" NOT NULL,
  "name" TEXT NOT NULL,
  "taxId" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "FinanceAccount" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "type" "FinanceAccountType" NOT NULL,
  "name" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'TRY',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "FinanceRecurringRule" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "direction" "FinanceDirection" NOT NULL,
  "categoryId" UUID NOT NULL REFERENCES "FinanceCategory"("id") ON DELETE RESTRICT,
  "amount" DECIMAL(14,2) NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "frequency" "FinanceFrequency" NOT NULL,
  "dayOfMonth" INTEGER,
  "nextRunAt" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "counterpartyId" UUID REFERENCES "FinanceCounterparty"("id") ON DELETE SET NULL,
  "accountId" UUID REFERENCES "FinanceAccount"("id") ON DELETE SET NULL,
  "createdByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "FinanceEntry"
  ADD COLUMN "counterpartyId" UUID,
  ADD COLUMN "accountId" UUID,
  ADD COLUMN "reference" TEXT,
  ADD COLUMN "isRecurringGenerated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "recurringRuleId" UUID;

ALTER TABLE "FinanceEntry"
  ADD CONSTRAINT "FinanceEntry_counterpartyId_fkey"
    FOREIGN KEY ("counterpartyId") REFERENCES "FinanceCounterparty"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "FinanceEntry_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "FinanceEntry_recurringRuleId_fkey"
    FOREIGN KEY ("recurringRuleId") REFERENCES "FinanceRecurringRule"("id") ON DELETE SET NULL;

CREATE INDEX "FinanceCounterparty_companyId_type_idx" ON "FinanceCounterparty"("companyId", "type");
CREATE INDEX "FinanceCounterparty_companyId_name_idx" ON "FinanceCounterparty"("companyId", "name");
CREATE INDEX "FinanceAccount_companyId_isActive_idx" ON "FinanceAccount"("companyId", "isActive");
CREATE INDEX "FinanceAccount_companyId_name_idx" ON "FinanceAccount"("companyId", "name");
CREATE INDEX "FinanceRecurringRule_companyId_isActive_nextRunAt_idx" ON "FinanceRecurringRule"("companyId", "isActive", "nextRunAt");
CREATE INDEX "FinanceRecurringRule_companyId_frequency_idx" ON "FinanceRecurringRule"("companyId", "frequency");
CREATE INDEX "FinanceEntry_companyId_counterpartyId_idx" ON "FinanceEntry"("companyId", "counterpartyId");
CREATE INDEX "FinanceEntry_companyId_accountId_idx" ON "FinanceEntry"("companyId", "accountId");
