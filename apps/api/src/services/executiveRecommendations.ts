/**
 * Domain: Executive Recommendations — actionable insights for CFO decision-making.
 */
import {
  getContractIntelligenceDashboard,
} from "./contractIntelligence";

function formatInr(amount: number) {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }

  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }

  return `₹${amount.toLocaleString("en-IN")}`;
}

export type ExecutiveRecommendation = {
  id: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  category: "CONTRACT" | "VENDOR" | "BUDGET" | "COMPLIANCE";
  title: string;
  recommendation: string;
  impact: string;
  contractId?: number;
  vendorName?: string;
  action?: string;
};

function estimateSavings(amount: number, rate: number) {
  return Math.round(amount * rate);
}

export async function getExecutiveRecommendations(): Promise<{
  recommendations: ExecutiveRecommendation[];
  generatedAt: string;
}> {
  const dashboard =
    await getContractIntelligenceDashboard();
  const recommendations: ExecutiveRecommendation[] = [];

  for (const row of dashboard.expiring.filter(
    (item) => item.urgency !== "healthy"
  )) {
    recommendations.push({
      id: `expiring-${row.id}`,
      severity:
        row.urgency === "critical" ? "HIGH" : "MEDIUM",
      category: "CONTRACT",
      title: `${row.title} expires in ${row.daysRemaining} days`,
      recommendation: row.autoRenew
        ? "Review auto-renewal terms and disable if renewal is not intended"
        : "Start renewal workflow or competitive RFQ within notice period",
      impact: `Potential exposure ${formatInr(row.contractValue)}`,
      contractId: row.id,
      vendorName: row.vendorName,
      action: row.autoRenew
        ? "disable-renewal"
        : "renew",
    });
  }

  for (const row of dashboard.autoRenewals.slice(0, 3)) {
    recommendations.push({
      id: `auto-renew-${row.id}`,
      severity: "HIGH",
      category: "CONTRACT",
      title: `Auto-renewal risk — ${row.title}`,
      recommendation:
        "Disable auto-renewal or escalate to contract owner before notice deadline",
      impact: `Renewal lock-in ${formatInr(row.contractValue)}`,
      contractId: row.id,
      vendorName: row.vendorName,
      action: "escalate",
    });
  }

  for (const row of dashboard.underutilized.slice(0, 3)) {
    const savings = estimateSavings(
      row.remaining,
      0.15
    );

    recommendations.push({
      id: `under-${row.id}`,
      severity:
        row.utilizationPercent < 10 ? "HIGH" : "MEDIUM",
      category: "CONTRACT",
      title: `Underutilized — ${row.title} at ${row.utilizationPercent}%`,
      recommendation:
        "Review commitment, reduce contract value, or reallocate budget",
      impact: `Potential savings ${formatInr(savings)}`,
      contractId: row.id,
      vendorName: row.vendorName,
      action: "review",
    });
  }

  for (const row of dashboard.concentration.filter(
    (item) => item.highDependency
  )) {
    const savings = estimateSavings(
      row.contractValue,
      0.08
    );

    recommendations.push({
      id: `conc-${row.vendorName.replace(/\s+/g, "-").toLowerCase()}`,
      severity: "HIGH",
      category: "VENDOR",
      title: `${row.vendorName} dependency at ${row.spendPercent}%`,
      recommendation:
        "Run competitive RFQ and onboard alternate vendors within 30 days",
      impact: `Potential savings ${formatInr(savings)}`,
      vendorName: row.vendorName,
      action: "create-rfq",
    });
  }

  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };

  recommendations.sort(
    (a, b) =>
      severityOrder[a.severity] -
      severityOrder[b.severity]
  );

  return {
    recommendations: recommendations.slice(0, 12),
    generatedAt: new Date().toISOString(),
  };
}
