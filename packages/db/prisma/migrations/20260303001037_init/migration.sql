/*
  Warnings:

  - The primary key for the `Company` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `CompanyAuditLog` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `CompanyEntitlement` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `CompanyInvite` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `CompanyMemberRole` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `CompanyMembership` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `CompanyPermission` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `CompanyRole` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `CompanyRolePermission` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `FinanceAccount` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `FinanceAllocationBatch` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `FinanceAllocationRule` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `FinanceAllocationTarget` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `FinanceBudget` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `FinanceBudgetLine` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `FinanceCashflowForecastItem` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `FinanceCategory` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `FinanceCounterparty` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `FinanceEntry` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `FinanceInvoice` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `FinanceInvoiceLine` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `FinancePayment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `FinancePaymentAllocation` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `FinanceProfitCenter` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `FinanceRecurringRule` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `InventoryItem` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `InventoryStockMovement` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `InventoryWarehouse` table will be changed. If it partially fails, the table could be left without primary key constraint.
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
  - The primary key for the `Recipe` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `RecipeLine` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `SalesOrder` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `SalesOrderLine` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `SalesProduct` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Session` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `SiteSetting` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `TaskBoard` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `TaskComment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `TaskInstance` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `TaskTemplate` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "CompanyAuditLog" DROP CONSTRAINT "CompanyAuditLog_actorUserId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyAuditLog" DROP CONSTRAINT "CompanyAuditLog_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyEntitlement" DROP CONSTRAINT "CompanyEntitlement_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyEntitlement" DROP CONSTRAINT "CompanyEntitlement_moduleKey_fkey";

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
ALTER TABLE "FinanceAccount" DROP CONSTRAINT "FinanceAccount_companyId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceAllocationBatch" DROP CONSTRAINT "FinanceAllocationBatch_allocationRuleId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceAllocationBatch" DROP CONSTRAINT "FinanceAllocationBatch_companyId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceAllocationBatch" DROP CONSTRAINT "FinanceAllocationBatch_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceAllocationBatch" DROP CONSTRAINT "FinanceAllocationBatch_sourceEntryId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceAllocationRule" DROP CONSTRAINT "FinanceAllocationRule_companyId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceAllocationRule" DROP CONSTRAINT "FinanceAllocationRule_sourceCategoryId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceAllocationRule" DROP CONSTRAINT "FinanceAllocationRule_sourceEntryId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceAllocationTarget" DROP CONSTRAINT "FinanceAllocationTarget_allocationRuleId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceAllocationTarget" DROP CONSTRAINT "FinanceAllocationTarget_profitCenterId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceBudget" DROP CONSTRAINT "FinanceBudget_companyId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceBudget" DROP CONSTRAINT "FinanceBudget_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceBudgetLine" DROP CONSTRAINT "FinanceBudgetLine_budgetId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceBudgetLine" DROP CONSTRAINT "FinanceBudgetLine_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceBudgetLine" DROP CONSTRAINT "FinanceBudgetLine_companyId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceBudgetLine" DROP CONSTRAINT "FinanceBudgetLine_profitCenterId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceCashflowForecastItem" DROP CONSTRAINT "FinanceCashflowForecastItem_companyId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceCashflowForecastItem" DROP CONSTRAINT "FinanceCashflowForecastItem_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceCashflowForecastItem" DROP CONSTRAINT "FinanceCashflowForecastItem_profitCenterId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceCategory" DROP CONSTRAINT "FinanceCategory_companyId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceCounterparty" DROP CONSTRAINT "FinanceCounterparty_companyId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_accountId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_allocationBatchId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_companyId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_counterpartyId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_profitCenterId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_recurringRuleId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceInvoice" DROP CONSTRAINT "FinanceInvoice_companyId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceInvoice" DROP CONSTRAINT "FinanceInvoice_counterpartyId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceInvoice" DROP CONSTRAINT "FinanceInvoice_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceInvoiceLine" DROP CONSTRAINT "FinanceInvoiceLine_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "FinancePayment" DROP CONSTRAINT "FinancePayment_accountId_fkey";

-- DropForeignKey
ALTER TABLE "FinancePayment" DROP CONSTRAINT "FinancePayment_companyId_fkey";

-- DropForeignKey
ALTER TABLE "FinancePayment" DROP CONSTRAINT "FinancePayment_counterpartyId_fkey";

-- DropForeignKey
ALTER TABLE "FinancePayment" DROP CONSTRAINT "FinancePayment_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "FinancePaymentAllocation" DROP CONSTRAINT "FinancePaymentAllocation_companyId_fkey";

-- DropForeignKey
ALTER TABLE "FinancePaymentAllocation" DROP CONSTRAINT "FinancePaymentAllocation_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "FinancePaymentAllocation" DROP CONSTRAINT "FinancePaymentAllocation_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceProfitCenter" DROP CONSTRAINT "FinanceProfitCenter_companyId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceProfitCenter" DROP CONSTRAINT "FinanceProfitCenter_parentId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceRecurringRule" DROP CONSTRAINT "FinanceRecurringRule_accountId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceRecurringRule" DROP CONSTRAINT "FinanceRecurringRule_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceRecurringRule" DROP CONSTRAINT "FinanceRecurringRule_companyId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceRecurringRule" DROP CONSTRAINT "FinanceRecurringRule_counterpartyId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceRecurringRule" DROP CONSTRAINT "FinanceRecurringRule_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryItem" DROP CONSTRAINT "InventoryItem_companyId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryStockMovement" DROP CONSTRAINT "InventoryStockMovement_companyId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryStockMovement" DROP CONSTRAINT "InventoryStockMovement_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryStockMovement" DROP CONSTRAINT "InventoryStockMovement_itemId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryStockMovement" DROP CONSTRAINT "InventoryStockMovement_warehouseId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryWarehouse" DROP CONSTRAINT "InventoryWarehouse_companyId_fkey";

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
ALTER TABLE "Recipe" DROP CONSTRAINT "Recipe_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Recipe" DROP CONSTRAINT "Recipe_productId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeLine" DROP CONSTRAINT "RecipeLine_companyId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeLine" DROP CONSTRAINT "RecipeLine_itemId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeLine" DROP CONSTRAINT "RecipeLine_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "SalesOrder" DROP CONSTRAINT "SalesOrder_companyId_fkey";

-- DropForeignKey
ALTER TABLE "SalesOrder" DROP CONSTRAINT "SalesOrder_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "SalesOrder" DROP CONSTRAINT "SalesOrder_profitCenterId_fkey";

-- DropForeignKey
ALTER TABLE "SalesOrder" DROP CONSTRAINT "SalesOrder_warehouseId_fkey";

-- DropForeignKey
ALTER TABLE "SalesOrderLine" DROP CONSTRAINT "SalesOrderLine_companyId_fkey";

-- DropForeignKey
ALTER TABLE "SalesOrderLine" DROP CONSTRAINT "SalesOrderLine_productId_fkey";

-- DropForeignKey
ALTER TABLE "SalesOrderLine" DROP CONSTRAINT "SalesOrderLine_salesOrderId_fkey";

-- DropForeignKey
ALTER TABLE "SalesProduct" DROP CONSTRAINT "SalesProduct_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "TaskBoard" DROP CONSTRAINT "TaskBoard_companyId_fkey";

-- DropForeignKey
ALTER TABLE "TaskComment" DROP CONSTRAINT "TaskComment_authorUserId_fkey";

-- DropForeignKey
ALTER TABLE "TaskComment" DROP CONSTRAINT "TaskComment_companyId_fkey";

-- DropForeignKey
ALTER TABLE "TaskComment" DROP CONSTRAINT "TaskComment_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TaskInstance" DROP CONSTRAINT "TaskInstance_assigneeRoleId_fkey";

-- DropForeignKey
ALTER TABLE "TaskInstance" DROP CONSTRAINT "TaskInstance_assigneeUserId_fkey";

-- DropForeignKey
ALTER TABLE "TaskInstance" DROP CONSTRAINT "TaskInstance_boardId_fkey";

-- DropForeignKey
ALTER TABLE "TaskInstance" DROP CONSTRAINT "TaskInstance_companyId_fkey";

-- DropForeignKey
ALTER TABLE "TaskInstance" DROP CONSTRAINT "TaskInstance_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "TaskInstance" DROP CONSTRAINT "TaskInstance_templateId_fkey";

-- DropForeignKey
ALTER TABLE "TaskTemplate" DROP CONSTRAINT "TaskTemplate_boardId_fkey";

-- DropForeignKey
ALTER TABLE "TaskTemplate" DROP CONSTRAINT "TaskTemplate_companyId_fkey";

-- DropForeignKey
ALTER TABLE "TaskTemplate" DROP CONSTRAINT "TaskTemplate_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "TaskTemplate" DROP CONSTRAINT "TaskTemplate_defaultAssigneeRoleId_fkey";

-- DropForeignKey
ALTER TABLE "TaskTemplate" DROP CONSTRAINT "TaskTemplate_defaultAssigneeUserId_fkey";

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
ALTER TABLE "CompanyEntitlement" DROP CONSTRAINT "CompanyEntitlement_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "CompanyEntitlement_pkey" PRIMARY KEY ("id");

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
ALTER TABLE "FinanceAccount" DROP CONSTRAINT "FinanceAccount_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "FinanceAccount_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "FinanceAllocationBatch" DROP CONSTRAINT "FinanceAllocationBatch_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "allocationRuleId" SET DATA TYPE TEXT,
ALTER COLUMN "sourceEntryId" SET DATA TYPE TEXT,
ALTER COLUMN "createdByUserId" SET DATA TYPE TEXT,
ADD CONSTRAINT "FinanceAllocationBatch_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "FinanceAllocationRule" DROP CONSTRAINT "FinanceAllocationRule_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "sourceCategoryId" SET DATA TYPE TEXT,
ALTER COLUMN "sourceEntryId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "FinanceAllocationRule_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "FinanceAllocationTarget" DROP CONSTRAINT "FinanceAllocationTarget_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "allocationRuleId" SET DATA TYPE TEXT,
ALTER COLUMN "profitCenterId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "FinanceAllocationTarget_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "FinanceBudget" DROP CONSTRAINT "FinanceBudget_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "createdByUserId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "FinanceBudget_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "FinanceBudgetLine" DROP CONSTRAINT "FinanceBudgetLine_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "budgetId" SET DATA TYPE TEXT,
ALTER COLUMN "categoryId" SET DATA TYPE TEXT,
ALTER COLUMN "profitCenterId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "FinanceBudgetLine_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "FinanceCashflowForecastItem" DROP CONSTRAINT "FinanceCashflowForecastItem_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "profitCenterId" SET DATA TYPE TEXT,
ALTER COLUMN "createdByUserId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "FinanceCashflowForecastItem_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "FinanceCategory" DROP CONSTRAINT "FinanceCategory_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "FinanceCategory_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "FinanceCounterparty" DROP CONSTRAINT "FinanceCounterparty_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "FinanceCounterparty_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "categoryId" SET DATA TYPE TEXT,
ALTER COLUMN "createdByUserId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "counterpartyId" SET DATA TYPE TEXT,
ALTER COLUMN "accountId" SET DATA TYPE TEXT,
ALTER COLUMN "recurringRuleId" SET DATA TYPE TEXT,
ALTER COLUMN "profitCenterId" SET DATA TYPE TEXT,
ALTER COLUMN "allocationBatchId" SET DATA TYPE TEXT,
ALTER COLUMN "invoiceId" SET DATA TYPE TEXT,
ALTER COLUMN "paymentId" SET DATA TYPE TEXT,
ADD CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "FinanceInvoice" DROP CONSTRAINT "FinanceInvoice_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "counterpartyId" SET DATA TYPE TEXT,
ALTER COLUMN "createdByUserId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "FinanceInvoice_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "FinanceInvoiceLine" DROP CONSTRAINT "FinanceInvoiceLine_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "invoiceId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "FinanceInvoiceLine_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "FinancePayment" DROP CONSTRAINT "FinancePayment_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "counterpartyId" SET DATA TYPE TEXT,
ALTER COLUMN "accountId" SET DATA TYPE TEXT,
ALTER COLUMN "createdByUserId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "FinancePayment_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "FinancePaymentAllocation" DROP CONSTRAINT "FinancePaymentAllocation_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "paymentId" SET DATA TYPE TEXT,
ALTER COLUMN "invoiceId" SET DATA TYPE TEXT,
ADD CONSTRAINT "FinancePaymentAllocation_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "FinanceProfitCenter" DROP CONSTRAINT "FinanceProfitCenter_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "parentId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "FinanceProfitCenter_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "FinanceRecurringRule" DROP CONSTRAINT "FinanceRecurringRule_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "categoryId" SET DATA TYPE TEXT,
ALTER COLUMN "counterpartyId" SET DATA TYPE TEXT,
ALTER COLUMN "accountId" SET DATA TYPE TEXT,
ALTER COLUMN "createdByUserId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "FinanceRecurringRule_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "InventoryItem" DROP CONSTRAINT "InventoryItem_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "InventoryStockMovement" DROP CONSTRAINT "InventoryStockMovement_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "itemId" SET DATA TYPE TEXT,
ALTER COLUMN "warehouseId" SET DATA TYPE TEXT,
ALTER COLUMN "createdByUserId" SET DATA TYPE TEXT,
ADD CONSTRAINT "InventoryStockMovement_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "InventoryWarehouse" DROP CONSTRAINT "InventoryWarehouse_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "InventoryWarehouse_pkey" PRIMARY KEY ("id");

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
ALTER TABLE "Recipe" DROP CONSTRAINT "Recipe_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "productId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "RecipeLine" DROP CONSTRAINT "RecipeLine_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "recipeId" SET DATA TYPE TEXT,
ALTER COLUMN "itemId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "RecipeLine_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "SalesOrder" DROP CONSTRAINT "SalesOrder_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "profitCenterId" SET DATA TYPE TEXT,
ALTER COLUMN "warehouseId" SET DATA TYPE TEXT,
ALTER COLUMN "createdByUserId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "SalesOrderLine" DROP CONSTRAINT "SalesOrderLine_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "salesOrderId" SET DATA TYPE TEXT,
ALTER COLUMN "productId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "SalesProduct" DROP CONSTRAINT "SalesProduct_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "SalesProduct_pkey" PRIMARY KEY ("id");

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
ALTER TABLE "TaskBoard" DROP CONSTRAINT "TaskBoard_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "TaskBoard_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "TaskComment" DROP CONSTRAINT "TaskComment_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "taskId" SET DATA TYPE TEXT,
ALTER COLUMN "authorUserId" SET DATA TYPE TEXT,
ADD CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "TaskInstance" DROP CONSTRAINT "TaskInstance_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "templateId" SET DATA TYPE TEXT,
ALTER COLUMN "boardId" SET DATA TYPE TEXT,
ALTER COLUMN "assigneeUserId" SET DATA TYPE TEXT,
ALTER COLUMN "assigneeRoleId" SET DATA TYPE TEXT,
ALTER COLUMN "createdByUserId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "TaskInstance_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "TaskTemplate" DROP CONSTRAINT "TaskTemplate_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "companyId" SET DATA TYPE TEXT,
ALTER COLUMN "boardId" SET DATA TYPE TEXT,
ALTER COLUMN "defaultAssigneeUserId" SET DATA TYPE TEXT,
ALTER COLUMN "defaultAssigneeRoleId" SET DATA TYPE TEXT,
ALTER COLUMN "createdByUserId" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id");

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
ALTER TABLE "CompanyEntitlement" ADD CONSTRAINT "CompanyEntitlement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyEntitlement" ADD CONSTRAINT "CompanyEntitlement_moduleKey_fkey" FOREIGN KEY ("moduleKey") REFERENCES "Module"("key") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "FinanceCategory" ADD CONSTRAINT "FinanceCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "FinanceCounterparty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_profitCenterId_fkey" FOREIGN KEY ("profitCenterId") REFERENCES "FinanceProfitCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_recurringRuleId_fkey" FOREIGN KEY ("recurringRuleId") REFERENCES "FinanceRecurringRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_allocationBatchId_fkey" FOREIGN KEY ("allocationBatchId") REFERENCES "FinanceAllocationBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FinanceInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "FinancePayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCounterparty" ADD CONSTRAINT "FinanceCounterparty_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAccount" ADD CONSTRAINT "FinanceAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRecurringRule" ADD CONSTRAINT "FinanceRecurringRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRecurringRule" ADD CONSTRAINT "FinanceRecurringRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRecurringRule" ADD CONSTRAINT "FinanceRecurringRule_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "FinanceCounterparty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRecurringRule" ADD CONSTRAINT "FinanceRecurringRule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRecurringRule" ADD CONSTRAINT "FinanceRecurringRule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceProfitCenter" ADD CONSTRAINT "FinanceProfitCenter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceProfitCenter" ADD CONSTRAINT "FinanceProfitCenter_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FinanceProfitCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAllocationRule" ADD CONSTRAINT "FinanceAllocationRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAllocationRule" ADD CONSTRAINT "FinanceAllocationRule_sourceCategoryId_fkey" FOREIGN KEY ("sourceCategoryId") REFERENCES "FinanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAllocationRule" ADD CONSTRAINT "FinanceAllocationRule_sourceEntryId_fkey" FOREIGN KEY ("sourceEntryId") REFERENCES "FinanceEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAllocationTarget" ADD CONSTRAINT "FinanceAllocationTarget_allocationRuleId_fkey" FOREIGN KEY ("allocationRuleId") REFERENCES "FinanceAllocationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAllocationTarget" ADD CONSTRAINT "FinanceAllocationTarget_profitCenterId_fkey" FOREIGN KEY ("profitCenterId") REFERENCES "FinanceProfitCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAllocationBatch" ADD CONSTRAINT "FinanceAllocationBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAllocationBatch" ADD CONSTRAINT "FinanceAllocationBatch_allocationRuleId_fkey" FOREIGN KEY ("allocationRuleId") REFERENCES "FinanceAllocationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAllocationBatch" ADD CONSTRAINT "FinanceAllocationBatch_sourceEntryId_fkey" FOREIGN KEY ("sourceEntryId") REFERENCES "FinanceEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAllocationBatch" ADD CONSTRAINT "FinanceAllocationBatch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceInvoice" ADD CONSTRAINT "FinanceInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceInvoice" ADD CONSTRAINT "FinanceInvoice_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "FinanceCounterparty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceInvoice" ADD CONSTRAINT "FinanceInvoice_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceInvoiceLine" ADD CONSTRAINT "FinanceInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FinanceInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayment" ADD CONSTRAINT "FinancePayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayment" ADD CONSTRAINT "FinancePayment_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "FinanceCounterparty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayment" ADD CONSTRAINT "FinancePayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayment" ADD CONSTRAINT "FinancePayment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePaymentAllocation" ADD CONSTRAINT "FinancePaymentAllocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePaymentAllocation" ADD CONSTRAINT "FinancePaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "FinancePayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePaymentAllocation" ADD CONSTRAINT "FinancePaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FinanceInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBudget" ADD CONSTRAINT "FinanceBudget_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBudget" ADD CONSTRAINT "FinanceBudget_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBudgetLine" ADD CONSTRAINT "FinanceBudgetLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBudgetLine" ADD CONSTRAINT "FinanceBudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "FinanceBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBudgetLine" ADD CONSTRAINT "FinanceBudgetLine_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBudgetLine" ADD CONSTRAINT "FinanceBudgetLine_profitCenterId_fkey" FOREIGN KEY ("profitCenterId") REFERENCES "FinanceProfitCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCashflowForecastItem" ADD CONSTRAINT "FinanceCashflowForecastItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCashflowForecastItem" ADD CONSTRAINT "FinanceCashflowForecastItem_profitCenterId_fkey" FOREIGN KEY ("profitCenterId") REFERENCES "FinanceProfitCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCashflowForecastItem" ADD CONSTRAINT "FinanceCashflowForecastItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBoard" ADD CONSTRAINT "TaskBoard_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "TaskBoard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_defaultAssigneeUserId_fkey" FOREIGN KEY ("defaultAssigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_defaultAssigneeRoleId_fkey" FOREIGN KEY ("defaultAssigneeRoleId") REFERENCES "CompanyRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskInstance" ADD CONSTRAINT "TaskInstance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskInstance" ADD CONSTRAINT "TaskInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TaskTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskInstance" ADD CONSTRAINT "TaskInstance_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "TaskBoard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskInstance" ADD CONSTRAINT "TaskInstance_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskInstance" ADD CONSTRAINT "TaskInstance_assigneeRoleId_fkey" FOREIGN KEY ("assigneeRoleId") REFERENCES "CompanyRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskInstance" ADD CONSTRAINT "TaskInstance_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TaskInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryWarehouse" ADD CONSTRAINT "InventoryWarehouse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStockMovement" ADD CONSTRAINT "InventoryStockMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStockMovement" ADD CONSTRAINT "InventoryStockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStockMovement" ADD CONSTRAINT "InventoryStockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStockMovement" ADD CONSTRAINT "InventoryStockMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesProduct" ADD CONSTRAINT "SalesProduct_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "SalesProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_profitCenterId_fkey" FOREIGN KEY ("profitCenterId") REFERENCES "FinanceProfitCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "SalesProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "FinanceEntry_companyId_relatedDocumentType_relatedDocumentId_id" RENAME TO "FinanceEntry_companyId_relatedDocumentType_relatedDocumentI_idx";
