/**
 * Domain: Contract lifecycle — expiry windows, severity classification, and renewal alerts.
 * Main exports: daysUntilExpiry, classifyExpirySeverity, getExpiringContracts, getRenewalAlerts,
 *   summarizeExpiryAlerts, getContractExpirySummary, getRenewalStatus.
 * Called by: contract.routes.ts, contracts.ts, notificationService.ts, controlTower.ts, executiveAnalytics.ts;
 *   scripts/verify-contract-expiry-alerts.ts.
 */
import prisma from "../db";

export type ContractAlertSeverity =
  | "INFO"
  | "WARNING"
  | "CRITICAL";

export type ContractExpiryAlert = {
  id: number;
  contractNumber: string;
  title: string;
  vendorId: number;
  vendorName: string;
  endDate: Date;
  renewalDate: Date | null;
  autoRenew: boolean;
  value: number;
  daysRemaining: number;
  severity: ContractAlertSeverity;
  alertWindow: "90_DAY" | "60_DAY" | "30_DAY";
  renewalRequired: boolean;
};

export type ContractExpirySummary = {
  criticalExpirations: number;
  within30Days: number;
  within60Days: number;
  within90Days: number;
  contractsRequiringAction: number;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/* --- CLASSIFICATION --- */

export function daysUntilExpiry(
  endDate: Date,
  asOf: Date = new Date()
): number {
  return Math.ceil(
    (endDate.getTime() - asOf.getTime()) /
      MS_PER_DAY
  );
}

export function classifyExpirySeverity(
  daysRemaining: number
): ContractAlertSeverity | null {
  if (daysRemaining <= 0) {
    return "CRITICAL";
  }

  if (daysRemaining <= 30) {
    return "CRITICAL";
  }

  if (daysRemaining <= 60) {
    return "WARNING";
  }

  if (daysRemaining <= 90) {
    return "INFO";
  }

  return null;
}

function alertWindowForDays(
  daysRemaining: number
): ContractExpiryAlert["alertWindow"] {
  if (daysRemaining <= 30) {
    return "30_DAY";
  }

  if (daysRemaining <= 60) {
    return "60_DAY";
  }

  return "90_DAY";
}

function toExpiryAlert(
  contract: {
    id: number;
    contractNumber: string;
    title: string;
    endDate: Date;
    renewalDate: Date | null;
    autoRenew: boolean;
    value: { toString(): string } | number;
    vendor: { id: number; name: string };
  },
  asOf: Date
): ContractExpiryAlert | null {
  const daysRemaining = daysUntilExpiry(
    contract.endDate,
    asOf
  );
  const severity =
    classifyExpirySeverity(daysRemaining);

  if (!severity) {
    return null;
  }

  return {
    id: contract.id,
    contractNumber: contract.contractNumber,
    title: contract.title,
    vendorId: contract.vendor.id,
    vendorName: contract.vendor.name,
    endDate: contract.endDate,
    renewalDate: contract.renewalDate,
    autoRenew: contract.autoRenew,
    value: Number(contract.value),
    daysRemaining,
    severity,
    alertWindow:
      alertWindowForDays(daysRemaining),
    renewalRequired: !contract.autoRenew,
  };
}

/* --- QUERIES --- */

export async function getExpiringContracts(
  asOf: Date = new Date()
): Promise<ContractExpiryAlert[]> {
  const cutoff = new Date(asOf);
  cutoff.setDate(cutoff.getDate() + 90);

  const contracts =
    await prisma.contract.findMany({
      where: {
        status: "ACTIVE",
        endDate: {
          gte: asOf,
          lte: cutoff,
        },
      },
      include: {
        vendor: {
          select: { id: true, name: true },
        },
      },
      orderBy: { endDate: "asc" },
    });

  return contracts
    .map((contract) =>
      toExpiryAlert(contract, asOf)
    )
    .filter(
      (
        alert
      ): alert is ContractExpiryAlert =>
        alert != null
    );
}

export async function getRenewalAlerts(
  asOf: Date = new Date()
): Promise<ContractExpiryAlert[]> {
  const alerts =
    await getExpiringContracts(asOf);

  return alerts.filter(
    (alert) => alert.renewalRequired
  );
}

/* --- SUMMARIES --- */

export function summarizeExpiryAlerts(
  alerts: ContractExpiryAlert[]
): ContractExpirySummary {
  return {
    criticalExpirations: alerts.filter(
      (alert) =>
        alert.severity === "CRITICAL"
    ).length,
    within30Days: alerts.filter(
      (alert) => alert.daysRemaining <= 30
    ).length,
    within60Days: alerts.filter(
      (alert) =>
        alert.daysRemaining > 30 &&
        alert.daysRemaining <= 60
    ).length,
    within90Days: alerts.filter(
      (alert) =>
        alert.daysRemaining > 60 &&
        alert.daysRemaining <= 90
    ).length,
    contractsRequiringAction:
      alerts.filter(
        (alert) => alert.renewalRequired
      ).length,
  };
}

export async function getContractExpirySummary(
  asOf: Date = new Date()
): Promise<ContractExpirySummary> {
  const alerts =
    await getExpiringContracts(asOf);
  return summarizeExpiryAlerts(alerts);
}

export function getRenewalStatus(input: {
  autoRenew: boolean;
  daysRemaining: number;
  status: string;
}): string {
  if (input.status !== "ACTIVE") {
    return input.status;
  }

  if (input.autoRenew) {
    return "Auto Renew Enabled";
  }

  if (input.daysRemaining <= 90) {
    return "Renewal Required";
  }

  return "On Track";
}
