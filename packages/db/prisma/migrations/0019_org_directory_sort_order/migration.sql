ALTER TABLE "CompanyDepartment"
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 1000;

ALTER TABLE "CompanyTitle"
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 1000;

UPDATE "CompanyDepartment" SET "sortOrder" = 1000 WHERE "sortOrder" IS NULL;
UPDATE "CompanyTitle" SET "sortOrder" = 1000 WHERE "sortOrder" IS NULL;
