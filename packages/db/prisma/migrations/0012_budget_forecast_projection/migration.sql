CREATE TYPE "FinanceBudgetDirection" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "FinanceCashflowDirection" AS ENUM ('INFLOW', 'OUTFLOW');

CREATE TABLE "FinanceBudget" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'TRY',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "FinanceBudget_companyId_year_isActive_idx" ON "FinanceBudget"("companyId", "year", "isActive");

CREATE TABLE "FinanceBudgetLine" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "budgetId" UUID NOT NULL REFERENCES "FinanceBudget"("id") ON DELETE CASCADE,
  "month" INTEGER NOT NULL,
  "direction" "FinanceBudgetDirection" NOT NULL,
  "categoryId" UUID REFERENCES "FinanceCategory"("id") ON DELETE SET NULL,
  "profitCenterId" UUID REFERENCES "FinanceProfitCenter"("id") ON DELETE SET NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "FinanceBudgetLine_companyId_budgetId_month_idx" ON "FinanceBudgetLine"("companyId", "budgetId", "month");
CREATE INDEX "FinanceBudgetLine_companyId_categoryId_idx" ON "FinanceBudgetLine"("companyId", "categoryId");
CREATE INDEX "FinanceBudgetLine_companyId_profitCenterId_idx" ON "FinanceBudgetLine"("companyId", "profitCenterId");

CREATE TABLE "FinanceCashflowForecastItem" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "direction" "FinanceCashflowDirection" NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'TRY',
  "description" TEXT NOT NULL,
  "profitCenterId" UUID REFERENCES "FinanceProfitCenter"("id") ON DELETE SET NULL,
  "createdByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "FinanceCashflowForecastItem_companyId_date_idx" ON "FinanceCashflowForecastItem"("companyId", "date");
CREATE INDEX "FinanceCashflowForecastItem_companyId_direction_date_idx" ON "FinanceCashflowForecastItem"("companyId", "direction", "date");
