import prisma from "../db";

export type ProcurementAgentResult = {
  recommendation: string;
  riskScore: number;
  reasoning: string[];
  actions: string[];
};

export async function runProcurementAgent(
  documentId: number
): Promise<ProcurementAgentResult> {
  const document =
    await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        purchaseOrder: true,
        vendor: true,
        threeWayMatches: true,
      },
    });

  if (!document) {
    return {
      recommendation: "REVIEW",
      riskScore: 50,
      reasoning: ["Document not found"],
      actions: ["Manual review required"],
    };
  }

  const reasoning: string[] = [];
  const actions: string[] = [];
  let riskScore = 50;

  if (document.vendor) {
    const priorCount =
      document.vendor.invoiceCount;

    if (priorCount >= 5) {
      reasoning.push(
        `Vendor previously approved ${priorCount} times`
      );
      riskScore -= 15;
    }

    if (
      document.vendor.reliabilityScore >=
      70
    ) {
      reasoning.push(
        "Vendor reliability score is strong"
      );
      riskScore -= 10;
    }
  }

  if (
    document.totalAmount != null &&
    document.totalAmount <= 10000
  ) {
    reasoning.push(
      "Amount within normal range"
    );
    riskScore -= 10;
  }

  if (document.purchaseOrder) {
    reasoning.push(
      `PO matched: ${document.purchaseOrder.poNumber}`
    );
    riskScore -= 20;
    actions.push("Verify three-way match");
  } else {
    reasoning.push("No PO linked");
    riskScore += 20;
    actions.push("Link invoice to PO");
  }

  const match =
    document.threeWayMatches[0];

  if (match?.status === "MATCHED") {
    reasoning.push("Three-way match passed");
    riskScore -= 15;
    actions.push("Approve payment");
  } else if (
    match?.status === "PRICE_MISMATCH"
  ) {
    reasoning.push(
      `Price mismatch: variance ${match.variance?.toFixed(2)}`
    );
    riskScore += 25;
    actions.push("Review price variance");
  } else if (
    match?.status === "QUANTITY_MISMATCH"
  ) {
    reasoning.push(
      "Goods not yet received on PO"
    );
    riskScore += 15;
    actions.push("Confirm goods receipt");
  }

  riskScore = Math.max(
    0,
    Math.min(100, riskScore)
  );

  let recommendation = "REVIEW";

  if (riskScore <= 25) {
    recommendation = "APPROVE";
  } else if (riskScore >= 70) {
    recommendation = "REJECT";
  }

  if (actions.length === 0) {
    actions.push("Review invoice details");
  }

  return {
    recommendation,
    riskScore,
    reasoning,
    actions,
  };
}
