DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PayrollEmploymentStatus') THEN
    CREATE TYPE "PayrollEmploymentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXITED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PayrollInsuranceStatus') THEN
    CREATE TYPE "PayrollInsuranceStatus" AS ENUM ('PENDING', 'INSURED', 'EXITED');
  END IF;
END $$;

ALTER TYPE "PayrollPeriodStatus" ADD VALUE IF NOT EXISTS 'LOCKED';

CREATE TABLE "PayrollEmployee" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "identityNumber" TEXT,
  "gender" TEXT,
  "birthDate" TIMESTAMP(3),
  "ibanOrBankAccount" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollEmployee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollEmploymentRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "departmentName" TEXT,
  "titleName" TEXT,
  "arrivalDate" TIMESTAMP(3) NOT NULL,
  "accrualStartDate" TIMESTAMP(3) NOT NULL,
  "sgkStartDate" TIMESTAMP(3),
  "exitDate" TIMESTAMP(3),
  "status" "PayrollEmploymentStatus" NOT NULL DEFAULT 'DRAFT',
  "insuranceStatus" "PayrollInsuranceStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollEmploymentRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollCompensationProfile" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "employmentRecordId" UUID NOT NULL,
  "targetAccrualSalary" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "officialNetSalary" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "overtimeEligible" BOOLEAN NOT NULL DEFAULT true,
  "bonusEligible" BOOLEAN NOT NULL DEFAULT true,
  "handCashAllowed" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollCompensationProfile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PayrollPeriod"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "PayrollLine"
  ADD COLUMN "employmentRecordId" UUID,
  ADD COLUMN "departmentName" TEXT,
  ADD COLUMN "titleName" TEXT,
  ADD COLUMN "accrualDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "officialDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reportDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "targetAccrualSalary" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "officialNetSalary" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "accrualPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "officialPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "calculatedBonus" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "calculatedOvertime" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "handCashRecommended" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "handCashFinal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "bonusAdjustment" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "totalPayable" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "difference" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "controlOk" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sourceCompensationProfileId" UUID,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "PayrollLine"
  ALTER COLUMN "grossAmount" SET DEFAULT 0;

INSERT INTO "PayrollEmployee" (
  "id", "companyId", "firstName", "lastName", "isActive", "createdAt", "updatedAt"
)
SELECT
  e."id",
  e."companyId",
  e."firstName",
  e."lastName",
  e."isActive",
  e."createdAt",
  COALESCE(e."updatedAt", CURRENT_TIMESTAMP)
FROM "Employee" e
WHERE NOT EXISTS (
  SELECT 1 FROM "PayrollEmployee" pe WHERE pe."id" = e."id"
);

INSERT INTO "PayrollEmploymentRecord" (
  "companyId",
  "employeeId",
  "arrivalDate",
  "accrualStartDate",
  "sgkStartDate",
  "status",
  "insuranceStatus",
  "createdAt",
  "updatedAt"
)
SELECT
  e."companyId",
  e."id",
  e."hireDate",
  e."hireDate",
  e."hireDate",
  CASE WHEN e."isActive" THEN 'ACTIVE'::"PayrollEmploymentStatus" ELSE 'EXITED'::"PayrollEmploymentStatus" END,
  CASE WHEN e."isActive" THEN 'INSURED'::"PayrollInsuranceStatus" ELSE 'EXITED'::"PayrollInsuranceStatus" END,
  e."createdAt",
  COALESCE(e."updatedAt", CURRENT_TIMESTAMP)
FROM "Employee" e
WHERE NOT EXISTS (
  SELECT 1
  FROM "PayrollEmploymentRecord" per
  WHERE per."companyId" = e."companyId"
    AND per."employeeId" = e."id"
    AND per."arrivalDate" = e."hireDate"
);

