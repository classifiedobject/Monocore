CREATE TYPE "EmployeeDepartment" AS ENUM ('SERVICE', 'BAR', 'KITCHEN', 'SUPPORT', 'OTHER');
CREATE TYPE "TipWeekStatus" AS ENUM ('DRAFT', 'CALCULATED', 'LOCKED', 'PAID');

ALTER TABLE "Employee"
  ADD COLUMN "tipWeight" DECIMAL(8,2) NOT NULL DEFAULT 1,
  ADD COLUMN "department" "EmployeeDepartment" NOT NULL DEFAULT 'SERVICE';

CREATE TABLE "TipConfiguration" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "serviceRate" DECIMAL(6,4) NOT NULL,
  "serviceTaxDeductionRate" DECIMAL(6,4) NOT NULL DEFAULT 0.4,
  "visaTaxDeductionRate" DECIMAL(6,4) NOT NULL DEFAULT 0.4,
  "defaultWastePoints" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "allowDepartmentSubPool" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TipConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TipWeek" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "serviceRateUsed" DECIMAL(6,4) NOT NULL,
  "wastePointsUsed" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "totalPoolGross" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalPoolNet" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalDistributed" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status" "TipWeekStatus" NOT NULL DEFAULT 'DRAFT',
  "payableDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TipWeek_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TipDailyInput" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "grossRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "discounts" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "comps" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "wastageSales" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "serviceRevenueCalculated" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "netServiceRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "netServiceFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "cashTips" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "visaTipsGross" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "visaTipsNet" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "expenseAdjustments" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TipDailyInput_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TipAdvance" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "tipWeekId" UUID NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "approvedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TipAdvance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TipDepartmentOverride" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "tipWeekId" UUID NOT NULL,
  "department" "EmployeeDepartment" NOT NULL,
  "overrideWeight" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TipDepartmentOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TipWeekDistribution" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "tipWeekId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "tipWeightUsed" DECIMAL(10,2) NOT NULL,
  "grossShare" DECIMAL(14,2) NOT NULL,
  "advanceDeducted" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "netShare" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TipWeekDistribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TipConfiguration_companyId_key" ON "TipConfiguration"("companyId");
CREATE INDEX "TipWeek_companyId_periodStart_periodEnd_idx" ON "TipWeek"("companyId", "periodStart", "periodEnd");
CREATE INDEX "TipWeek_companyId_status_idx" ON "TipWeek"("companyId", "status");
CREATE UNIQUE INDEX "TipDailyInput_companyId_date_key" ON "TipDailyInput"("companyId", "date");
CREATE INDEX "TipDailyInput_companyId_date_idx" ON "TipDailyInput"("companyId", "date");
CREATE INDEX "TipAdvance_companyId_tipWeekId_idx" ON "TipAdvance"("companyId", "tipWeekId");
CREATE INDEX "TipAdvance_companyId_employeeId_idx" ON "TipAdvance"("companyId", "employeeId");
CREATE UNIQUE INDEX "TipDepartmentOverride_tipWeekId_department_key" ON "TipDepartmentOverride"("tipWeekId", "department");
CREATE INDEX "TipDepartmentOverride_companyId_tipWeekId_idx" ON "TipDepartmentOverride"("companyId", "tipWeekId");
CREATE UNIQUE INDEX "TipWeekDistribution_tipWeekId_employeeId_key" ON "TipWeekDistribution"("tipWeekId", "employeeId");
CREATE INDEX "TipWeekDistribution_companyId_tipWeekId_idx" ON "TipWeekDistribution"("companyId", "tipWeekId");
CREATE INDEX "TipWeekDistribution_companyId_employeeId_idx" ON "TipWeekDistribution"("companyId", "employeeId");

ALTER TABLE "TipConfiguration"
  ADD CONSTRAINT "TipConfiguration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TipWeek"
  ADD CONSTRAINT "TipWeek_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TipDailyInput"
  ADD CONSTRAINT "TipDailyInput_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TipAdvance"
  ADD CONSTRAINT "TipAdvance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TipAdvance"
  ADD CONSTRAINT "TipAdvance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TipAdvance"
  ADD CONSTRAINT "TipAdvance_tipWeekId_fkey" FOREIGN KEY ("tipWeekId") REFERENCES "TipWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TipAdvance"
  ADD CONSTRAINT "TipAdvance_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TipDepartmentOverride"
  ADD CONSTRAINT "TipDepartmentOverride_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TipDepartmentOverride"
  ADD CONSTRAINT "TipDepartmentOverride_tipWeekId_fkey" FOREIGN KEY ("tipWeekId") REFERENCES "TipWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TipWeekDistribution"
  ADD CONSTRAINT "TipWeekDistribution_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TipWeekDistribution"
  ADD CONSTRAINT "TipWeekDistribution_tipWeekId_fkey" FOREIGN KEY ("tipWeekId") REFERENCES "TipWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TipWeekDistribution"
  ADD CONSTRAINT "TipWeekDistribution_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
