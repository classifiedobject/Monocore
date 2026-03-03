CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "TaskScheduleType" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');
CREATE TYPE "TaskAssigneeType" AS ENUM ('USER', 'ROLE');
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELED');

CREATE TABLE "TaskBoard" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "TaskBoard_companyId_name_key" ON "TaskBoard"("companyId", "name");
CREATE INDEX "TaskBoard_companyId_idx" ON "TaskBoard"("companyId");

CREATE TABLE "TaskTemplate" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "boardId" UUID REFERENCES "TaskBoard"("id") ON DELETE SET NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
  "scheduleType" "TaskScheduleType" NOT NULL DEFAULT 'NONE',
  "scheduleMeta" JSONB,
  "defaultAssigneeType" "TaskAssigneeType" NOT NULL,
  "defaultAssigneeUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "defaultAssigneeRoleId" UUID REFERENCES "CompanyRole"("id") ON DELETE SET NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "TaskTemplate_companyId_isActive_idx" ON "TaskTemplate"("companyId", "isActive");
CREATE INDEX "TaskTemplate_companyId_scheduleType_isActive_idx" ON "TaskTemplate"("companyId", "scheduleType", "isActive");
CREATE INDEX "TaskTemplate_companyId_defaultAssigneeUserId_idx" ON "TaskTemplate"("companyId", "defaultAssigneeUserId");
CREATE INDEX "TaskTemplate_companyId_defaultAssigneeRoleId_idx" ON "TaskTemplate"("companyId", "defaultAssigneeRoleId");

CREATE TABLE "TaskInstance" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "templateId" UUID REFERENCES "TaskTemplate"("id") ON DELETE SET NULL,
  "boardId" UUID REFERENCES "TaskBoard"("id") ON DELETE SET NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
  "assigneeUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "assigneeRoleId" UUID REFERENCES "CompanyRole"("id") ON DELETE SET NULL,
  "createdByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "completedAt" TIMESTAMP(3),
  "generatedDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "TaskInstance_companyId_dueDate_status_idx" ON "TaskInstance"("companyId", "dueDate", "status");
CREATE INDEX "TaskInstance_companyId_assigneeUserId_status_idx" ON "TaskInstance"("companyId", "assigneeUserId", "status");
CREATE INDEX "TaskInstance_companyId_assigneeRoleId_status_idx" ON "TaskInstance"("companyId", "assigneeRoleId", "status");
CREATE INDEX "TaskInstance_companyId_templateId_generatedDate_idx" ON "TaskInstance"("companyId", "templateId", "generatedDate");

CREATE TABLE "TaskComment" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "taskId" UUID NOT NULL REFERENCES "TaskInstance"("id") ON DELETE CASCADE,
  "authorUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "TaskComment_companyId_taskId_createdAt_idx" ON "TaskComment"("companyId", "taskId", "createdAt");
