CREATE TYPE "FinanceAllocationMethod" AS ENUM ('PERCENTAGE');

CREATE TABLE "FinanceAllocationRule" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "sourceCategoryId" UUID REFERENCES "FinanceCategory"("id") ON DELETE SET NULL,
  "sourceEntryId" UUID REFERENCES "FinanceEntry"("id") ON DELETE SET NULL,
  "allocationMethod" "FinanceAllocationMethod" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "FinanceAllocationTarget" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "allocationRuleId" UUID NOT NULL REFERENCES "FinanceAllocationRule"("id") ON DELETE CASCADE,
  "profitCenterId" UUID NOT NULL REFERENCES "FinanceProfitCenter"("id") ON DELETE RESTRICT,
  "percentage" DECIMAL(5,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("allocationRuleId", "profitCenterId")
);

CREATE TABLE "FinanceAllocationBatch" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "allocationRuleId" UUID NOT NULL REFERENCES "FinanceAllocationRule"("id") ON DELETE CASCADE,
  "sourceEntryId" UUID NOT NULL UNIQUE REFERENCES "FinanceEntry"("id") ON DELETE RESTRICT,
  "createdByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "FinanceEntry"
  ADD COLUMN "allocationBatchId" UUID,
  ADD COLUMN "isAllocationGenerated" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "FinanceEntry"
  ADD CONSTRAINT "FinanceEntry_allocationBatchId_fkey"
    FOREIGN KEY ("allocationBatchId") REFERENCES "FinanceAllocationBatch"("id") ON DELETE SET NULL;

CREATE INDEX "FinanceAllocationRule_companyId_isActive_idx" ON "FinanceAllocationRule"("companyId", "isActive");
CREATE INDEX "FinanceAllocationTarget_allocationRuleId_idx" ON "FinanceAllocationTarget"("allocationRuleId");
CREATE INDEX "FinanceAllocationBatch_companyId_createdAt_idx" ON "FinanceAllocationBatch"("companyId", "createdAt");