INSERT INTO "PayrollCompensationProfile" (
  "companyId",
  "employmentRecordId",
  "targetAccrualSalary",
  "officialNetSalary",
  "overtimeEligible",
  "bonusEligible",
  "handCashAllowed",
  "effectiveFrom",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  per."companyId",
  per."id",
  COALESCE(e."baseSalary", 0),
  COALESCE(e."baseSalary", 0),
  true,
  true,
  true,
  per."arrivalDate",
  true,
  per."createdAt",
  per."updatedAt"
FROM "PayrollEmploymentRecord" per
JOIN "Employee" e ON e."id" = per."employeeId"
WHERE NOT EXISTS (
  SELECT 1 FROM "PayrollCompensationProfile" pcp WHERE pcp."employmentRecordId" = per."id"
);

UPDATE "PayrollLine" pl
SET
  "employmentRecordId" = per."id",
  "departmentName" = per."departmentName",
  "titleName" = per."titleName",
  "targetAccrualSalary" = COALESCE(pcp."targetAccrualSalary", pl."grossAmount"),
  "officialNetSalary" = COALESCE(pcp."officialNetSalary", pl."grossAmount"),
  "accrualPay" = pl."grossAmount",
  "totalPayable" = pl."grossAmount",
  "controlOk" = true,
  "sourceCompensationProfileId" = pcp."id"
FROM "PayrollEmploymentRecord" per
LEFT JOIN "PayrollCompensationProfile" pcp ON pcp."employmentRecordId" = per."id" AND pcp."isActive" = true
WHERE pl."employeeId" = per."employeeId"
  AND pl."employmentRecordId" IS NULL;

ALTER TABLE "PayrollLine"
  ALTER COLUMN "employmentRecordId" SET NOT NULL;

DROP INDEX IF EXISTS "PayrollLine_payrollPeriodId_employeeId_key";
CREATE UNIQUE INDEX "PayrollLine_payrollPeriodId_employmentRecordId_key" ON "PayrollLine"("payrollPeriodId", "employmentRecordId");
CREATE INDEX "PayrollLine_companyId_employeeId_idx" ON "PayrollLine"("companyId", "employeeId");

CREATE INDEX "PayrollEmployee_companyId_lastName_firstName_idx" ON "PayrollEmployee"("companyId", "lastName", "firstName");
CREATE INDEX "PayrollEmployee_companyId_identityNumber_idx" ON "PayrollEmployee"("companyId", "identityNumber");

CREATE INDEX "PayrollEmploymentRecord_companyId_employeeId_idx" ON "PayrollEmploymentRecord"("companyId", "employeeId");
CREATE INDEX "PayrollEmploymentRecord_companyId_status_idx" ON "PayrollEmploymentRecord"("companyId", "status");
CREATE INDEX "PayrollEmploymentRecord_companyId_arrivalDate_idx" ON "PayrollEmploymentRecord"("companyId", "arrivalDate");

CREATE INDEX "PayrollCompensationProfile_companyId_employmentRecordId_idx" ON "PayrollCompensationProfile"("companyId", "employmentRecordId");
CREATE INDEX "PayrollCompensationProfile_companyId_isActive_idx" ON "PayrollCompensationProfile"("companyId", "isActive");
CREATE INDEX "PayrollCompensationProfile_companyId_effectiveFrom_idx" ON "PayrollCompensationProfile"("companyId", "effectiveFrom");

ALTER TABLE "PayrollEmployee"
  ADD CONSTRAINT "PayrollEmployee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollEmploymentRecord"
  ADD CONSTRAINT "PayrollEmploymentRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollEmploymentRecord"
  ADD CONSTRAINT "PayrollEmploymentRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "PayrollEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollCompensationProfile"
  ADD CONSTRAINT "PayrollCompensationProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollCompensationProfile"
  ADD CONSTRAINT "PayrollCompensationProfile_employmentRecordId_fkey" FOREIGN KEY ("employmentRecordId") REFERENCES "PayrollEmploymentRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollLine" DROP CONSTRAINT "PayrollLine_employeeId_fkey";
ALTER TABLE "PayrollLine"
  ADD CONSTRAINT "PayrollLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "PayrollEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollLine"
  ADD CONSTRAINT "PayrollLine_employmentRecordId_fkey" FOREIGN KEY ("employmentRecordId") REFERENCES "PayrollEmploymentRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollLine"
  ADD CONSTRAINT "PayrollLine_sourceCompensationProfileId_fkey" FOREIGN KEY ("sourceCompensationProfileId") REFERENCES "PayrollCompensationProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
