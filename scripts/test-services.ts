/**
 * =============================================================================
 * SCRIPT: test-services.ts
 * LOCATION: scripts/
 * PURPOSE: Smoke-test analytics and document service endpoints against a
 *          running local API server.
 *
 * WHAT IT DOES (1 phase):
 *   1. Hits executive analytics, category analytics, document decision,
 *      procurement-insights, and vendor analytics routes; prints JSON.
 *
 * RUN: npx tsx scripts/test-services.ts
 *      (requires API at http://localhost:4000)
 * =============================================================================
 */

const BASE = "http://localhost:4000";

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`);
  const body = await res.json();
  return { status: res.status, body };
}

async function main() {
  /* =========================================================================
   * PHASE 1: Call service endpoints and dump responses
   * Uses first document ID when available for document-scoped routes.
   * ========================================================================= */
  const docs = await get("/documents");
  const firstId =
    docs.body?.documents?.[0]?.id;

  console.log("GET /analytics/executive");
  console.log(
    JSON.stringify(
      (await get("/analytics/executive")).body,
      null,
      2
    )
  );

  console.log("\nGET /analytics/categories");
  console.log(
    JSON.stringify(
      (await get("/analytics/categories")).body,
      null,
      2
    )
  );

  if (firstId) {
    console.log(`\nGET /documents/${firstId}/decision`);
    console.log(
      JSON.stringify(
        (
          await get(
            `/documents/${firstId}/decision`
          )
        ).body,
        null,
        2
      )
    );

    console.log(
      `\nGET /documents/${firstId}/procurement-insights`
    );
    console.log(
      JSON.stringify(
        (
          await get(
            `/documents/${firstId}/procurement-insights`
          )
        ).body,
        null,
        2
      )
    );

    const doc = await get(
      `/documents/${firstId}`
    );
    const vendorId =
      doc.body?.document?.vendorId;

    if (vendorId) {
      console.log(
        `\nGET /vendors/${vendorId}/analytics`
      );
      console.log(
        JSON.stringify(
          (
            await get(
              `/vendors/${vendorId}/analytics`
            )
          ).body,
          null,
          2
        )
      );
    }
  }

  console.log("\nDone.");
}

main().catch(console.error);
