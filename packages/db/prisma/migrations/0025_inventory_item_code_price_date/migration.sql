ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "code" TEXT,
  ADD COLUMN IF NOT EXISTS "priceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

WITH ranked AS (
  SELECT id,
         'ITM-' || LPAD(ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "createdAt", id)::TEXT, 6, '0') AS generated_code
  FROM "InventoryItem"
)
UPDATE "InventoryItem" i
SET "code" = ranked.generated_code
FROM ranked
WHERE i.id = ranked.id
  AND (i."code" IS NULL OR i."code" = '');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'InventoryItem_companyId_code_key'
  ) THEN
    CREATE UNIQUE INDEX "InventoryItem_companyId_code_key" ON "InventoryItem"("companyId", "code");
  END IF;
END $$;
