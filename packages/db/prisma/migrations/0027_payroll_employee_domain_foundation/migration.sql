-- CreateEnum
CREATE TYPE "PayrollGender" AS ENUM ('FEMALE', 'MALE', 'OTHER', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "PayrollEmploymentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXITED');

-- CreateEnum
CREATE TYPE "PayrollInsuranceStatus" AS ENUM ('PENDING', 'INSURED', 'EXITED');

-- CreateTable
CREATE TABLE "PayrollEmployee" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "identityNumber" TEXT,
  "gender" "PayrollGender",
  "birthDate" TIMESTAMP(3),
  "ibanOrBankAccount" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PayrollEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEmploymentRecord" (
  "id" UUID NOT NULL,
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
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PayrollEmploymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollCompensationProfile" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "employmentRecordId" UUID NOT NULL,
  "targetAccrualSalary" DECIMAL(14,2) NOT NULL,
  "officialNetSalary" DECIMAL(14,2) NOT NULL,
  "overtimeEligible" BOOLEAN NOT NULL DEFAULT true,
  "bonusEligible" BOOLEAN NOT NULL DEFAULT true,
  "handCashAllowed" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PayrollCompensationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollEmployee_companyId_lastName_firstName_idx" ON "PayrollEmployee"("companyId", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "PayrollEmployee_companyId_identityNumber_idx" ON "PayrollEmployee"("companyId", "identityNumber");

-- CreateIndex
CREATE INDEX "PayrollEmploymentRecord_companyId_employeeId_idx" ON "PayrollEmploymentRecord"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "PayrollEmploymentRecord_companyId_status_idx" ON "PayrollEmploymentRecord"("companyId", "status");

-- CreateIndex
CREATE INDEX "PayrollEmploymentRecord_companyId_arrivalDate_idx" ON "PayrollEmploymentRecord"("companyId", "arrivalDate");

-- CreateIndex
CREATE INDEX "PayrollCompensationProfile_companyId_employmentRecordId_idx" ON "PayrollCompensationProfile"("companyId", "employmentRecordId");

-- CreateIndex
CREATE INDEX "PayrollCompensationProfile_companyId_isActive_idx" ON "PayrollCompensationProfile"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "PayrollCompensationProfile_companyId_effectiveFrom_idx" ON "PayrollCompensationProfile"("companyId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "PayrollEmployee"
  ADD CONSTRAINT "PayrollEmployee_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEmploymentRecord"
  ADD CONSTRAINT "PayrollEmploymentRecord_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEmploymentRecord"
  ADD CONSTRAINT "PayrollEmploymentRecord_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "PayrollEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollCompensationProfile"
  ADD CONSTRAINT "PayrollCompensationProfile_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollCompensationProfile"
  ADD CONSTRAINT "PayrollCompensationProfile_employmentRecordId_fkey"
  FOREIGN KEY ("employmentRecordId") REFERENCES "PayrollEmploymentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
