CREATE TABLE "PayrollCompensationMatrixRow" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "targetAccrualSalary" DECIMAL(14,2) NOT NULL,
  "officialNetSalary" DECIMAL(14,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PayrollCompensationMatrixRow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PayrollCompensationMatrixRow_companyId_targetAccrualSalary_idx"
ON "PayrollCompensationMatrixRow"("companyId", "targetAccrualSalary");

CREATE INDEX "PayrollCompensationMatrixRow_companyId_isActive_idx"
ON "PayrollCompensationMatrixRow"("companyId", "isActive");

ALTER TABLE "PayrollCompensationMatrixRow"
ADD CONSTRAINT "PayrollCompensationMatrixRow_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
