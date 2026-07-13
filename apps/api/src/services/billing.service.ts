/**
 * Billing Foundation (Sprint 19) — commercial layer without payment gateway.
 *
 * Plans, subscriptions, feature gating, and usage metering. Razorpay hooks in
 * Sprint 20; this sprint makes every tenant billable and every feature gateable.
 */
import type { SubscriptionStatus } from "@prisma/client";
import { prismaRaw } from "../db";
import { recordAuditLog } from "../lib/audit";
import { getTenantId } from "../lib/tenantContext";

const TRIAL_DAYS = 14;

/** Feature keys used for plan gating (Sprint 20+ routes check these). */
export const BILLING_FEATURES = {
  VENDOR_PORTAL: "vendor_portal",
  API_ACCESS: "api_access",
  ADVANCED_ANALYTICS: "advanced_analytics",
  WORKFLOW_BUILDER: "workflow_builder",
  AUDIT_EXPORT: "audit_export",
  AI_INTELLIGENCE: "ai_intelligence",
} as const;

export type BillingFeatureKey =
  (typeof BILLING_FEATURES)[keyof typeof BILLING_FEATURES];

const PLAN_CATALOG: {
  slug: string;
  name: string;
  description: string;
  priceMonthly: number;
  seatLimit: number | null;
  sortOrder: number;
  features: { key: string; name: string; enabled: boolean }[];
}[] = [
  {
    slug: "starter",
    name: "Starter",
    description: "Core procurement for small teams",
    priceMonthly: 799900,
    seatLimit: 10,
    sortOrder: 1,
    features: [
      { key: "core_procurement", name: "Core procurement", enabled: true },
      { key: "basic_analytics", name: "Basic analytics", enabled: true },
    ],
  },
  {
    slug: "growth",
    name: "Growth",
    description: "Scale procurement with integrations",
    priceMonthly: 2499900,
    seatLimit: 100,
    sortOrder: 2,
    features: [
      { key: "core_procurement", name: "Core procurement", enabled: true },
      { key: "basic_analytics", name: "Basic analytics", enabled: true },
      {
        key: BILLING_FEATURES.ADVANCED_ANALYTICS,
        name: "Advanced analytics",
        enabled: true,
      },
      {
        key: BILLING_FEATURES.VENDOR_PORTAL,
        name: "Vendor portal",
        enabled: true,
      },
      { key: BILLING_FEATURES.API_ACCESS, name: "API access", enabled: true },
    ],
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    description: "Full platform with workflow builder and compliance",
    priceMonthly: 0,
    seatLimit: null,
    sortOrder: 3,
    features: [
      { key: "core_procurement", name: "Core procurement", enabled: true },
      { key: "basic_analytics", name: "Basic analytics", enabled: true },
      {
        key: BILLING_FEATURES.ADVANCED_ANALYTICS,
        name: "Advanced analytics",
        enabled: true,
      },
      {
        key: BILLING_FEATURES.VENDOR_PORTAL,
        name: "Vendor portal",
        enabled: true,
      },
      { key: BILLING_FEATURES.API_ACCESS, name: "API access", enabled: true },
      {
        key: BILLING_FEATURES.WORKFLOW_BUILDER,
        name: "Workflow builder",
        enabled: true,
      },
      {
        key: BILLING_FEATURES.AUDIT_EXPORT,
        name: "Audit export",
        enabled: true,
      },
      {
        key: BILLING_FEATURES.AI_INTELLIGENCE,
        name: "AI intelligence",
        enabled: true,
      },
    ],
  },
];

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatInr(paisa: number) {
  if (paisa === 0) return "Custom";
  return `₹${(paisa / 100).toLocaleString("en-IN")}`;
}

/* --- SEED --- */

export async function seedBillingCatalog() {
  for (const planDef of PLAN_CATALOG) {
    const plan = await prismaRaw.plan.upsert({
      where: { slug: planDef.slug },
      create: {
        slug: planDef.slug,
        name: planDef.name,
        description: planDef.description,
        priceMonthly: planDef.priceMonthly,
        seatLimit: planDef.seatLimit,
        sortOrder: planDef.sortOrder,
      },
      update: {
        name: planDef.name,
        description: planDef.description,
        priceMonthly: planDef.priceMonthly,
        seatLimit: planDef.seatLimit,
        sortOrder: planDef.sortOrder,
      },
    });

    for (const feat of planDef.features) {
      const feature = await prismaRaw.feature.upsert({
        where: { key: feat.key },
        create: {
          key: feat.key,
          name: feat.name,
          description: feat.name,
        },
        update: { name: feat.name },
      });

      await prismaRaw.planFeature.upsert({
        where: {
          planId_featureId: {
            planId: plan.id,
            featureId: feature.id,
          },
        },
        create: {
          planId: plan.id,
          featureId: feature.id,
          enabled: feat.enabled,
        },
        update: { enabled: feat.enabled },
      });
    }
  }
}

