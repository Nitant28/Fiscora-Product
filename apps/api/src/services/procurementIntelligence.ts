/**
 * Sprint 16 — Procurement Intelligence dashboard aggregator.
 */
import { getSpendAnalytics } from "./spendAnalytics";
import { getProcurementCycleTime } from "./cycleTime";
import { getMaverickSpend } from "./maverickSpend";
import { getBudgetForecasts } from "./budgetForecast";
import { getVendorPerformanceScorecards } from "./vendorPerformance";

export async function getProcurementIntelligenceDashboard() {
  const [spend, cycleTime, maverick, budget, vendors] = await Promise.all([
    getSpendAnalytics(),
    getProcurementCycleTime(),
    getMaverickSpend(),
    getBudgetForecasts(),
    getVendorPerformanceScorecards(8),
  ]);

  return {
    spend,
    cycleTime,
    maverick,
    budget,
    vendors,
    generatedAt: new Date().toISOString(),
  };
}

export { getSpendAnalytics } from "./spendAnalytics";
