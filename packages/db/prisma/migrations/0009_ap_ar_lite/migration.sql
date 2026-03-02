CREATE TYPE "FinanceInvoiceDirection" AS ENUM ('PAYABLE', 'RECEIVABLE');
CREATE TYPE "FinanceInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID');
CREATE TYPE "FinancePaymentDirection" AS ENUM ('OUTGOING', 'INCOMING');

CREATE TABLE "FinanceInvoice" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "direction" "FinanceInvoiceDirection" NOT NULL,
  "counterpartyId" UUID NOT NULL REFERENCES "FinanceCounterparty"("id") ON DELETE RESTRICT,
  "invoiceNo" TEXT NOT NULL,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'TRY',
  "status" "FinanceInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "subtotal" DECIMAL(14,2) NOT NULL,
  "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(14,2) NOT NULL,
  "notes" TEXT,
  "createdByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("companyId", "invoiceNo")
);

CREATE TABLE "FinanceInvoiceLine" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoiceId" UUID NOT NULL REFERENCES "FinanceInvoice"("id") ON DELETE CASCADE,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(14,4) NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(14,2) NOT NULL,
  "taxRate" DECIMAL(6,4),
  "lineTotal" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "FinancePayment" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "direction" "FinancePaymentDirection" NOT NULL,
  "counterpartyId" UUID NOT NULL REFERENCES "FinanceCounterparty"("id") ON DELETE RESTRICT,
  "accountId" UUID REFERENCES "FinanceAccount"("id") ON DELETE SET NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'TRY',
  "reference" TEXT,
  "notes" TEXT,
  "createdByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "FinancePaymentAllocation" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "paymentId" UUID NOT NULL REFERENCES "FinancePayment"("id") ON DELETE CASCADE,
  "invoiceId" UUID NOT NULL REFERENCES "FinanceInvoice"("id") ON DELETE CASCADE,
  "amount" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "FinanceEntry"
  ADD COLUMN "invoiceId" UUID,
  ADD COLUMN "paymentId" UUID;

ALTER TABLE "FinanceEntry"
  ADD CONSTRAINT "FinanceEntry_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "FinanceInvoice"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "FinanceEntry_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "FinancePayment"("id") ON DELETE SET NULL;

CREATE INDEX "FinanceInvoice_companyId_direction_dueDate_idx" ON "FinanceInvoice"("companyId", "direction", "dueDate");
CREATE INDEX "FinanceInvoice_companyId_counterpartyId_idx" ON "FinanceInvoice"("companyId", "counterpartyId");
CREATE INDEX "FinanceInvoiceLine_invoiceId_idx" ON "FinanceInvoiceLine"("invoiceId");
CREATE INDEX "FinancePayment_companyId_paymentDate_idx" ON "FinancePayment"("companyId", "paymentDate");
CREATE INDEX "FinancePayment_companyId_counterpartyId_idx" ON "FinancePayment"("companyId", "counterpartyId");
CREATE INDEX "FinancePaymentAllocation_companyId_paymentId_idx" ON "FinancePaymentAllocation"("companyId", "paymentId");
CREATE INDEX "FinancePaymentAllocation_companyId_invoiceId_idx" ON "FinancePaymentAllocation"("companyId", "invoiceId");
CREATE INDEX "FinanceEntry_companyId_invoiceId_idx" ON "FinanceEntry"("companyId", "invoiceId");
CREATE INDEX "FinanceEntry_companyId_paymentId_idx" ON "FinanceEntry"("companyId", "paymentId");
