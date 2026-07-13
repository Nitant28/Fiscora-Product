-- Sprint 4.6: Vendor payment terms default

UPDATE "Vendor"
SET "paymentTermsDays" = 30
WHERE "paymentTermsDays" IS NULL;

ALTER TABLE "Vendor"
ALTER COLUMN "paymentTermsDays" SET DEFAULT 30;

ALTER TABLE "Vendor"
ALTER COLUMN "paymentTermsDays" SET NOT NULL;
