-- Phase 8 (quotes, invoices, eTIMS) production schema change. Additive only: new nullable/defaulted columns, 1 new table.
-- Run once against production BEFORE deploying the Phase 8 code.
BEGIN;

-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "acceptedName" TEXT,
ADD COLUMN     "items" JSONB,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "shareToken" TEXT,
ADD COLUMN     "subtotal" DOUBLE PRECISION,
ADD COLUMN     "terms" TEXT,
ADD COLUMN     "validUntil" TIMESTAMP(3),
ADD COLUMN     "vatTotal" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "businessAddress" TEXT,
ADD COLUMN     "etimsBranchId" TEXT DEFAULT '00',
ADD COLUMN     "etimsCmcKey" TEXT,
ADD COLUMN     "etimsDeviceSerial" TEXT,
ADD COLUMN     "etimsEnv" TEXT,
ADD COLUMN     "etimsItems" JSONB,
ADD COLUMN     "invoiceCounter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "invoiceFooter" TEXT,
ADD COLUMN     "kraPin" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "quoteCounter" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "salesInvoiceId" TEXT;

-- CreateTable
CREATE TABLE "SalesInvoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "proposalId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'INVOICE',
    "originalId" TEXT,
    "number" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "items" JSONB NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "vatTotal" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "shareToken" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "etimsStatus" TEXT NOT NULL DEFAULT 'NOT_SENT',
    "etimsReceiptNo" TEXT,
    "etimsSignature" TEXT,
    "etimsInternalData" TEXT,
    "etimsSdcId" TEXT,
    "etimsMrcNo" TEXT,
    "etimsDateTime" TEXT,
    "etimsError" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoice_proposalId_key" ON "SalesInvoice"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoice_shareToken_key" ON "SalesInvoice"("shareToken");

-- CreateIndex
CREATE INDEX "SalesInvoice_organizationId_status_dueDate_idx" ON "SalesInvoice"("organizationId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "SalesInvoice_leadId_idx" ON "SalesInvoice"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoice_organizationId_number_key" ON "SalesInvoice"("organizationId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_shareToken_key" ON "Proposal"("shareToken");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_originalId_fkey" FOREIGN KEY ("originalId") REFERENCES "SalesInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;


COMMIT;
