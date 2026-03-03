CREATE TYPE "ReservationStatus" AS ENUM ('BOOKED', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELED', 'NO_SHOW');

CREATE TABLE "Customer" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "birthDate" TIMESTAMP(3),
  "notes" TEXT,
  "visitCount" INTEGER NOT NULL DEFAULT 0,
  "totalSpend" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "lastVisitAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "Customer_companyId_phone_idx" ON "Customer"("companyId", "phone");
CREATE INDEX "Customer_companyId_email_idx" ON "Customer"("companyId", "email");
CREATE INDEX "Customer_companyId_lastVisitAt_idx" ON "Customer"("companyId", "lastVisitAt");

CREATE TABLE "CustomerTag" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "CustomerTag_companyId_name_key" ON "CustomerTag"("companyId", "name");
CREATE INDEX "CustomerTag_companyId_createdAt_idx" ON "CustomerTag"("companyId", "createdAt");

CREATE TABLE "CustomerTagLink" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "customerId" UUID NOT NULL REFERENCES "Customer"("id") ON DELETE CASCADE,
  "tagId" UUID NOT NULL REFERENCES "CustomerTag"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "CustomerTagLink_customerId_tagId_key" ON "CustomerTagLink"("customerId", "tagId");
CREATE INDEX "CustomerTagLink_companyId_customerId_idx" ON "CustomerTagLink"("companyId", "customerId");
CREATE INDEX "CustomerTagLink_companyId_tagId_idx" ON "CustomerTagLink"("companyId", "tagId");

CREATE TABLE "Reservation" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "customerId" UUID REFERENCES "Customer"("id") ON DELETE SET NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "reservationDate" TIMESTAMP(3) NOT NULL,
  "reservationTime" TIMESTAMP(3) NOT NULL,
  "guestCount" INTEGER NOT NULL,
  "status" "ReservationStatus" NOT NULL DEFAULT 'BOOKED',
  "tableRef" TEXT,
  "notes" TEXT,
  "createdByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "Reservation_companyId_reservationDate_idx" ON "Reservation"("companyId", "reservationDate");
CREATE INDEX "Reservation_companyId_status_idx" ON "Reservation"("companyId", "status");
CREATE INDEX "Reservation_companyId_customerId_idx" ON "Reservation"("companyId", "customerId");

ALTER TABLE "SalesOrder"
ADD COLUMN "reservationId" UUID REFERENCES "Reservation"("id") ON DELETE SET NULL;

CREATE INDEX "SalesOrder_companyId_reservationId_idx" ON "SalesOrder"("companyId", "reservationId");