/** Ensures every tenant has a subscription (trial on Starter by default). */
export async function ensureTenantSubscription(tenantId: number) {
  const existing = await prismaRaw.subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });
  if (existing) return existing;

  let plan = await prismaRaw.plan.findUnique({
    where: { slug: "starter" },
  });
  if (!plan) {
    await seedBillingCatalog();
    plan = await prismaRaw.plan.findUnique({
      where: { slug: "starter" },
    });
  }
  if (!plan) throw new Error("Starter plan missing — run seedBillingCatalog");

  const now = new Date();
  return prismaRaw.subscription.create({
    data: {
      tenantId,
      planId: plan.id,
      status: "TRIAL",
      trialEndsAt: addDays(now, TRIAL_DAYS),
      currentPeriodStart: now,
      currentPeriodEnd: addDays(now, TRIAL_DAYS),
    },
    include: { plan: true },
  });
}

/* --- READ --- */

export async function listPlans() {
  const plans = await prismaRaw.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      features: {
        include: { feature: true },
        where: { enabled: true },
      },
    },
  });

  return plans.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    priceMonthly: p.priceMonthly,
    priceLabel: formatInr(p.priceMonthly),
    seatLimit: p.seatLimit,
    features: p.features.map((pf) => ({
      key: pf.feature.key,
      name: pf.feature.name,
    })),
  }));
}

async function countActiveSeats(tenantId: number) {
  return prismaRaw.user.count({
    where: {
      tenantId,
      status: { in: ["ACTIVE", "INVITED"] },
    },
  });
}

export async function getSubscriptionSummary(tenantId: number) {
  const sub = await ensureTenantSubscription(tenantId);
  const full = await prismaRaw.subscription.findUnique({
    where: { id: sub.id },
    include: {
      plan: {
        include: {
          features: {
            where: { enabled: true },
            include: { feature: true },
          },
        },
      },
    },
  });
  if (!full) throw new Error("Subscription not found");

  const seatsUsed = await countActiveSeats(tenantId);
  const seatLimit =
    full.seatLimitOverride ?? full.plan.seatLimit;

  const now = new Date();
  const trialExpired =
    full.status === "TRIAL" &&
    full.trialEndsAt != null &&
    full.trialEndsAt < now;

  return {
    id: full.id,
    status: full.status,
    trialEndsAt: full.trialEndsAt,
    trialExpired,
    currentPeriodStart: full.currentPeriodStart,
    currentPeriodEnd: full.currentPeriodEnd,
    plan: {
      slug: full.plan.slug,
      name: full.plan.name,
      priceMonthly: full.plan.priceMonthly,
      priceLabel: formatInr(full.plan.priceMonthly),
      seatLimit,
    },
    usage: {
      seatsUsed,
      seatLimit,
      seatsRemaining:
        seatLimit != null
          ? Math.max(0, seatLimit - seatsUsed)
          : null,
      atSeatLimit: seatLimit != null && seatsUsed >= seatLimit,
    },
    features: full.plan.features.map((pf) => pf.feature.key),
  };
}

export async function listBillingInvoices(tenantId: number) {
  return prismaRaw.billingInvoice.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 24,
  });
}

/* --- FEATURE GATING --- */

export async function isFeatureEnabled(
  tenantId: number,
  featureKey: BillingFeatureKey | string
): Promise<boolean> {
  const sub = await ensureTenantSubscription(tenantId);
  const mapping = await prismaRaw.planFeature.findFirst({
    where: {
      planId: sub.planId,
      enabled: true,
      feature: { key: featureKey },
    },
  });
  return Boolean(mapping);
}

export async function getEnabledFeatures(tenantId: number) {
  const sub = await ensureTenantSubscription(tenantId);
  const rows = await prismaRaw.planFeature.findMany({
    where: { planId: sub.planId, enabled: true },
    include: { feature: true },
  });
  return rows.map((r) => r.feature.key);
}

/* --- WRITE (no payment — plan changes for admin/testing) --- */

export async function changePlan(
  tenantId: number,
  planSlug: string,
  actor: { id: number; name: string }
) {
  const plan = await prismaRaw.plan.findUnique({
    where: { slug: planSlug },
  });
  if (!plan || !plan.isActive) {
    throw new Error("Plan not found");
  }

  const sub = await ensureTenantSubscription(tenantId);
  const previousPlan = sub.plan?.slug ?? "unknown";

  const now = new Date();
  const updated = await prismaRaw.subscription.update({
    where: { id: sub.id },
    data: {
      planId: plan.id,
      status: plan.slug === "starter" ? sub.status : "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: addDays(now, 30),
    },
    include: { plan: true },
  });

  await recordAuditLog("Subscription", updated.id, "PLAN_CHANGED", actor.name, {
    actorContext: { userId: actor.id },
    metadata: {
      from: previousPlan,
      to: planSlug,
      tenantId,
    },
  }).catch(() => {});

  return getSubscriptionSummary(tenantId);
}

export async function activateTrialAsActive(tenantId: number) {
  const sub = await ensureTenantSubscription(tenantId);
  if (sub.status !== "TRIAL") return sub;

  const now = new Date();
  return prismaRaw.subscription.update({
    where: { id: sub.id },
    data: {
      status: "ACTIVE" as SubscriptionStatus,
      currentPeriodEnd: addDays(now, 30),
    },
  });
}
