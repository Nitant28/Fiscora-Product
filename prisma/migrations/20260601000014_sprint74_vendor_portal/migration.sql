-- Sprint 7.4: Vendor Portal fields and session table

ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "ifscCode" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "msmeNumber" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "portalEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "portalEmail" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "portalPasswordHash" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "kycStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Vendor_portalEmail_key" ON "Vendor"("portalEmail");

CREATE TABLE IF NOT EXISTS "VendorPortalSession" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorPortalSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VendorPortalSession_token_key" ON "VendorPortalSession"("token");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'VendorPortalSession_vendorId_fkey'
  ) THEN
    ALTER TABLE "VendorPortalSession"
      ADD CONSTRAINT "VendorPortalSession_vendorId_fkey"
      FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
