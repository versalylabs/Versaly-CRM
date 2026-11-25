-- Phase 7 (WhatsApp + SMS) production schema change. Additive only: new columns with defaults, 1 new table.
-- Run once against production BEFORE deploying the Phase 7 code.
BEGIN;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "autoAssignInbox" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inboxSlaMinutes" INTEGER,
ADD COLUMN     "smsCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "smsSenderId" TEXT;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "slaBreachedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SmsCreditLedger" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "change" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsCreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SmsCreditLedger_reference_key" ON "SmsCreditLedger"("reference");

-- CreateIndex
CREATE INDEX "SmsCreditLedger_organizationId_createdAt_idx" ON "SmsCreditLedger"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "SmsCreditLedger" ADD CONSTRAINT "SmsCreditLedger_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
