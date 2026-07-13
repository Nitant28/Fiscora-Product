/**
 * AI Copilot verification harness.
 * Runs sample questions per role against the seeded DB and prints the grounded
 * answer, navigation target, and provenance — proving RBAC + grounding.
 *
 * Run: pnpm --filter api exec tsx scripts/testCopilot.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { PrismaClient, type UserRole } from "@prisma/client";
import { runWithTenantId } from "../src/lib/tenantContext";
import { askCopilot } from "../src/services/copilot/copilot.service";
import { detectIntent } from "../src/services/copilot/intent";
import { resolveNavigation } from "../src/services/copilot/navigation";
import { classifyScope } from "../src/services/copilot/scope";

const base = new PrismaClient();

const QUESTIONS = [
  "take me to vendor approvals",
  "open purchase orders",
  "what needs my approval",
  "How do I create a Purchase Request?",
  "Explain 3-way matching",
  "How does OCR work inside Fiscora?",
  "find contract",
  // Out-of-scope — must be refused, never answered:
  "Who is Elon Musk?",
  "Write a poem about the sea",
  "hi",
];

function line() {
  console.log("─".repeat(72));
}

async function main() {
  // Pure, DB-free checks first (deterministic navigation + intent).
  console.log("\n== Deterministic layer (no DB, no LLM) ==");
  for (const q of [
    "take me to vendor approvals",
    "open payments",
    "billing",
    "Who is Elon Musk?",
    "Write a poem about the sea",
  ]) {
    const intent = detectIntent(q);
    const scope = classifyScope(q);
    const nav = resolveNavigation("ADMIN", intent.query || q);
    console.log(
      `  "${q}" → intent=${intent.kind} inScope=${scope.inScope} matched=[${scope.matchedTerms.join(",")}] nav=${nav ? nav.page.path : "none"}`
    );
  }

  const roles: UserRole[] = ["EMPLOYEE", "PROCUREMENT", "CFO", "ADMIN"];

  for (const role of roles) {
    const user = await base.user.findFirst({
      where: { role },
      select: { id: true, name: true, role: true, tenantId: true },
    });
    if (!user) {
      console.log(`\n(no seeded ${role} user — skipping)`);
      continue;
    }

    line();
    console.log(`ROLE: ${role}  (user: ${user.name}, tenant ${user.tenantId})`);
    line();

    for (const q of QUESTIONS) {
      const res = await runWithTenantId(user.tenantId, () =>
        askCopilot(
          { id: user.id, name: user.name, role: user.role, tenantId: user.tenantId },
          q
        )
      );
      console.log(`\nQ: ${q}`);
      console.log(`A: ${res.answer.replace(/\n/g, "\n   ")}`);
      if (res.navigate) console.log(`→ navigate: ${res.navigate.path}`);
      console.log(
        `   provenance: intent=${res.provenance.intent} tool=${res.provenance.tool} ` +
          `src=${res.provenance.source} conf=${res.provenance.confidence} ` +
          `grounded=${res.provenance.grounded} outOfScope=${res.provenance.outOfScope} ` +
          `formatter=${res.provenance.formatter} ${res.provenance.durationMs}ms`
      );
    }
  }

  line();
  console.log("Copilot verification complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await base.$disconnect();
  });
