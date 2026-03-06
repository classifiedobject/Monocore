ALTER TABLE "InventorySupplier"
  ADD COLUMN IF NOT EXISTS "addressLine" TEXT,
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "district" TEXT;

UPDATE "InventorySupplier"
SET "addressLine" = "address"
WHERE "addressLine" IS NULL
  AND "address" IS NOT NULL;
