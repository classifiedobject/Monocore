ALTER TYPE "ModuleStatus" ADD VALUE IF NOT EXISTS 'DEPRECATED';

CREATE TABLE "CompanyEntitlement" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "moduleKey" TEXT NOT NULL REFERENCES "Module"("key") ON DELETE CASCADE,
  "limits" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("companyId", "moduleKey")
);

CREATE INDEX "CompanyEntitlement_companyId_idx" ON "CompanyEntitlement"("companyId");
