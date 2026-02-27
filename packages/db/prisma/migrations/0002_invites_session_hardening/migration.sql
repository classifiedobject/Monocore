ALTER TABLE "Session"
  ADD COLUMN "absoluteExpiresAt" TIMESTAMP(3),
  ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Session" SET "absoluteExpiresAt" = "expiresAt" WHERE "absoluteExpiresAt" IS NULL;
ALTER TABLE "Session" ALTER COLUMN "absoluteExpiresAt" SET NOT NULL;

CREATE TABLE "PlatformInvite" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "roleId" UUID REFERENCES "PlatformRole"("id") ON DELETE SET NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE "CompanyInvite" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "roleId" UUID REFERENCES "CompanyRole"("id") ON DELETE SET NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "PlatformInvite_email_idx" ON "PlatformInvite"("email");
CREATE INDEX "PlatformInvite_createdAt_idx" ON "PlatformInvite"("createdAt");
CREATE INDEX "CompanyInvite_companyId_email_idx" ON "CompanyInvite"("companyId", "email");
CREATE INDEX "CompanyInvite_createdAt_idx" ON "CompanyInvite"("createdAt");
