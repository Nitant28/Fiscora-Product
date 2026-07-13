/**
 * Domain: Vendor contracts — CRUD, utilization-enriched views, and exposure re-export.
 * Main exports: listContracts, getContractById, createContract, updateContract, getContractExposureSummary (re-export).
 * Called by: modules/contracts/contract.routes.ts, executiveAnalytics.ts; scripts/verify-contract-utilization.ts, verify-dashboard-data-quality.ts.
 */
import prisma from "../db";
import { notDeleted } from "../lib/softDelete";
import { recordAuditLog } from "../lib/audit";
import {
  daysUntilExpiry,
  getRenewalStatus,
} from "./contractAlerts";
import {
  calculateContractUtilization,
  getContractExposureSummary,
} from "./contractUtilization";

function serializeContract(
  contract: {
    id: number;
    contractNumber: string;
    title: string;
    vendorId: number;
    value: { toString(): string } | number;
    startDate: Date;
    endDate: Date;
    renewalDate: Date | null;
    autoRenew: boolean;
    documentUrl: string | null;
    status: string;
    createdAt: Date;
    vendor: { id: number; name: string };
  },
  utilization?: Awaited<
    ReturnType<typeof calculateContractUtilization>
  >
) {
  const value = Number(contract.value);
  const utilized = utilization?.utilized ?? 0;
  const remaining =
    utilization?.remaining ??
    Math.max(value - utilized, 0);
  const utilizationPercent =
    utilization?.utilizationPercent ?? 0;

  return {
    id: contract.id,
    contractNumber: contract.contractNumber,
    title: contract.title,
    vendorId: contract.vendorId,
    vendor: contract.vendor,
    value,
    contractValue: value,
    utilized,
    remaining,
    utilizationPercent,
    startDate: contract.startDate,
    endDate: contract.endDate,
    renewalDate: contract.renewalDate,
    autoRenew: contract.autoRenew,
    documentUrl: contract.documentUrl,
    status: contract.status ?? "ACTIVE",
    createdAt: contract.createdAt,
  };
}

/* --- QUERIES --- */

export async function listContracts() {
  const contracts =
    await prisma.contract.findMany({
      where: notDeleted,
      include: {
        vendor: {
          select: { id: true, name: true },
        },
      },
      orderBy: { endDate: "asc" },
    });

  const rows = [];

  for (const contract of contracts) {
    const utilization =
      await calculateContractUtilization(
        contract.id
      );
    rows.push(
      serializeContract(
        contract,
        utilization
      )
    );
  }

  return rows;
}

export async function getContractById(id: number) {
  const contract =
    await prisma.contract.findUnique({
      where: { id },
      include: {
        vendor: {
          select: { id: true, name: true },
        },
        purchaseOrders: {
          select: {
            id: true,
            poNumber: true,
            vendorName: true,
            amount: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

  if (!contract) {
    return null;
  }

  const utilization =
    await calculateContractUtilization(id);
  const daysRemaining = daysUntilExpiry(
    contract.endDate
  );
  const renewalStatus = getRenewalStatus({
    autoRenew: contract.autoRenew,
    daysRemaining,
    status: contract.status,
  });

  return {
    ...serializeContract(
      contract,
      utilization
    ),
    daysRemaining,
    renewalStatus,
    purchaseOrders:
      contract.purchaseOrders,
  };
}

/* --- MUTATIONS --- */

export async function createContract(input: {
  contractNumber?: string;
  title?: string;
  vendorId: number;
  startDate: Date;
  endDate: Date;
  renewalDate?: Date | null;
  value: number;
  autoRenew?: boolean;
  documentUrl?: string | null;
  status?: "DRAFT" | "ACTIVE" | "EXPIRED" | "TERMINATED";
  actor: string;
}) {
  const vendor =
    await prisma.vendor.findUnique({
      where: { id: input.vendorId },
      select: { name: true },
    });

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  const contractNumber =
    input.contractNumber ??
    `CTR-${Date.now()}`;
  const title =
    input.title ??
    `${vendor.name} Contract`;

  const contract = await prisma.contract.create({
    data: {
      contractNumber,
      title,
      vendorId: input.vendorId,
      startDate: input.startDate,
      endDate: input.endDate,
      renewalDate: input.renewalDate ?? null,
      value: input.value,
      autoRenew: input.autoRenew ?? false,
      documentUrl: input.documentUrl ?? null,
      status: input.status ?? "ACTIVE",
    },
    include: {
      vendor: {
        select: { id: true, name: true },
      },
    },
  });

  await recordAuditLog(
    "Contract",
    contract.id,
    "Contract Created",
    input.actor,
    {
      newValue: {
        contractNumber,
        vendor: vendor.name,
        value: input.value,
        endDate: input.endDate,
      },
    }
  );

  const utilization =
    await calculateContractUtilization(
      contract.id
    );

  return serializeContract(
    contract,
    utilization
  );
}

export async function updateContract(
  id: number,
  input: {
    contractNumber?: string;
    title?: string;
    vendorId?: number;
    startDate?: Date;
    endDate?: Date;
    renewalDate?: Date | null;
    value?: number;
    autoRenew?: boolean;
    documentUrl?: string | null;
    status?: "DRAFT" | "ACTIVE" | "EXPIRED" | "TERMINATED";
    actor: string;
  }
) {
  const existing =
    await prisma.contract.findUnique({
      where: { id },
      include: {
        vendor: {
          select: { id: true, name: true },
        },
      },
    });

  if (!existing) {
    return null;
  }

  const contract = await prisma.contract.update({
    where: { id },
    data: {
      contractNumber: input.contractNumber,
      title: input.title,
      vendorId: input.vendorId,
      startDate: input.startDate,
      endDate: input.endDate,
      renewalDate: input.renewalDate,
      value: input.value,
      autoRenew: input.autoRenew,
      documentUrl: input.documentUrl,
      status: input.status,
    },
    include: {
      vendor: {
        select: { id: true, name: true },
      },
    },
  });

  await recordAuditLog(
    "Contract",
    contract.id,
    "Contract Updated",
    input.actor,
    {
      oldValue: {
        title: existing.title,
        status: existing.status,
        value: Number(existing.value),
      },
      newValue: {
        title: contract.title,
        status: contract.status,
        value: Number(contract.value),
      },
    }
  );

  const utilization =
    await calculateContractUtilization(id);

  return serializeContract(
    contract,
    utilization
  );
}

export { getContractExposureSummary };
