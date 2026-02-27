CREATE TYPE "FinanceCategoryType" AS ENUM ('INCOME', 'EXPENSE');

CREATE TABLE "FinanceCategory" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "type" "FinanceCategoryType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("companyId", "name")
);

CREATE TABLE "FinanceEntry" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "categoryId" UUID NOT NULL REFERENCES "FinanceCategory"("id") ON DELETE RESTRICT,
  "amount" DECIMAL(14,2) NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "description" TEXT,
  "createdByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "FinanceCategory_companyId_type_idx" ON "FinanceCategory"("companyId", "type");
CREATE INDEX "FinanceEntry_companyId_date_idx" ON "FinanceEntry"("companyId", "date");
CREATE INDEX "FinanceEntry_companyId_categoryId_idx" ON "FinanceEntry"("companyId", "categoryId");
