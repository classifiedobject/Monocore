CREATE TYPE "SalaryType" AS ENUM ('FIXED', 'HOURLY');
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('DRAFT', 'CALCULATED', 'POSTED');
CREATE TYPE "TipDistributionMethod" AS ENUM ('EQUAL', 'HOURS_WEIGHTED');

CREATE TABLE "Employee" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "roleId" UUID,
  "profitCenterId" UUID,
  "hireDate" TIMESTAMP(3) NOT NULL,
  "salaryType" "SalaryType" NOT NULL,
  "baseSalary" DECIMAL(14,2),
  "hourlyRate" DECIMAL(14,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "hoursWorked" DECIMAL(8,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollPeriod" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'DRAFT',
  "totalGross" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalNet" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollLine" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "payrollPeriodId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "grossAmount" DECIMAL(14,2) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TipPool" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "totalTips" DECIMAL(14,2) NOT NULL,
  "distributionMethod" "TipDistributionMethod" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TipPool_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TipDistribution" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "tipPoolId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TipDistribution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Employee_companyId_isActive_idx" ON "Employee"("companyId", "isActive");
CREATE INDEX "Employee_companyId_roleId_idx" ON "Employee"("companyId", "roleId");
CREATE INDEX "Employee_companyId_profitCenterId_idx" ON "Employee"("companyId", "profitCenterId");

CREATE INDEX "WorkLog_companyId_employeeId_date_idx" ON "WorkLog"("companyId", "employeeId", "date");
CREATE INDEX "WorkLog_companyId_date_idx" ON "WorkLog"("companyId", "date");

CREATE INDEX "PayrollPeriod_companyId_status_idx" ON "PayrollPeriod"("companyId", "status");
CREATE INDEX "PayrollPeriod_companyId_startDate_endDate_idx" ON "PayrollPeriod"("companyId", "startDate", "endDate");

CREATE UNIQUE INDEX "PayrollLine_payrollPeriodId_employeeId_key" ON "PayrollLine"("payrollPeriodId", "employeeId");
CREATE INDEX "PayrollLine_companyId_payrollPeriodId_idx" ON "PayrollLine"("companyId", "payrollPeriodId");

CREATE INDEX "TipPool_companyId_periodStart_periodEnd_idx" ON "TipPool"("companyId", "periodStart", "periodEnd");

CREATE UNIQUE INDEX "TipDistribution_tipPoolId_employeeId_key" ON "TipDistribution"("tipPoolId", "employeeId");
CREATE INDEX "TipDistribution_companyId_tipPoolId_idx" ON "TipDistribution"("companyId", "tipPoolId");

ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "CompanyRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_profitCenterId_fkey" FOREIGN KEY ("profitCenterId") REFERENCES "FinanceProfitCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkLog"
  ADD CONSTRAINT "WorkLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkLog"
  ADD CONSTRAINT "WorkLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollPeriod"
  ADD CONSTRAINT "PayrollPeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollLine"
  ADD CONSTRAINT "PayrollLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollLine"
  ADD CONSTRAINT "PayrollLine_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollLine"
  ADD CONSTRAINT "PayrollLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TipPool"
  ADD CONSTRAINT "TipPool_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TipDistribution"
  ADD CONSTRAINT "TipDistribution_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TipDistribution"
  ADD CONSTRAINT "TipDistribution_tipPoolId_fkey" FOREIGN KEY ("tipPoolId") REFERENCES "TipPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TipDistribution"
  ADD CONSTRAINT "TipDistribution_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
