/*
  Warnings:

  - The primary key for the `Company` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `CompanyAuditLog` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `CompanyInvite` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `CompanyMemberRole` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `CompanyMembership` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `CompanyPermission` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `CompanyRole` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `CompanyRolePermission` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `LanguagePack` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Location` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Module` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ModuleInstallation` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PlatformAuditLog` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PlatformDepartment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PlatformInvite` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PlatformMembership` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PlatformPermission` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PlatformRole` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PlatformRolePermission` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PlatformTitle` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PlatformUserProfile` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PlatformUserRole` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Session` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `SiteSetting` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "CompanyAuditLog" DROP CONSTRAINT "CompanyAuditLog_actorUserId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyAuditLog" DROP CONSTRAINT "CompanyAuditLog_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyInvite" DROP CONSTRAINT "CompanyInvite_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyInvite" DROP CONSTRAINT "CompanyInvite_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyInvite" DROP CONSTRAINT "CompanyInvite_roleId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyMemberRole" DROP CONSTRAINT "CompanyMemberRole_membershipId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyMemberRole" DROP CONSTRAINT "CompanyMemberRole_roleId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyMembership" DROP CONSTRAINT "CompanyMembership_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyMembership" DROP CONSTRAINT "CompanyMembership_userId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyRole" DROP CONSTRAINT "CompanyRole_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyRolePermission" DROP CONSTRAINT "CompanyRolePermission_permissionId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyRolePermission" DROP CONSTRAINT "CompanyRolePermission_roleId_fkey";

-- DropForeignKey
ALTER TABLE "Location" DROP CONSTRAINT "Location_companyId_fkey";

-- DropForeignKey
ALTER TABLE "ModuleInstallation" DROP CONSTRAINT "ModuleInstallation_companyId_fkey";

-- DropForeignKey
ALTER TABLE "ModuleInstallation" DROP CONSTRAINT "ModuleInstallation_moduleKey_fkey";

-- DropForeignKey
ALTER TABLE "PlatformAuditLog" DROP CONSTRAINT "PlatformAuditLog_actorUserId_fkey";

-- DropForeignKey
ALTER TABLE "PlatformDepartment" DROP CONSTRAINT "PlatformDepartment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "PlatformInvite" DROP CONSTRAINT "PlatformInvite_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "PlatformInvite" DROP CONSTRAINT "PlatformInvite_roleId_fkey";

-- DropForeignKey
ALTER TABLE "PlatformMembership" DROP CONSTRAINT "PlatformMembership_userId_fkey";

-- DropForeignKey
ALTER TABLE "PlatformRolePermission" DROP CONSTRAINT "PlatformRolePermission_permissionId_fkey";

-- DropForeignKey
ALTER TABLE "PlatformRolePermission" DROP CONSTRAINT "PlatformRolePermission_roleId_fkey";

-- DropForeignKey
ALTER TABLE "PlatformUserProfile" DROP CONSTRAINT "PlatformUserProfile_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "PlatformUserProfile" DROP CONSTRAINT "PlatformUserProfile_managerUserId_fkey";

-- DropForeignKey
ALTER TABLE "PlatformUserProfile" DROP CONSTRAINT "PlatformUserProfile_titleId_fkey";

-- DropForeignKey
ALTER TABLE "PlatformUserProfile" DROP CONSTRAINT "PlatformUserProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "PlatformUserRole" DROP CONSTRAINT "PlatformUserRole_membershipId_fkey";

-- DropForeignKey
ALTER TABLE "PlatformUserRole" DROP CONSTRAINT "PlatformUserRole_roleId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- AlterTable
ALTER TABLE "Company" DROP CONSTRAINT "Company_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "Company_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "CompanyAuditLog" DROP CONSTRAINT "CompanyAuditLog_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "actorUserId" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ADD CONSTRAINT "CompanyAuditLog_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "CompanyInvite" DROP CONSTRAINT "CompanyInvite_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "roleId" SET DATA TYPE TEXT,
ALTER COLUMN "createdByUserId" SET DATA TYPE TEXT,
ADD CONSTRAINT "CompanyInvite_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "CompanyMemberRole" DROP CONSTRAINT "CompanyMemberRole_pkey",
ALTER COLUMN "membershipId" SET DATA TYPE TEXT,
ALTER COLUMN "roleId" SET DATA TYPE TEXT,
ADD CONSTRAINT "CompanyMemberRole_pkey" PRIMARY KEY ("membershipId", "roleId");

-- AlterTable
ALTER TABLE "CompanyMembership" DROP CONSTRAINT "CompanyMembership_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ALTER COLUMN "invitedById" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "CompanyMembership_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "CompanyPermission" DROP CONSTRAINT "CompanyPermission_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "CompanyPermission_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "CompanyRole" DROP CONSTRAINT "CompanyRole_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "CompanyRole_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "CompanyRolePermission" DROP CONSTRAINT "CompanyRolePermission_pkey",
ALTER COLUMN "roleId" SET DATA TYPE TEXT,
ALTER COLUMN "permissionId" SET DATA TYPE TEXT,
ADD CONSTRAINT "CompanyRolePermission_pkey" PRIMARY KEY ("roleId", "permissionId");

-- AlterTable
ALTER TABLE "LanguagePack" DROP CONSTRAINT "LanguagePack_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "LanguagePack_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Location" DROP CONSTRAINT "Location_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Location_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Module" DROP CONSTRAINT "Module_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "Module_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ModuleInstallation" DROP CONSTRAINT "ModuleInstallation_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ADD CONSTRAINT "ModuleInstallation_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PlatformAuditLog" DROP CONSTRAINT "PlatformAuditLog_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "actorUserId" SET DATA TYPE TEXT,
ADD CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PlatformDepartment" DROP CONSTRAINT "PlatformDepartment_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "parentId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "PlatformDepartment_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PlatformInvite" DROP CONSTRAINT "PlatformInvite_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "roleId" SET DATA TYPE TEXT,
ALTER COLUMN "createdByUserId" SET DATA TYPE TEXT,
ADD CONSTRAINT "PlatformInvite_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PlatformMembership" DROP CONSTRAINT "PlatformMembership_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ALTER COLUMN "invitedById" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "PlatformMembership_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PlatformPermission" DROP CONSTRAINT "PlatformPermission_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "PlatformPermission_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PlatformRole" DROP CONSTRAINT "PlatformRole_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "PlatformRole_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PlatformRolePermission" DROP CONSTRAINT "PlatformRolePermission_pkey",
ALTER COLUMN "roleId" SET DATA TYPE TEXT,
ALTER COLUMN "permissionId" SET DATA TYPE TEXT,
ADD CONSTRAINT "PlatformRolePermission_pkey" PRIMARY KEY ("roleId", "permissionId");

-- AlterTable
ALTER TABLE "PlatformTitle" DROP CONSTRAINT "PlatformTitle_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "PlatformTitle_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PlatformUserProfile" DROP CONSTRAINT "PlatformUserProfile_pkey",
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ALTER COLUMN "departmentId" SET DATA TYPE TEXT,
ALTER COLUMN "titleId" SET DATA TYPE TEXT,
ALTER COLUMN "managerUserId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "PlatformUserProfile_pkey" PRIMARY KEY ("userId");

-- AlterTable
ALTER TABLE "PlatformUserRole" DROP CONSTRAINT "PlatformUserRole_pkey",
ALTER COLUMN "membershipId" SET DATA TYPE TEXT,
ALTER COLUMN "roleId" SET DATA TYPE TEXT,
ADD CONSTRAINT "PlatformUserRole_pkey" PRIMARY KEY ("membershipId", "roleId");

-- AlterTable
ALTER TABLE "Session" DROP CONSTRAINT "Session_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Session_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "SiteSetting" DROP CONSTRAINT "SiteSetting_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformMembership" ADD CONSTRAINT "PlatformMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformRolePermission" ADD CONSTRAINT "PlatformRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PlatformRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformRolePermission" ADD CONSTRAINT "PlatformRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "PlatformPermission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformUserRole" ADD CONSTRAINT "PlatformUserRole_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "PlatformMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformUserRole" ADD CONSTRAINT "PlatformUserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PlatformRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyRole" ADD CONSTRAINT "CompanyRole_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyRolePermission" ADD CONSTRAINT "CompanyRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "CompanyRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyRolePermission" ADD CONSTRAINT "CompanyRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "CompanyPermission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMemberRole" ADD CONSTRAINT "CompanyMemberRole_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CompanyMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMemberRole" ADD CONSTRAINT "CompanyMemberRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "CompanyRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleInstallation" ADD CONSTRAINT "ModuleInstallation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleInstallation" ADD CONSTRAINT "ModuleInstallation_moduleKey_fkey" FOREIGN KEY ("moduleKey") REFERENCES "Module"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformAuditLog" ADD CONSTRAINT "PlatformAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAuditLog" ADD CONSTRAINT "CompanyAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAuditLog" ADD CONSTRAINT "CompanyAuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformDepartment" ADD CONSTRAINT "PlatformDepartment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PlatformDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformUserProfile" ADD CONSTRAINT "PlatformUserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformUserProfile" ADD CONSTRAINT "PlatformUserProfile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "PlatformDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformUserProfile" ADD CONSTRAINT "PlatformUserProfile_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "PlatformTitle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformUserProfile" ADD CONSTRAINT "PlatformUserProfile_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformInvite" ADD CONSTRAINT "PlatformInvite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformInvite" ADD CONSTRAINT "PlatformInvite_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PlatformRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInvite" ADD CONSTRAINT "CompanyInvite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInvite" ADD CONSTRAINT "CompanyInvite_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "CompanyRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInvite" ADD CONSTRAINT "CompanyInvite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
