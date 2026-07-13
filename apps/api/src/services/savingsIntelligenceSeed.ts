/**
 * Seeds demo savings events for CFO ROI storytelling.
 */
import prisma from "../db";

export async function seedSavingsIntelligenceDemo() {
  const [{ count }] = await prisma.$queryRaw<
    [{ count: bigint }]
  >`SELECT COUNT(*)::bigint AS count FROM "SavingsEvent"`;

  if (Number(count) >= 10) {
    return;
  }

  const [dell, tata, infosys, production, finance] =
    await Promise.all([
      prisma.vendor.findFirst({ where: { name: "Dell" } }),
      prisma.vendor.findFirst({
        where: { name: "Tata Steel Supply" },
      }),
      prisma.vendor.findFirst({ where: { name: "Infosys" } }),
      prisma.department.findFirst({
        where: { name: { contains: "Production" } },
      }),
      prisma.department.findFirst({
        where: { name: { contains: "Finance" } },
      }),
    ]);

  const events = [
    {
      type: "RFQ_SAVINGS",
      amount: 1200000,
      title: "Dell Server Procurement",
      description: "Competitive RFQ — highest quote minus award",
      vendorId: dell?.id ?? null,
      departmentId: production?.id ?? null,
    },
    {
      type: "NEGOTIATION_SAVINGS",
      amount: 800000,
      title: "Steel Contract Renegotiation",
      description: "Initial quote reduced after negotiation",
      vendorId: tata?.id ?? null,
      departmentId: production?.id ?? null,
    },
    {
      type: "CONTRACT_SAVINGS",
      amount: 550000,
      title: "Software License Renewal",
      description: "Contract budget vs actual spend",
      vendorId: infosys?.id ?? null,
      departmentId: finance?.id ?? null,
    },
    {
      type: "BUDGET_AVOIDANCE",
      amount: 340000,
      title: "Split purchase blocked",
      description: "Budget threshold enforcement",
      vendorId: null,
      departmentId: production?.id ?? null,
    },
    {
      type: "VENDOR_CONSOLIDATION",
      amount: 530000,
      title: "Vendor consolidation program",
      description: "Reduced duplicate suppliers",
      vendorId: null,
      departmentId: finance?.id ?? null,
    },
    {
      type: "FRAUD_PREVENTED",
      amount: 800000,
      title: "Duplicate invoice prevented",
      description: "Fraud detection before payment",
      vendorId: tata?.id ?? null,
      departmentId: null,
    },
    {
      type: "RFQ_SAVINGS",
      amount: 950000,
      title: "IT hardware RFQ",
      vendorId: dell?.id ?? null,
      departmentId: production?.id ?? null,
    },
    {
      type: "CONTRACT_SAVINGS",
      amount: 610000,
      title: "Annual support contract optimization",
      vendorId: infosys?.id ?? null,
      departmentId: null,
    },
    {
      type: "NEGOTIATION_SAVINGS",
      amount: 425000,
      title: "Logistics rate negotiation",
      vendorId: null,
      departmentId: finance?.id ?? null,
    },
    {
      type: "BUDGET_AVOIDANCE",
      amount: 220000,
      title: "Off-catalog spend redirected",
      vendorId: null,
      departmentId: production?.id ?? null,
    },
  ];

  for (const event of events) {
    const existing = await prisma.$queryRaw<
      { id: number }[]
    >`
      SELECT id FROM "SavingsEvent"
      WHERE title = ${event.title}
      LIMIT 1
    `;

    if (existing.length > 0) {
      continue;
    }

    await prisma.$executeRaw`
      INSERT INTO "SavingsEvent" (
        type, amount, title, description,
        "vendorId", "departmentId", currency
      ) VALUES (
        ${event.type}::"SavingsEventType",
        ${event.amount},
        ${event.title},
        ${event.description ?? null},
        ${event.vendorId},
        ${event.departmentId},
        'INR'
      )
    `;
  }
}
