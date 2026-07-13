-- Sprint 1: Budget Reservation Engine
-- Migrate Department.spent -> spentBudget and add reservation buckets

ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "reservedBudget" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "committedBudget" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "spentBudget" DOUBLE PRECISION NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Department' AND column_name = 'spent'
  ) THEN
    UPDATE "Department" SET "spentBudget" = "spent" WHERE "spentBudget" = 0;
    ALTER TABLE "Department" DROP COLUMN "spent";
  END IF;
END $$;
