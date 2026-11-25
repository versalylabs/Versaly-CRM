-- Phase 6 (M-Pesa) production schema change. Additive only: 1 new nullable column, 4 new tables, indexes.
-- Run once against production BEFORE deploying the Phase 6 code (e.g. with scripts like last time).
BEGIN;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "paymentRef" TEXT;

-- CreateTable
CREATE TABLE "MpesaAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "shortcode" TEXT NOT NULL,
    "tillNumber" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "consumerKey" TEXT NOT NULL,
    "consumerSecret" TEXT NOT NULL,
    "passkey" TEXT NOT NULL,
    "callbackToken" TEXT NOT NULL,
    "c2bRegisteredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MpesaAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mpesaAccountId" TEXT,
    "leadId" TEXT,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "phone" TEXT,
    "payerName" TEXT,
    "accountRef" TEXT,
    "description" TEXT,
    "mpesaReceipt" TEXT,
    "checkoutRequestId" TEXT,
    "resultDesc" TEXT,
    "linkToken" TEXT,
    "matchedBy" TEXT,
    "createdById" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "remindersSent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MpesaAccount_callbackToken_key" ON "MpesaAccount"("callbackToken");

-- CreateIndex
CREATE INDEX "MpesaAccount_organizationId_idx" ON "MpesaAccount"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "MpesaAccount_organizationId_shortcode_key" ON "MpesaAccount"("organizationId", "shortcode");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_checkoutRequestId_key" ON "Payment"("checkoutRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_linkToken_key" ON "Payment"("linkToken");

-- CreateIndex
CREATE INDEX "Payment_organizationId_status_createdAt_idx" ON "Payment"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_organizationId_leadId_idx" ON "Payment"("organizationId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_organizationId_mpesaReceipt_key" ON "Payment"("organizationId", "mpesaReceipt");

-- CreateIndex
CREATE INDEX "PaymentPlan_organizationId_status_idx" ON "PaymentPlan"("organizationId", "status");

-- CreateIndex
CREATE INDEX "PaymentPlan_leadId_idx" ON "PaymentPlan"("leadId");

-- CreateIndex
CREATE INDEX "Installment_planId_dueDate_idx" ON "Installment"("planId", "dueDate");

-- CreateIndex
CREATE INDEX "Installment_dueDate_idx" ON "Installment"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_organizationId_paymentRef_key" ON "Lead"("organizationId", "paymentRef");

-- AddForeignKey
ALTER TABLE "MpesaAccount" ADD CONSTRAINT "MpesaAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_mpesaAccountId_fkey" FOREIGN KEY ("mpesaAccountId") REFERENCES "MpesaAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PaymentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
