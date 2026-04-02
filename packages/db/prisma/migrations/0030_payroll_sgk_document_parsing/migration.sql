ALTER TABLE "PayrollEmploymentRecord"
  ADD COLUMN "sgkEntryParsedIdentityNumber" TEXT,
  ADD COLUMN "sgkEntryParsedFullName" TEXT,
  ADD COLUMN "sgkEntryParsedStartDate" TIMESTAMP(3),
  ADD COLUMN "sgkEntryDocumentVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sgkExitParsedIdentityNumber" TEXT,
  ADD COLUMN "sgkExitParsedFullName" TEXT,
  ADD COLUMN "sgkExitParsedExitDate" TIMESTAMP(3),
  ADD COLUMN "sgkExitDocumentVerified" BOOLEAN NOT NULL DEFAULT false;
