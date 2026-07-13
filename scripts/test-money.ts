/**
 * =============================================================================
 * SCRIPT: test-money.ts
 * LOCATION: scripts/
 * PURPOSE: Quick sanity check for money parsing helpers against a sample
 *          invoice snippet (no database required).
 *
 * WHAT IT DOES (1 phase):
 *   1. Runs extractMoney on labeled fields and parseMoney on sample strings.
 *
 * RUN: npx tsx scripts/test-money.ts
 * =============================================================================
 */

import { extractMoney, parseMoney } from "../apps/worker/src/extraction/money.ts";

// Sample invoice block with subtotal, discount, shipping, total, balance due
const sample = `
SuperSt0re
INVOICE
# 13130
Date: Feb 29 2012
Subtotal: $1,899.94
Discount: $759.98
Shipping: $163.42
Total: $1,303.38
Balance Due: $1,303.38
`;

/* =========================================================================
 * PHASE 1: Extract labeled money fields from sample text
 * ========================================================================= */
console.log("Subtotal:", extractMoney(sample, "Subtotal"));
console.log("Discount:", extractMoney(sample, "Discount"));
console.log("Shipping:", extractMoney(sample, "Shipping"));
console.log("Total:", extractMoney(sample, "Total"));
console.log("Balance Due:", extractMoney(sample, "Balance Due"));

// --- parseMoney: normalize currency strings to numeric values ---
console.log("\nParse $1,303.38:", parseMoney("$1,303.38"));
console.log("Parse $1:", parseMoney("$1"));
