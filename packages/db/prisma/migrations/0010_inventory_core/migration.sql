CREATE TYPE "InventoryMovementType" AS ENUM ('IN', 'OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT');

CREATE TABLE "InventoryWarehouse" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "location" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("companyId", "name")
);

CREATE TABLE "InventoryItem" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "sku" TEXT,
  "unit" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("companyId", "sku")
);

CREATE TABLE "InventoryStockMovement" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "itemId" UUID NOT NULL REFERENCES "InventoryItem"("id") ON DELETE RESTRICT,
  "warehouseId" UUID NOT NULL REFERENCES "InventoryWarehouse"("id") ON DELETE RESTRICT,
  "type" "InventoryMovementType" NOT NULL,
  "quantity" DECIMAL(14,4) NOT NULL,
  "reference" TEXT,
  "relatedDocumentType" TEXT,
  "relatedDocumentId" TEXT,
  "createdByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "InventoryWarehouse_companyId_isActive_idx" ON "InventoryWarehouse"("companyId", "isActive");
CREATE INDEX "InventoryItem_companyId_isActive_idx" ON "InventoryItem"("companyId", "isActive");
CREATE INDEX "InventoryItem_companyId_name_idx" ON "InventoryItem"("companyId", "name");
CREATE INDEX "InventoryStockMovement_companyId_itemId_idx" ON "InventoryStockMovement"("companyId", "itemId");
CREATE INDEX "InventoryStockMovement_companyId_warehouseId_idx" ON "InventoryStockMovement"("companyId", "warehouseId");
CREATE INDEX "InventoryStockMovement_companyId_itemId_warehouseId_idx" ON "InventoryStockMovement"("companyId", "itemId", "warehouseId");
CREATE INDEX "InventoryStockMovement_companyId_createdAt_idx" ON "InventoryStockMovement"("companyId", "createdAt");
