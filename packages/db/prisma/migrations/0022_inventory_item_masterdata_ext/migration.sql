CREATE TYPE "InventoryMainStockArea" AS ENUM ('BAR', 'KITCHEN', 'OTHER');
CREATE TYPE "InventoryAttributeCategory" AS ENUM ('ALCOHOL', 'SOFT', 'KITCHEN', 'OTHER');
CREATE TYPE "InventoryBaseUom" AS ENUM ('CL', 'ML', 'GRAM', 'KG', 'PIECE');
CREATE TYPE "InventoryPackageUom" AS ENUM ('BOTTLE', 'PACK', 'PIECE');

ALTER TABLE "InventoryItem"
  ADD COLUMN "brandId" UUID,
  ADD COLUMN "supplierId" UUID,
  ADD COLUMN "mainStockArea" "InventoryMainStockArea" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "attributeCategory" "InventoryAttributeCategory" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "subCategory" TEXT,
  ADD COLUMN "baseUom" "InventoryBaseUom" NOT NULL DEFAULT 'PIECE',
  ADD COLUMN "packageUom" "InventoryPackageUom",
  ADD COLUMN "packageSizeBase" DECIMAL(14,4),
  ADD COLUMN "purchaseVatRate" DECIMAL(6,4) NOT NULL DEFAULT 0.2,
  ADD COLUMN "listPriceExVat" DECIMAL(14,4),
  ADD COLUMN "discountRate" DECIMAL(6,4) NOT NULL DEFAULT 0,
  ADD COLUMN "computedPriceIncVat" DECIMAL(14,4),
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 1000;

CREATE INDEX "InventoryItem_companyId_brandId_idx" ON "InventoryItem"("companyId", "brandId");
CREATE INDEX "InventoryItem_companyId_supplierId_idx" ON "InventoryItem"("companyId", "supplierId");

ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "InventoryBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "InventorySupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "InventoryItem"
SET "baseUom" = CASE
  WHEN lower("unit") = 'cl' THEN 'CL'::"InventoryBaseUom"
  WHEN lower("unit") = 'ml' THEN 'ML'::"InventoryBaseUom"
  WHEN lower("unit") = 'gram' THEN 'GRAM'::"InventoryBaseUom"
  WHEN lower("unit") = 'kg' THEN 'KG'::"InventoryBaseUom"
  ELSE 'PIECE'::"InventoryBaseUom"
END;
