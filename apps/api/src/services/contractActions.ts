/**
 * Domain: Contract Action Center — executable workflows from intelligence insights.
 */
import prisma from "../db";
import { recordAuditLog } from "../lib/audit";
import { notDeleted } from "../lib/softDelete";
import { notifyUsersByRoles } from "./notifications";
import { createRFQ } from "../modules/rfq/rfq.service";
import { getContractById, updateContract } from "./contracts";
import { calculateContractUtilization } from "./contractUtilization";

export const CONTRACT_ACTIONS = [
  "renew",
  "disable-renewal",
  "escalate",
  "notify-owner",
  "create-rfq",
  "review",
  "reduce-commitment",
  "terminate",
  "view-spend",
] as const;

export const VENDOR_CONTRACT_ACTIONS = [
  "find-alternatives",
  "create-rfq",
  "vendor-benchmark",
] as const;

export type ContractAction = (typeof CONTRACT_ACTIONS)[number];
export type VendorContractAction =
  (typeof VENDOR_CONTRACT_ACTIONS)[number];

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addYears(date: Date, years: number) {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

async function resolveCategoryId(
  contractCategory?: string | null
) {
  const preferred = contractCategory?.trim();

  if (preferred) {
    const match = await prisma.spendCategory.findFirst({
      where: {
        name: {
          contains: preferred,
          mode: "insensitive",
        },
      },
    });

    if (match) {
      return match.id;
    }
  }

  const fallback = await prisma.spendCategory.findFirst({
    orderBy: { id: "asc" },
  });

  if (!fallback) {
    throw new Error("No spend category configured");
  }

  return fallback.id;
}

async function createRfqForVendor(input: {
  vendorId: number;
  vendorName: string;
  title: string;
  description: string;
  createdById: number;
  contractCategory?: string | null;
}) {
  const categoryId = await resolveCategoryId(
    input.contractCategory
  );

  const rfq = await createRFQ({
    title: input.title,
    description: input.description,
    categoryId,
    createdById: input.createdById,
  });

  await recordAuditLog(
    "RFQ",
    rfq.id,
    "RFQ Created From Contract Action",
    "Contract Action Center",
    {
      newValue: {
        vendorId: input.vendorId,
        vendorName: input.vendorName,
        title: input.title,
      },
    }
  );

  return rfq;
}

export async function executeContractAction(
  contractId: number,
  action: ContractAction,
  actor: string,
  userId: number
) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, ...notDeleted },
    include: {
      vendor: { select: { id: true, name: true } },
    },
  });

  if (!contract) {
    throw new Error("Contract not found");
  }

  const intel = contract as typeof contract & {
    ownerDepartment?: string | null;
    contractCategory?: string | null;
  };

  switch (action) {
    case "renew": {
      const newEndDate = addYears(contract.endDate, 1);

      const updated = await updateContract(contractId, {
        endDate: newEndDate,
        renewalDate: new Date(),
        status: "ACTIVE",
        actor,
      });

      await recordAuditLog(
        "Contract",
        contractId,
        "Contract Renewed",
        actor,
        {
          newValue: {
            endDate: newEndDate.toISOString(),
            vendor: contract.vendor.name,
          },
        }
      );

      return {
        success: true,
        action,
        message: `Contract renewed through ${newEndDate.toLocaleDateString()}`,
        contract: updated,
      };
    }

    case "disable-renewal": {
      const updated = await updateContract(contractId, {
        autoRenew: false,
        actor,
      });

      await recordAuditLog(
        "Contract",
        contractId,
        "Auto-Renewal Disabled",
        actor,
        { newValue: { autoRenew: false } }
      );

      return {
        success: true,
        action,
        message: "Auto-renewal disabled — manual renewal required",
        contract: updated,
      };
    }

    case "escalate": {
      await notifyUsersByRoles(
        ["CFO", "ADMIN"],
        "Contract escalation",
        `${contract.title} (${contract.vendor.name}) requires executive attention — expires ${contract.endDate.toLocaleDateString()}.`
      );

      await recordAuditLog(
        "Contract",
        contractId,
        "Contract Escalated",
        actor,
        { newValue: { escalatedTo: "CFO" } }
      );

      return {
        success: true,
        action,
        message: "Escalated to CFO and Admin",
      };
    }

    case "notify-owner": {
      const owner =
        intel.ownerDepartment ?? "Procurement";

      await notifyUsersByRoles(
        ["PROCUREMENT", "ADMIN"],
        "Contract owner notification",
        `[${owner}] ${contract.title} with ${contract.vendor.name} needs review before ${contract.endDate.toLocaleDateString()}.`
      );

      await recordAuditLog(
        "Contract",
        contractId,
        "Contract Owner Notified",
        actor,
        { newValue: { ownerDepartment: owner } }
      );

      return {
        success: true,
        action,
        message: `Owner team (${owner}) notified`,
      };
    }

    case "create-rfq": {
      const rfq = await createRfqForVendor({
        vendorId: contract.vendorId,
        vendorName: contract.vendor.name,
        title: `RFQ — ${contract.title} renewal`,
        description: `Competitive sourcing for ${contract.vendor.name} contract ${contract.contractNumber}.`,
        createdById: userId,
        contractCategory: intel.contractCategory,
      });

      return {
        success: true,
        action,
        message: "RFQ draft created",
        rfqId: rfq.id,
        redirectUrl: `/rfqs/${rfq.id}`,
      };
    }

    case "review": {
      const utilization =
        await calculateContractUtilization(contractId);

      await recordAuditLog(
        "Contract",
        contractId,
        "Contract Review Started",
        actor,
        {
          newValue: {
            utilizationPercent:
              utilization.utilizationPercent,
            remaining: utilization.remaining,
          },
        }
      );

      return {
        success: true,
        action,
        message: "Review logged — open contract detail for full spend picture",
        redirectUrl: `/contracts/${contractId}`,
        utilization,
      };
    }

    case "reduce-commitment": {
      const currentValue = Number(contract.value);
      const reducedValue = Math.round(currentValue * 0.9);

      const updated = await updateContract(contractId, {
        value: reducedValue,
        actor,
      });

      await recordAuditLog(
        "Contract",
        contractId,
        "Contract Commitment Reduced",
        actor,
        {
          oldValue: { value: currentValue },
          newValue: { value: reducedValue },
        }
      );

      return {
        success: true,
        action,
        message: `Commitment reduced by 10% to ₹${reducedValue.toLocaleString("en-IN")}`,
        contract: updated,
      };
    }

    case "terminate": {
      const updated = await updateContract(contractId, {
        status: "TERMINATED",
        autoRenew: false,
        actor,
      });

      await recordAuditLog(
        "Contract",
        contractId,
        "Contract Terminated",
        actor,
        { newValue: { status: "TERMINATED" } }
      );

      return {
        success: true,
        action,
        message: "Contract marked as terminated",
        contract: updated,
      };
    }

    case "view-spend": {
      const detail = await getContractById(contractId);

      return {
        success: true,
        action,
        message: "Spend summary loaded",
        redirectUrl: `/contracts/${contractId}`,
        contract: detail,
      };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

export async function executeVendorContractAction(
  vendorId: number,
  action: VendorContractAction,
  actor: string,
  userId: number
) {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, ...notDeleted },
    select: { id: true, name: true, totalSpend: true },
  });

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  const activeContract = await prisma.contract.findFirst({
    where: {
      vendorId,
      ...notDeleted,
      status: "ACTIVE",
    },
    orderBy: { value: "desc" },
  });

  switch (action) {
    case "find-alternatives": {
      const alternatives = await prisma.vendor.findMany({
        where: {
          ...notDeleted,
          id: { not: vendorId },
          status: "ACTIVE",
        },
        orderBy: { totalSpend: "desc" },
        take: 5,
        select: { id: true, name: true, totalSpend: true },
      });

      await recordAuditLog(
        "Vendor",
        vendorId,
        "Alternative Vendors Suggested",
        actor,
        {
          newValue: {
            alternatives: alternatives.map((v) => v.name),
          },
        }
      );

      return {
        success: true,
        action,
        message: `${alternatives.length} alternative vendors identified`,
        alternatives,
      };
    }

    case "create-rfq": {
      const rfq = await createRfqForVendor({
        vendorId: vendor.id,
        vendorName: vendor.name,
        title: `RFQ — reduce ${vendor.name} dependency`,
        description: `Competitive RFQ to mitigate concentration risk with ${vendor.name}.`,
        createdById: userId,
        contractCategory: activeContract
          ? (activeContract as { contractCategory?: string | null })
              .contractCategory
          : null,
      });

      return {
        success: true,
        action,
        message: "Competitive RFQ created",
        rfqId: rfq.id,
        redirectUrl: `/rfqs/${rfq.id}`,
      };
    }

    case "vendor-benchmark": {
      const peerSpend = await prisma.vendor.aggregate({
        where: { ...notDeleted, status: "ACTIVE" },
        _avg: { totalSpend: true },
      });

      const benchmark = {
        vendorName: vendor.name,
        vendorSpend: vendor.totalSpend ?? 0,
        peerAverageSpend:
          peerSpend._avg.totalSpend ?? 0,
        activeContracts: await prisma.contract.count({
          where: {
            vendorId,
            ...notDeleted,
            status: "ACTIVE",
          },
        }),
        recommendation:
          (vendor.totalSpend ?? 0) >
          (peerSpend._avg.totalSpend ?? 0) * 1.5
            ? "Run competitive benchmark within 30 days"
            : "Spend within peer range — monitor quarterly",
      };

      await recordAuditLog(
        "Vendor",
        vendorId,
        "Vendor Benchmark Generated",
        actor,
        { newValue: benchmark }
      );

      return {
        success: true,
        action,
        message: "Vendor benchmark ready",
        benchmark,
      };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
