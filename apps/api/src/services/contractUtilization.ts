/**
 * Domain: Contract spend — PO utilization against contract value and portfolio exposure.
 * Main exports: calculateContractUtilization, getContractExposureSummary.
 * Called by: contracts.ts, executiveAnalytics.ts; scripts/verify-contract-utilization.ts, verify-dashboard-data-quality.ts.
 */
import prisma from "../db";

export type ContractUtilization = {
  contractValue: number;
  utilized: number;
  remaining: number;
  utilizationPercent: number;
};

export async function calculateContractUtilization(
  contractId: number
): Promise<ContractUtilization> {
  const contract =
    await prisma.contract.findUnique({
      where: { id: contractId },
      select: { value: true },
    });

  if (!contract) {
    throw new Error("Contract not found");
  }

  const purchaseOrders =
    await prisma.purchaseOrder.findMany({
      where: { contractId },
      select: { amount: true },
    });

  const contractValue = Number(contract.value);
  const utilized = purchaseOrders.reduce(
    (sum, po) => sum + po.amount,
    0
  );
  const remaining = Math.max(
    contractValue - utilized,
    0
  );
  const utilizationPercent =
    contractValue > 0
      ? Math.round(
          (utilized / contractValue) * 1000
        ) / 10
      : 0;

  return {
    contractValue,
    utilized,
    remaining,
    utilizationPercent,
  };
}

/* --- PORTFOLIO SUMMARY --- */

export async function getContractExposureSummary() {
  const now = new Date();

  const activeContracts =
    await prisma.contract.findMany({
      where: {
        status: {
          notIn: ["TERMINATED", "EXPIRED"],
        },
        endDate: { gte: now },
      },
      select: { id: true },
    });

  let totalValue = 0;
  let utilized = 0;

  for (const contract of activeContracts) {
    const utilization =
      await calculateContractUtilization(
        contract.id
      );
    totalValue += utilization.contractValue;
    utilized += utilization.utilized;
  }

  return {
    activeContracts: activeContracts.length,
    totalValue,
    utilized,
    remaining: Math.max(
      totalValue - utilized,
      0
    ),
  };
}
