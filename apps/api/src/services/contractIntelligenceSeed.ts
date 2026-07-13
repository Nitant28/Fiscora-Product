/**
 * Backfill contract intelligence metadata on existing demo contracts.
 */
import prisma from "../db";

export async function enrichContractIntelligenceMetadata() {
  const contracts = await prisma.contract.findMany();

  for (const contract of contracts) {
    const title = contract.title.toLowerCase();
    const isDell = title.includes("dell");
    const isSoftware =
      title.includes("software") ||
      title.includes("support") ||
      title.includes("subscription");

    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        renewalNoticeDays:
          contract.renewalNoticeDays ?? (isDell ? 90 : 60),
        annualValue: contract.annualValue ?? contract.value,
        ownerDepartment:
          contract.ownerDepartment ??
          (isDell ? "IT" : isSoftware ? "Procurement" : "Operations"),
        contractCategory:
          contract.contractCategory ??
          (isSoftware ? "Software" : "Services"),
        autoRenew: contract.autoRenew || isDell,
      },
    });
  }
}
