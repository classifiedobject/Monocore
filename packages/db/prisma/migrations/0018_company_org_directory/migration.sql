CREATE TABLE "CompanyDepartment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "parentId" UUID,
  "tipDepartment" "EmployeeDepartment" NOT NULL DEFAULT 'OTHER',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyDepartment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyTitle" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "departmentId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "tipWeight" DECIMAL(8,2) NOT NULL DEFAULT 1,
  "isTipEligible" BOOLEAN NOT NULL DEFAULT true,
  "departmentAggregate" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyTitle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyEmployeeDirectory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "userId" UUID,
  "titleId" UUID NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyEmployeeDirectory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TipAdvance"
  ADD COLUMN "directoryEmployeeId" UUID,
  ALTER COLUMN "employeeId" DROP NOT NULL;

ALTER TABLE "TipWeekDistribution"
  ADD COLUMN "directoryEmployeeId" UUID,
  ALTER COLUMN "employeeId" DROP NOT NULL;

CREATE INDEX "CompanyDepartment_companyId_isActive_idx" ON "CompanyDepartment"("companyId", "isActive");
CREATE INDEX "CompanyDepartment_companyId_parentId_idx" ON "CompanyDepartment"("companyId", "parentId");
CREATE INDEX "CompanyTitle_companyId_isActive_idx" ON "CompanyTitle"("companyId", "isActive");
CREATE INDEX "CompanyTitle_companyId_departmentId_idx" ON "CompanyTitle"("companyId", "departmentId");
CREATE INDEX "CompanyEmployeeDirectory_companyId_isActive_idx" ON "CompanyEmployeeDirectory"("companyId", "isActive");
CREATE INDEX "CompanyEmployeeDirectory_companyId_titleId_idx" ON "CompanyEmployeeDirectory"("companyId", "titleId");
CREATE INDEX "CompanyEmployeeDirectory_companyId_userId_idx" ON "CompanyEmployeeDirectory"("companyId", "userId");
CREATE INDEX "TipAdvance_companyId_directoryEmployeeId_idx" ON "TipAdvance"("companyId", "directoryEmployeeId");
CREATE INDEX "TipWeekDistribution_companyId_directoryEmployeeId_idx" ON "TipWeekDistribution"("companyId", "directoryEmployeeId");
CREATE UNIQUE INDEX "TipWeekDistribution_tipWeekId_directoryEmployeeId_key" ON "TipWeekDistribution"("tipWeekId", "directoryEmployeeId");

ALTER TABLE "CompanyDepartment"
  ADD CONSTRAINT "CompanyDepartment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyDepartment"
  ADD CONSTRAINT "CompanyDepartment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CompanyDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompanyTitle"
  ADD CONSTRAINT "CompanyTitle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyTitle"
  ADD CONSTRAINT "CompanyTitle_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "CompanyDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompanyEmployeeDirectory"
  ADD CONSTRAINT "CompanyEmployeeDirectory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyEmployeeDirectory"
  ADD CONSTRAINT "CompanyEmployeeDirectory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyEmployeeDirectory"
  ADD CONSTRAINT "CompanyEmployeeDirectory_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "CompanyTitle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TipAdvance" DROP CONSTRAINT "TipAdvance_employeeId_fkey";
ALTER TABLE "TipAdvance"
  ADD CONSTRAINT "TipAdvance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TipAdvance"
  ADD CONSTRAINT "TipAdvance_directoryEmployeeId_fkey" FOREIGN KEY ("directoryEmployeeId") REFERENCES "CompanyEmployeeDirectory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TipWeekDistribution" DROP CONSTRAINT "TipWeekDistribution_employeeId_fkey";
ALTER TABLE "TipWeekDistribution"
  ADD CONSTRAINT "TipWeekDistribution_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TipWeekDistribution"
  ADD CONSTRAINT "TipWeekDistribution_directoryEmployeeId_fkey" FOREIGN KEY ("directoryEmployeeId") REFERENCES "CompanyEmployeeDirectory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
