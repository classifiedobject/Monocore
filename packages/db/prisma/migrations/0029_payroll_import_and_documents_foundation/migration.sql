ALTER TABLE "PayrollEmploymentRecord"
  ADD COLUMN IF NOT EXISTS "sgkEntryDocumentPath" TEXT,
  ADD COLUMN IF NOT EXISTS "sgkEntryDocumentName" TEXT,
  ADD COLUMN IF NOT EXISTS "sgkExitDocumentPath" TEXT,
  ADD COLUMN IF NOT EXISTS "sgkExitDocumentName" TEXT;

ALTER TABLE "PayrollCompensationProfile"
  ADD COLUMN IF NOT EXISTS "matrixRowId" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PayrollCompensationProfile_matrixRowId_fkey'
  ) THEN
    ALTER TABLE "PayrollCompensationProfile"
      ADD CONSTRAINT "PayrollCompensationProfile_matrixRowId_fkey"
      FOREIGN KEY ("matrixRowId") REFERENCES "PayrollCompensationMatrixRow"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "PayrollCompensationProfile_companyId_matrixRowId_idx"
  ON "PayrollCompensationProfile"("companyId", "matrixRowId");
