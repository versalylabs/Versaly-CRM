-- Add account activation state and move the default staff role to AGENT
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

UPDATE "User" SET "role" = 'AGENT' WHERE "role" = 'USER';
