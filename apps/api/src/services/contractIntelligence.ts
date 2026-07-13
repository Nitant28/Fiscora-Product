/**
 * Domain: Contract Intelligence — executive contract risk, renewal, and spend analytics.
 */
import prisma from "../db";
import { notDeleted } from "../lib/softDelete";
import {
  daysUntilExpiry,
  getExpiringContracts,
  summarizeExpiryAlerts,
} from "./contractAlerts";
import { calculateContractUtilization } from "./contractUtilization";

export type ContractUrgency = "critical" | "warning" | "healthy";

/** Sprint 12 contract metadata (schema fields; Prisma client may lag). */
type ContractIntelFields = {
  renewalNoticeDays?: number | null;
  ownerDepartment?: string | null;
  contractCategory?: string | null;
  annualValue?: { toString(): string } | number | null;
};

function urgencyFromDays(daysRemaining: number): ContractUrgency {
  if (daysRemaining <= 30) {
    return "critical";
  }

  if (daysRemaining <= 90) {
    return "warning";
  }

  return "healthy";
}

function contractAnnualValue(
  contract: {
    value: { toString(): string } | number;
  } & ContractIntelFields
): number {
  if (contract.annualValue != null) {
    return Number(contract.annualValue);
  }

  return Number(contract.value);
}

async function loadActiveContracts() {
  return prisma.contract.findMany({
    where: {
      ...notDeleted,
      status: "ACTIVE",
    },
    include: {
      vendor: { select: { id: true, name: true } },
    },
    orderBy: { endDate: "asc" },
  });
}

export async function getExpiringContractsIntel(
  asOf: Date = new Date()
) {
  const alerts = await getExpiringContracts(asOf);

  return alerts.map((alert) => ({
    id: alert.id,
    contractNumber: alert.contractNumber,
    title: alert.title,
    vendorName: alert.vendorName,
    endDate: alert.endDate.toISOString(),
    daysRemaining: alert.daysRemaining,
    contractValue: alert.value,
    urgency: urgencyFromDays(alert.daysRemaining),
    autoRenew: alert.autoRenew,
    renewalRequired: alert.renewalRequired,
  }));
}

export async function getAutoRenewalRisk(asOf: Date = new Date()) {
  const horizon = new Date(asOf);
  horizon.setDate(horizon.getDate() + 90);

  const contracts = await prisma.contract.findMany({
    where: {
      ...notDeleted,
      status: "ACTIVE",
      autoRenew: true,
      endDate: {
        gte: asOf,
        lte: horizon,
      },
    },
    include: {
      vendor: { select: { name: true } },
    },
    orderBy: { endDate: "asc" },
  });

  return contracts.map((contract) => {
    const intel = contract as typeof contract & ContractIntelFields;
    const daysRemaining = daysUntilExpiry(
      contract.endDate,
      asOf
    );
    const noticeDays =
      intel.renewalNoticeDays ?? 60;

    return {
      id: contract.id,
      contractNumber: contract.contractNumber,
      title: contract.title,
      vendorName: contract.vendor.name,
      endDate: contract.endDate.toISOString(),
      daysRemaining,
      autoRenew: contract.autoRenew,
      renewalNoticeDays: noticeDays,
      noticeDeadline: new Date(
        contract.endDate.getTime() -
          noticeDays * 24 * 60 * 60 * 1000
      ).toISOString(),
      contractValue: contractAnnualValue(intel),
      urgency: urgencyFromDays(daysRemaining),
      risk:
        daysRemaining <= noticeDays
          ? "NOTICE_WINDOW"
          : "UPCOMING",
    };
  });
}

export async function getUnderUtilizedContracts(
  thresholdPercent = 25
) {
  const contracts = await loadActiveContracts();
  const rows = [];

  for (const contract of contracts) {
    const intel = contract as typeof contract & ContractIntelFields;
    const utilization = await calculateContractUtilization(
      contract.id
    );

    if (
      utilization.utilizationPercent >= thresholdPercent &&
      utilization.utilizationPercent <= 100
    ) {
      continue;
    }

    if (utilization.utilizationPercent > 100) {
      continue;
    }

    rows.push({
      id: contract.id,
      contractNumber: contract.contractNumber,
      title: contract.title,
      vendorName: contract.vendor.name,
      contractValue: utilization.contractValue,
      spend: utilization.utilized,
      remaining: utilization.remaining,
      utilizationPercent: utilization.utilizationPercent,
      ownerDepartment:
        intel.ownerDepartment ?? null,
      contractCategory:
        intel.contractCategory ?? null,
      trend:
        utilization.utilizationPercent < 10
          ? "Decreasing"
          : "Stable",
    });
  }

  return rows.sort(
    (a, b) => a.utilizationPercent - b.utilizationPercent
  );
}

