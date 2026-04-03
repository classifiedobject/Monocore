ALTER TABLE "PayrollEmploymentRecord"
  ADD COLUMN IF NOT EXISTS "sgkEntryParsedIdentityNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "sgkEntryParsedFullName" TEXT,
  ADD COLUMN IF NOT EXISTS "sgkEntryParsedStartDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sgkEntryDocumentVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sgkExitParsedIdentityNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "sgkExitParsedFullName" TEXT,
  ADD COLUMN IF NOT EXISTS "sgkExitParsedExitDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sgkExitDocumentVerified" BOOLEAN NOT NULL DEFAULT false;
