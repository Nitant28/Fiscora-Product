/**
 * Domain: Contract governance — risk classification, status sync, renewal queue.
 * Rules: CRITICAL (expired), HIGH (<30d), MEDIUM (<60d), LOW (<90d).
 */
import prisma from "../db";
import { notDeleted } from "../lib/softDelete";
import { daysUntilExpiry } from "./contractAlerts";

export type ContractRiskLevel =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "NONE";

export type ContractRiskAssessment = {
  level: ContractRiskLevel;
  daysRemaining: number;
};

export type ContractRiskSummary = {
  expired: number;
  expiringIn30Days: number;
  expiringIn60Days: number;
  expiringIn90Days: number;
  totalAtRisk: number;
};

export type RenewalQueueItem = {
  id: number;
  contractNumber: string;
  title: string;
  vendorId: number;
  vendor: { id: number; name: string };
  value: number;
  endDate: Date;
  autoRenew: boolean;
  noticePeriodDays: number;
  status: string;
  risk: ContractRiskAssessment;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const GOVERNED_STATUSES = [
  "ACTIVE",
  "EXPIRING",
  "EXPIRED",
] as const;

/* --- RISK CLASSIFICATION --- */

export function assessContractRisk(
  endDate: Date,
  asOf: Date = new Date()
): ContractRiskAssessment {
  const daysRemaining = daysUntilExpiry(endDate, asOf);

  if (daysRemaining <= 0) {
    return { level: "CRITICAL", daysRemaining };
  }

  if (daysRemaining <= 30) {
    return { level: "HIGH", daysRemaining };
  }

  if (daysRemaining <= 60) {
    return { level: "MEDIUM", daysRemaining };
  }

  if (daysRemaining <= 90) {
    return { level: "LOW", daysRemaining };
  }

  return { level: "NONE", daysRemaining };
}

function bucketRisk(
  risk: ContractRiskAssessment,
  summary: ContractRiskSummary
) {
  switch (risk.level) {
    case "CRITICAL":
      summary.expired += 1;
      break;
    case "HIGH":
      summary.expiringIn30Days += 1;
      break;
    case "MEDIUM":
      summary.expiringIn60Days += 1;
      break;
    case "LOW":
      summary.expiringIn90Days += 1;
      break;
    default:
      break;
  }
}

/* --- STATUS SYNC --- */

export async function syncContractStatuses(
  asOf: Date = new Date()
) {
  const in90Days = new Date(
    asOf.getTime() + 90 * MS_PER_DAY
  );

  await prisma.contract.updateMany({
    where: {
      ...notDeleted,
      status: { notIn: ["TERMINATED", "DRAFT"] },
      endDate: { lt: asOf },
    },
    data: { status: "EXPIRED" },
  });

  await prisma.contract.updateMany({
    where: {
      ...notDeleted,
      status: { notIn: ["TERMINATED", "DRAFT"] },
      endDate: { gte: asOf, lte: in90Days },
    },
    data: { status: "EXPIRING" },
  });

  await prisma.contract.updateMany({
    where: {
      ...notDeleted,
      status: { notIn: ["TERMINATED", "DRAFT"] },
      endDate: { gt: in90Days },
    },
    data: { status: "ACTIVE" },
  });
}

/* --- QUERIES --- */

export async function getContractRiskSummary(
  asOf: Date = new Date()
): Promise<ContractRiskSummary> {
  await syncContractStatuses(asOf);

  const contracts =
    await prisma.contract.findMany({
      where: {
        ...notDeleted,
        status: { in: [...GOVERNED_STATUSES] },
      },
      select: { endDate: true },
    });

  const summary: ContractRiskSummary = {
    expired: 0,
    expiringIn30Days: 0,
    expiringIn60Days: 0,
    expiringIn90Days: 0,
    totalAtRisk: 0,
  };

  for (const contract of contracts) {
    const risk = assessContractRisk(
      contract.endDate,
      asOf
    );
    if (risk.level === "NONE") {
      continue;
    }
    bucketRisk(risk, summary);
  }

  summary.totalAtRisk =
    summary.expired +
    summary.expiringIn30Days +
    summary.expiringIn60Days +
    summary.expiringIn90Days;

  return summary;
}

export async function getRenewalQueue(
  asOf: Date = new Date()
): Promise<RenewalQueueItem[]> {
  await syncContractStatuses(asOf);

  const contracts =
    await prisma.contract.findMany({
      where: {
        ...notDeleted,
        status: { in: [...GOVERNED_STATUSES] },
      },
      include: {
        vendor: {
          select: { id: true, name: true },
        },
      },
      orderBy: { endDate: "asc" },
    });

  const queue: RenewalQueueItem[] = [];

  for (const contract of contracts) {
    const risk = assessContractRisk(
      contract.endDate,
      asOf
    );

    if (risk.level === "NONE") {
      continue;
    }

    queue.push({
      id: contract.id,
      contractNumber: contract.contractNumber,
      title: contract.title,
      vendorId: contract.vendorId,
      vendor: contract.vendor,
      value: Number(contract.value),
      endDate: contract.endDate,
      autoRenew: contract.autoRenew,
      noticePeriodDays:
        contract.renewalNoticeDays ?? 30,
      status: contract.status,
      risk,
    });
  }

  return queue.sort(
    (a, b) =>
      a.risk.daysRemaining -
      b.risk.daysRemaining
  );
}
