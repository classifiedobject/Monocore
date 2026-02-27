CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "ModuleStatus" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "InstallationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');

CREATE TABLE "User" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL UNIQUE,
  "fullName" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Session" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tokenHash" TEXT NOT NULL UNIQUE,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "ip" TEXT,
  "userAgent" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3)
);

CREATE TABLE "PlatformMembership" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "invitedById" UUID,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PlatformRole" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PlatformPermission" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PlatformRolePermission" (
  "roleId" UUID NOT NULL REFERENCES "PlatformRole"("id") ON DELETE CASCADE,
  "permissionId" UUID NOT NULL REFERENCES "PlatformPermission"("id") ON DELETE CASCADE,
  PRIMARY KEY ("roleId", "permissionId")
);

CREATE TABLE "PlatformUserRole" (
  "membershipId" UUID NOT NULL REFERENCES "PlatformMembership"("id") ON DELETE CASCADE,
  "roleId" UUID NOT NULL REFERENCES "PlatformRole"("id") ON DELETE CASCADE,
  PRIMARY KEY ("membershipId", "roleId")
);

CREATE TABLE "Company" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "plan" TEXT NOT NULL DEFAULT 'free',
  "locale" TEXT NOT NULL DEFAULT 'en',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Location" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "CompanyMembership" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "invitedById" UUID,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("companyId", "userId")
);

CREATE TABLE "CompanyRole" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("companyId", "key")
);

CREATE TABLE "CompanyPermission" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "CompanyRolePermission" (
  "roleId" UUID NOT NULL REFERENCES "CompanyRole"("id") ON DELETE CASCADE,
  "permissionId" UUID NOT NULL REFERENCES "CompanyPermission"("id") ON DELETE CASCADE,
  PRIMARY KEY ("roleId", "permissionId")
);

CREATE TABLE "CompanyMemberRole" (
  "membershipId" UUID NOT NULL REFERENCES "CompanyMembership"("id") ON DELETE CASCADE,
  "roleId" UUID NOT NULL REFERENCES "CompanyRole"("id") ON DELETE CASCADE,
  PRIMARY KEY ("membershipId", "roleId")
);

CREATE TABLE "Module" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "version" TEXT NOT NULL,
  "status" "ModuleStatus" NOT NULL,
  "dependencies" JSONB NOT NULL DEFAULT '{}',
  "pricingMeta" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ModuleInstallation" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "moduleKey" TEXT NOT NULL REFERENCES "Module"("key") ON DELETE CASCADE,
  "status" "InstallationStatus" NOT NULL DEFAULT 'PENDING',
  "config" JSONB NOT NULL DEFAULT '{}',
  "installedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("companyId", "moduleKey")
);

CREATE TABLE "SiteSetting" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL UNIQUE,
  "value" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "LanguagePack" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "locale" TEXT NOT NULL,
  "namespace" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("locale", "namespace", "key")
);

CREATE TABLE "PlatformAuditLog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "CompanyAuditLog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Location_companyId_idx" ON "Location"("companyId");
CREATE INDEX "CompanyMembership_userId_idx" ON "CompanyMembership"("userId");
CREATE INDEX "CompanyRole_companyId_idx" ON "CompanyRole"("companyId");
CREATE INDEX "PlatformAuditLog_createdAt_idx" ON "PlatformAuditLog"("createdAt");
CREATE INDEX "CompanyAuditLog_companyId_createdAt_idx" ON "CompanyAuditLog"("companyId", "createdAt");
