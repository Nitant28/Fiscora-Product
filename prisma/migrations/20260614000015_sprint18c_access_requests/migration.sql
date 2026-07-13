-- Sprint 18C: Access Requests (self-service provisioning workflow)

CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "AccessRequest" (
  "id" SERIAL NOT NULL,
  "tenantId" INTEGER NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "clerkId" TEXT,
  "requestedDepartment" TEXT,
  "reason" TEXT,
  "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" INTEGER,
  "createdUserId" INTEGER,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),

  CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccessRequest_tenantId_status_idx" ON "AccessRequest"("tenantId", "status");
CREATE INDEX "AccessRequest_email_idx" ON "AccessRequest"("email");

ALTER TABLE "AccessRequest"
  ADD CONSTRAINT "AccessRequest_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
