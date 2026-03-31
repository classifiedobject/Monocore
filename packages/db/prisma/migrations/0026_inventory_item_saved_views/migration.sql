CREATE TABLE "InventoryItemSavedView" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "filtersJson" JSONB NOT NULL,
    "searchQuery" TEXT,
    "sortBy" TEXT,
    "sortDirection" TEXT,
    "pageSize" INTEGER,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItemSavedView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryItemSavedView_companyId_isDefault_idx" ON "InventoryItemSavedView"("companyId", "isDefault");
CREATE INDEX "InventoryItemSavedView_companyId_name_idx" ON "InventoryItemSavedView"("companyId", "name");

ALTER TABLE "InventoryItemSavedView"
ADD CONSTRAINT "InventoryItemSavedView_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryItemSavedView"
ADD CONSTRAINT "InventoryItemSavedView_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
