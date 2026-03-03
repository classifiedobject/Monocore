ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "onboardingStep" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "FinanceInvoice_companyId_dueDate_status_idx" ON "FinanceInvoice"("companyId", "dueDate", "status");
CREATE INDEX IF NOT EXISTS "SalesOrder_companyId_orderDate_idx" ON "SalesOrder"("companyId", "orderDate");
