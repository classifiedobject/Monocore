CREATE TABLE "TipDepartmentRule" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "departmentId" UUID NOT NULL,
  "defaultTipWeight" DECIMAL(10,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TipDepartmentRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TipTitleRule" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "titleId" UUID NOT NULL,
  "departmentId" UUID NOT NULL,
  "tipWeight" DECIMAL(10,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TipTitleRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TipDepartmentRule_companyId_departmentId_key" ON "TipDepartmentRule"("companyId", "departmentId");
CREATE INDEX "TipDepartmentRule_companyId_departmentId_idx" ON "TipDepartmentRule"("companyId", "departmentId");
CREATE INDEX "TipDepartmentRule_companyId_isActive_idx" ON "TipDepartmentRule"("companyId", "isActive");

CREATE UNIQUE INDEX "TipTitleRule_companyId_titleId_key" ON "TipTitleRule"("companyId", "titleId");
CREATE INDEX "TipTitleRule_companyId_departmentId_idx" ON "TipTitleRule"("companyId", "departmentId");
CREATE INDEX "TipTitleRule_companyId_titleId_idx" ON "TipTitleRule"("companyId", "titleId");
CREATE INDEX "TipTitleRule_companyId_isActive_idx" ON "TipTitleRule"("companyId", "isActive");

ALTER TABLE "TipDepartmentRule"
  ADD CONSTRAINT "TipDepartmentRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TipDepartmentRule"
  ADD CONSTRAINT "TipDepartmentRule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "CompanyDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TipTitleRule"
  ADD CONSTRAINT "TipTitleRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TipTitleRule"
  ADD CONSTRAINT "TipTitleRule_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "CompanyTitle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TipTitleRule"
  ADD CONSTRAINT "TipTitleRule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "CompanyDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
