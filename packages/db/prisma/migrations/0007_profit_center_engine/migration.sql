CREATE TYPE "FinanceProfitCenterType" AS ENUM ('GENERAL', 'SERVICE', 'DEPARTMENT', 'LOCATION', 'EVENT', 'OTHER');

CREATE TABLE "FinanceProfitCenter" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "type" "FinanceProfitCenterType" NOT NULL,
  "parentId" UUID REFERENCES "FinanceProfitCenter"("id") ON DELETE SET NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("companyId", "name")
);

ALTER TABLE "FinanceEntry"
  ADD COLUMN "profitCenterId" UUID;

ALTER TABLE "FinanceEntry"
  ADD CONSTRAINT "FinanceEntry_profitCenterId_fkey"
    FOREIGN KEY ("profitCenterId") REFERENCES "FinanceProfitCenter"("id") ON DELETE SET NULL;

CREATE INDEX "FinanceProfitCenter_companyId_isActive_idx" ON "FinanceProfitCenter"("companyId", "isActive");
CREATE INDEX "FinanceProfitCenter_companyId_parentId_idx" ON "FinanceProfitCenter"("companyId", "parentId");
CREATE INDEX "FinanceEntry_companyId_profitCenterId_date_idx" ON "FinanceEntry"("companyId", "profitCenterId", "date");
