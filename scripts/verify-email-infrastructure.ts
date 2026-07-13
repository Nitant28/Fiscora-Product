/**
 * =============================================================================
 * SCRIPT: verify-email-infrastructure.ts
 * LOCATION: scripts/
 * PURPOSE: Acceptance test for notification templates, rendering, queueing,
 *          and queue processing.
 *
 * WHAT IT DOES (4 phases):
 *   1. Seed notification templates if empty and count templates
 *   2. Verify key event templates exist (REQUEST_SUBMITTED, CONTRACT_30_DAY)
 *   3. Test renderTemplate variable substitution
 *   4. Queue a notification and process the queue; run acceptance checks
 *
 * RUN: npx tsx scripts/verify-email-infrastructure.ts
 * =============================================================================
 */

import prisma from "../apps/api/src/db";
import {
  NOTIFICATION_EVENTS,
  queueNotification,
  processNotificationQueue,
  renderTemplate,
  seedNotificationTemplatesIfEmpty,
} from "../apps/api/src/services/notificationService";

async function main() {
  /* =========================================================================
   * PHASE 1: Seed templates and inventory events
   * ========================================================================= */
  await seedNotificationTemplatesIfEmpty();

  const templateCount =
    await prisma.notificationTemplate.count();

  const expectedEvents = Object.values(
    NOTIFICATION_EVENTS
  );

  const templates =
    await prisma.notificationTemplate.findMany({
      select: { event: true, enabled: true },
    });

  const templateEvents = new Set(
    templates.map((template) => template.event)
  );

  /* =========================================================================
   * PHASE 2: Template rendering smoke test
   * ========================================================================= */
  const rendered = renderTemplate(
    "Hello {{requestTitle}} — {{amount}}",
    {
      requestTitle: "Laptop",
      amount: "₹50,000",
    }
  );

  /* =========================================================================
   * PHASE 3: Queue and process one notification
   * ========================================================================= */
  const queued = await queueNotification({
    event: NOTIFICATION_EVENTS.REQUEST_SUBMITTED,
    recipientEmail: "cfo@fiscora.com",
    variables: {
      requester: "Alex Employee",
      requestTitle: "Demo Request",
      amount: "₹50,000",
    },
  });

  const processed =
    await processNotificationQueue(5);

  /* =========================================================================
   * PHASE 4: Acceptance checks
   * ========================================================================= */
  const checks = [
    {
      label: "All notification templates seeded",
      pass: templateCount >= expectedEvents.length,
      actual: templateCount,
      expected: expectedEvents.length,
    },
    {
      label: "REQUEST_SUBMITTED template exists",
      pass: templateEvents.has(
        NOTIFICATION_EVENTS.REQUEST_SUBMITTED
      ),
      actual: NOTIFICATION_EVENTS.REQUEST_SUBMITTED,
      expected: "present",
    },
    {
      label: "CONTRACT_30_DAY template exists",
      pass: templateEvents.has(
        NOTIFICATION_EVENTS.CONTRACT_30_DAY
      ),
      actual: NOTIFICATION_EVENTS.CONTRACT_30_DAY,
      expected: "present",
    },
    {
      label: "Template rendering works",
      pass:
        rendered ===
        "Hello Laptop — ₹50,000",
      actual: rendered,
      expected: "Hello Laptop — ₹50,000",
    },
    {
      label: "Queue accepts notification",
      pass: queued != null,
      actual: queued?.event,
      expected:
        NOTIFICATION_EVENTS.REQUEST_SUBMITTED,
    },
    {
      label: "Queue processor runs",
      pass: processed.processed >= 1,
      actual: processed,
      expected: "processed >= 1",
    },
  ];

  console.log(
    JSON.stringify(
      {
        templateCount,
        processed,
        latestQueueItem: queued,
      },
      null,
      2
    )
  );

  console.log("\nAcceptance checks:");
  for (const check of checks) {
    console.log(
      `${check.pass ? "PASS" : "FAIL"} — ${check.label} (actual=${JSON.stringify(check.actual)}, expected=${check.expected})`
    );
  }

  if (!checks.every((check) => check.pass)) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
