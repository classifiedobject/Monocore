CREATE TABLE "InventorySupplier" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "shortName" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "address" TEXT,
  "taxOffice" TEXT,
  "taxNumber" TEXT,
  "contactName" TEXT,
  "contactPhone" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 1000,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventorySupplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryBrand" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "shortName" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 1000,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryBrand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryBrandSupplier" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "brandId" UUID NOT NULL,
  "supplierId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryBrandSupplier_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventorySupplier_companyId_shortName_idx" ON "InventorySupplier"("companyId", "shortName");
CREATE INDEX "InventorySupplier_companyId_isActive_idx" ON "InventorySupplier"("companyId", "isActive");
CREATE INDEX "InventoryBrand_companyId_name_idx" ON "InventoryBrand"("companyId", "name");
CREATE INDEX "InventoryBrandSupplier_companyId_brandId_idx" ON "InventoryBrandSupplier"("companyId", "brandId");
CREATE INDEX "InventoryBrandSupplier_companyId_supplierId_idx" ON "InventoryBrandSupplier"("companyId", "supplierId");
CREATE UNIQUE INDEX "InventoryBrandSupplier_companyId_brandId_supplierId_key" ON "InventoryBrandSupplier"("companyId", "brandId", "supplierId");

ALTER TABLE "InventorySupplier"
ADD CONSTRAINT "InventorySupplier_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryBrand"
ADD CONSTRAINT "InventoryBrand_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryBrandSupplier"
ADD CONSTRAINT "InventoryBrandSupplier_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryBrandSupplier"
ADD CONSTRAINT "InventoryBrandSupplier_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "InventoryBrand"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryBrandSupplier"
ADD CONSTRAINT "InventoryBrandSupplier_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "InventorySupplier"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
