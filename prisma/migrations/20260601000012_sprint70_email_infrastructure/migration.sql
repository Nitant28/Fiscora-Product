-- Sprint 7.0: Email notification infrastructure

CREATE TABLE "NotificationTemplate" (
    "id" SERIAL NOT NULL,
    "event" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationTemplate_event_key" ON "NotificationTemplate"("event");

CREATE TABLE "NotificationQueue" (
    "id" SERIAL NOT NULL,
    "event" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientUserId" INTEGER,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationQueue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationQueue_status_createdAt_idx" ON "NotificationQueue"("status", "createdAt");

CREATE TABLE "NotificationDispatch" (
    "id" SERIAL NOT NULL,
    "event" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDispatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationDispatch_event_entityType_entityId_key" ON "NotificationDispatch"("event", "entityType", "entityId");
