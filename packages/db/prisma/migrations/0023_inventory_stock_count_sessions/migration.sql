CREATE TYPE "InventoryStockCountSessionStatus" AS ENUM ('DRAFT', 'POSTED');

CREATE TABLE "InventoryStockCountSession" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "countDate" TIMESTAMP(3) NOT NULL,
  "status" "InventoryStockCountSessionStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryStockCountSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryStockCountLine" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "itemId" UUID NOT NULL,
  "countedQtyBase" DECIMAL(14,4) NOT NULL,
  "closedPackageQty" INTEGER,
  "openPackageCount" INTEGER,
  "openQtyBase" DECIMAL(14,4),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryStockCountLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryStockCountSession_companyId_warehouseId_countDate_key"
  ON "InventoryStockCountSession"("companyId", "warehouseId", "countDate");
CREATE INDEX "InventoryStockCountSession_companyId_status_countDate_idx"
  ON "InventoryStockCountSession"("companyId", "status", "countDate");

CREATE UNIQUE INDEX "InventoryStockCountLine_companyId_sessionId_itemId_key"
  ON "InventoryStockCountLine"("companyId", "sessionId", "itemId");
CREATE INDEX "InventoryStockCountLine_companyId_sessionId_idx"
  ON "InventoryStockCountLine"("companyId", "sessionId");
CREATE INDEX "InventoryStockCountLine_companyId_itemId_idx"
  ON "InventoryStockCountLine"("companyId", "itemId");

ALTER TABLE "InventoryStockCountSession"
  ADD CONSTRAINT "InventoryStockCountSession_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryStockCountSession"
  ADD CONSTRAINT "InventoryStockCountSession_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryStockCountSession"
  ADD CONSTRAINT "InventoryStockCountSession_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryStockCountLine"
  ADD CONSTRAINT "InventoryStockCountLine_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryStockCountLine"
  ADD CONSTRAINT "InventoryStockCountLine_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "InventoryStockCountSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryStockCountLine"
  ADD CONSTRAINT "InventoryStockCountLine_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

