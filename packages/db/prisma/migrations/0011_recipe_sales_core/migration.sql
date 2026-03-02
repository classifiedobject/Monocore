CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');

ALTER TABLE "InventoryItem"
  ADD COLUMN "lastPurchaseUnitCost" DECIMAL(14,4);

ALTER TABLE "FinanceEntry"
  ADD COLUMN "relatedDocumentType" TEXT,
  ADD COLUMN "relatedDocumentId" TEXT;

CREATE INDEX "FinanceEntry_companyId_relatedDocumentType_relatedDocumentId_idx"
  ON "FinanceEntry"("companyId", "relatedDocumentType", "relatedDocumentId");

CREATE TABLE "SalesProduct" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "sku" TEXT,
  "salesPrice" DECIMAL(14,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("companyId", "sku")
);

CREATE INDEX "SalesProduct_companyId_isActive_idx" ON "SalesProduct"("companyId", "isActive");

CREATE TABLE "Recipe" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "productId" UUID NOT NULL REFERENCES "SalesProduct"("id") ON DELETE CASCADE,
  "name" TEXT,
  "yieldQuantity" DECIMAL(14,4) NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("companyId", "productId"),
  UNIQUE ("productId")
);

CREATE INDEX "Recipe_companyId_productId_idx" ON "Recipe"("companyId", "productId");

CREATE TABLE "RecipeLine" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "recipeId" UUID NOT NULL REFERENCES "Recipe"("id") ON DELETE CASCADE,
  "itemId" UUID NOT NULL REFERENCES "InventoryItem"("id") ON DELETE RESTRICT,
  "quantity" DECIMAL(14,4) NOT NULL,
  "unit" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "RecipeLine_companyId_recipeId_idx" ON "RecipeLine"("companyId", "recipeId");
CREATE INDEX "RecipeLine_companyId_itemId_idx" ON "RecipeLine"("companyId", "itemId");

CREATE TABLE "SalesOrder" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "orderNo" TEXT,
  "orderDate" TIMESTAMP(3) NOT NULL,
  "profitCenterId" UUID REFERENCES "FinanceProfitCenter"("id") ON DELETE SET NULL,
  "warehouseId" UUID REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL,
  "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'TRY',
  "totalRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalCogs" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "SalesOrder_companyId_status_orderDate_idx" ON "SalesOrder"("companyId", "status", "orderDate");
CREATE INDEX "SalesOrder_companyId_profitCenterId_idx" ON "SalesOrder"("companyId", "profitCenterId");
CREATE INDEX "SalesOrder_companyId_warehouseId_idx" ON "SalesOrder"("companyId", "warehouseId");

CREATE TABLE "SalesOrderLine" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "salesOrderId" UUID NOT NULL REFERENCES "SalesOrder"("id") ON DELETE CASCADE,
  "productId" UUID NOT NULL REFERENCES "SalesProduct"("id") ON DELETE RESTRICT,
  "quantity" DECIMAL(14,4) NOT NULL,
  "unitPrice" DECIMAL(14,2) NOT NULL,
  "lineTotal" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "SalesOrderLine_companyId_salesOrderId_idx" ON "SalesOrderLine"("companyId", "salesOrderId");
CREATE INDEX "SalesOrderLine_companyId_productId_idx" ON "SalesOrderLine"("companyId", "productId");
