-- One-off production schema change (2026-11-17): email templates become per-workspace.
-- Safe/additive: adds a nullable column, swaps the global unique name index for a per-workspace one.
-- Existing rows keep organizationId = NULL; names were already globally unique, so no conflicts are possible.

BEGIN;

ALTER TABLE "EmailTemplate" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

DROP INDEX IF EXISTS "EmailTemplate_name_key";

CREATE UNIQUE INDEX IF NOT EXISTS "EmailTemplate_organizationId_name_key"
  ON "EmailTemplate"("organizationId", "name");

CREATE INDEX IF NOT EXISTS "EmailTemplate_organizationId_idx"
  ON "EmailTemplate"("organizationId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailTemplate_organizationId_fkey') THEN
    ALTER TABLE "EmailTemplate"
      ADD CONSTRAINT "EmailTemplate_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
