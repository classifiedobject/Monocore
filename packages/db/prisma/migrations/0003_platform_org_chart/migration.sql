CREATE TABLE "PlatformDepartment" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "parentId" UUID REFERENCES "PlatformDepartment"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PlatformTitle" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PlatformUserProfile" (
  "userId" UUID PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "departmentId" UUID REFERENCES "PlatformDepartment"("id") ON DELETE SET NULL,
  "titleId" UUID REFERENCES "PlatformTitle"("id") ON DELETE SET NULL,
  "managerUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "PlatformDepartment_parentId_idx" ON "PlatformDepartment"("parentId");
CREATE INDEX "PlatformUserProfile_departmentId_idx" ON "PlatformUserProfile"("departmentId");
CREATE INDEX "PlatformUserProfile_titleId_idx" ON "PlatformUserProfile"("titleId");
CREATE INDEX "PlatformUserProfile_managerUserId_idx" ON "PlatformUserProfile"("managerUserId");