export async function getOverUtilizedContracts(
  thresholdPercent = 90
) {
  const contracts = await loadActiveContracts();
  const rows = [];

  for (const contract of contracts) {
    const utilization = await calculateContractUtilization(
      contract.id
    );

    if (utilization.utilizationPercent < thresholdPercent) {
      continue;
    }

    rows.push({
      id: contract.id,
      contractNumber: contract.contractNumber,
      title: contract.title,
      vendorName: contract.vendor.name,
      contractValue: utilization.contractValue,
      spend: utilization.utilized,
      remaining: utilization.remaining,
      utilizationPercent: utilization.utilizationPercent,
      urgency:
        utilization.utilizationPercent > 100
          ? "critical"
          : "warning",
    });
  }

  return rows.sort(
    (a, b) => b.utilizationPercent - a.utilizationPercent
  );
}

export async function getConcentrationRisk() {
  const contracts = await loadActiveContracts();
  const vendorSpend = new Map<
    number,
    {
      vendorId: number;
      vendorName: string;
      spend: number;
      contractValue: number;
    }
  >();

  for (const contract of contracts) {
    const utilization = await calculateContractUtilization(
      contract.id
    );
    const existing = vendorSpend.get(contract.vendorId) ?? {
      vendorId: contract.vendorId,
      vendorName: contract.vendor.name,
      spend: 0,
      contractValue: 0,
    };

    existing.spend += utilization.utilized;
    existing.contractValue += utilization.contractValue;
    vendorSpend.set(contract.vendorId, existing);
  }

  const rows = [...vendorSpend.values()].sort(
    (a, b) => b.spend - a.spend
  );
  const totalSpend = rows.reduce(
    (sum, row) => sum + row.spend,
    0
  );

  return rows.map((row) => {
    const spendPercent =
      totalSpend > 0
        ? Math.round((row.spend / totalSpend) * 1000) / 10
        : 0;

    return {
      vendorId: row.vendorId,
      vendorName: row.vendorName,
      spend: row.spend,
      contractValue: row.contractValue,
      spendPercent,
      highDependency: spendPercent >= 60,
    };
  });
}

export async function getRenewalCalendar(
  monthsAhead = 6,
  asOf: Date = new Date()
) {
  const end = new Date(asOf);
  end.setMonth(end.getMonth() + monthsAhead);

  const contracts = await prisma.contract.findMany({
    where: {
      ...notDeleted,
      status: "ACTIVE",
      endDate: {
        gte: asOf,
        lte: end,
      },
    },
    include: {
      vendor: { select: { name: true } },
    },
    orderBy: { endDate: "asc" },
  });

  const calendar = new Map<
    string,
    {
      month: string;
      monthKey: string;
      items: {
        id: number;
        title: string;
        vendorName: string;
        endDate: string;
        autoRenew: boolean;
      }[];
    }
  >();

  for (const contract of contracts) {
    const monthKey = `${contract.endDate.getFullYear()}-${String(contract.endDate.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = contract.endDate.toLocaleString(
      "en-IN",
      { month: "long", year: "numeric" }
    );

    const bucket = calendar.get(monthKey) ?? {
      month: monthLabel,
      monthKey,
      items: [],
    };

    bucket.items.push({
      id: contract.id,
      title: contract.title,
      vendorName: contract.vendor.name,
      endDate: contract.endDate.toISOString(),
      autoRenew: contract.autoRenew,
    });

    calendar.set(monthKey, bucket);
  }

  return [...calendar.values()];
}

export async function getContractIntelligenceDashboard(
  asOf: Date = new Date()
) {
  const [
    expiring,
    autoRenewals,
    underutilized,
    overutilized,
    concentration,
    calendar,
    activeContracts,
  ] = await Promise.all([
    getExpiringContractsIntel(asOf),
    getAutoRenewalRisk(asOf),
    getUnderUtilizedContracts(),
    getOverUtilizedContracts(),
    getConcentrationRisk(),
    getRenewalCalendar(6, asOf),
    loadActiveContracts(),
  ]);

  const expirySummary = summarizeExpiryAlerts(
    await getExpiringContracts(asOf)
  );

  const highValueTotal = activeContracts.reduce(
    (sum, contract) =>
      sum + contractAnnualValue(contract),
    0
  );

  const highDependencyVendors = concentration.filter(
    (row) => row.highDependency
  ).length;

  return {
    summary: {
      expiringSoon: expirySummary.within30Days,
      autoRenewals: autoRenewals.length,
      underutilized: underutilized.length,
      overutilized: overutilized.length,
      highValueTotal,
      highDependencyVendors,
      activeContracts: activeContracts.length,
    },
    expiring,
    autoRenewals,
    underutilized,
    overutilized,
    concentration,
    calendar,
    generatedAt: asOf.toISOString(),
  };
}
