/**
 * Prisma client extension — auto-scopes reads/writes to the active tenant.
 */
import type { PrismaClient } from "@prisma/client";
import { getTenantId } from "./tenantContext";

const TENANT_MODELS = new Set([
  "User",
  "Vendor",
  "PurchaseRequest",
  "PurchaseOrder",
  "Document",
  "Department",
  "AuditLog",
  "Contract",
  "Payment",
  "RFQ",
  "ImportJob",
  "Notification",
  "AccessRequest",
  "Subscription",
  "UsageRecord",
  "BillingInvoice",
  "ApiKey",
]);

function modelKey(model: string) {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

function withTenantWhere(
  model: string,
  where: Record<string, unknown> | undefined
) {
  if (!TENANT_MODELS.has(model)) {
    return where;
  }

  return { ...where, tenantId: getTenantId() };
}

function withTenantData(model: string, data: Record<string, unknown>) {
  if (!TENANT_MODELS.has(model)) {
    return data;
  }

  return { ...data, tenantId: getTenantId() };
}

function normalizeUpsertWhere(
  model: string,
  where: Record<string, unknown> | undefined
) {
  if (!TENANT_MODELS.has(model) || !where) {
    return where;
  }

  const tenantId = getTenantId();

  if (
    where.tenantId_name ||
    where.tenantId_email ||
    where.tenantId_poNumber ||
    where.tenantId_contractNumber ||
    where.tenantId_invoiceNumber ||
    where.tenantId_paymentNumber ||
    where.id
  ) {
    return withTenantWhere(model, where);
  }

  if (typeof where.name === "string") {
    return { tenantId_name: { tenantId, name: where.name } };
  }

  if (typeof where.email === "string") {
    return { tenantId_email: { tenantId, email: where.email } };
  }

  if (typeof where.poNumber === "string") {
    return { tenantId_poNumber: { tenantId, poNumber: where.poNumber } };
  }

  if (typeof where.contractNumber === "string") {
    return {
      tenantId_contractNumber: { tenantId, contractNumber: where.contractNumber },
    };
  }

  if (typeof where.invoiceNumber === "string") {
    return {
      tenantId_invoiceNumber: { tenantId, invoiceNumber: where.invoiceNumber },
    };
  }

  return withTenantWhere(model, where);
}

type QueryArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
  select?: unknown;
  include?: unknown;
  orderBy?: unknown;
  take?: number;
  skip?: number;
};

export function extendWithTenant(base: PrismaClient) {
  const delegate = base as unknown as Record<
    string,
    { findFirst: (args: QueryArgs) => Promise<unknown> }
  >;

  return base.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          const next = {
            ...args,
            where: withTenantWhere(model, args.where as Record<string, unknown>),
          };
          return query(next);
        },

        async findFirst({ model, args, query }) {
          const next = {
            ...args,
            where: withTenantWhere(model, args.where as Record<string, unknown>),
          };
          return query(next);
        },

        async findFirstOrThrow({ model, args, query }) {
          const next = {
            ...args,
            where: withTenantWhere(model, args.where as Record<string, unknown>),
          };
          return query(next);
        },

        async findUnique({ model, args }) {
          if (!TENANT_MODELS.has(model)) {
            return (base as unknown as Record<string, { findUnique: (a: QueryArgs) => Promise<unknown> }>)[
              modelKey(model)
            ].findUnique(args);
          }

          return delegate[modelKey(model)].findFirst({
            where: withTenantWhere(model, args.where as Record<string, unknown>),
            select: args.select,
            include: args.include,
          });
        },

        async findUniqueOrThrow({ model, args }) {
          if (!TENANT_MODELS.has(model)) {
            return (base as unknown as Record<string, { findUniqueOrThrow: (a: QueryArgs) => Promise<unknown> }>)[
              modelKey(model)
            ].findUniqueOrThrow(args);
          }

          const row = await delegate[modelKey(model)].findFirst({
            where: withTenantWhere(model, args.where as Record<string, unknown>),
            select: args.select,
            include: args.include,
          });

          if (!row) {
            throw new Error(`No ${model} found`);
          }

          return row;
        },

        async count({ model, args, query }) {
          const next = {
            ...args,
            where: withTenantWhere(model, args.where as Record<string, unknown>),
          };
          return query(next);
        },

        async aggregate({ model, args, query }) {
          const next = {
            ...args,
            where: withTenantWhere(model, args.where as Record<string, unknown>),
          };
          return query(next);
        },

        async groupBy({ model, args, query }) {
          const next = {
            ...args,
            where: withTenantWhere(model, args.where as Record<string, unknown>),
          };
          return query(next);
        },

        async update({ model, args, query }) {
          const next = {
            ...args,
            where: withTenantWhere(model, args.where as Record<string, unknown>),
          };
          return query(next);
        },

        async updateMany({ model, args, query }) {
          const next = {
            ...args,
            where: withTenantWhere(model, args.where as Record<string, unknown>),
          };
          return query(next);
        },

        async delete({ model, args, query }) {
          const next = {
            ...args,
            where: withTenantWhere(model, args.where as Record<string, unknown>),
          };
          return query(next);
        },

        async deleteMany({ model, args, query }) {
          const next = {
            ...args,
            where: withTenantWhere(model, args.where as Record<string, unknown>),
          };
          return query(next);
        },

        async create({ model, args, query }) {
          const tenantId = getTenantId();
          const data = args.data as Record<string, unknown>;
          const next = {
            ...args,
            data: TENANT_MODELS.has(model) ? { ...data, tenantId } : data,
          };
          return query(next);
        },

        async createMany({ model, args, query }) {
          const tenantId = getTenantId();
          const rows = args.data as Record<string, unknown>[];
          const next = {
            ...args,
            data: TENANT_MODELS.has(model)
              ? rows.map((row) => ({ ...row, tenantId }))
              : rows,
          };
          return query(next);
        },

        async upsert({ model, args, query }) {
          const next = {
            ...args,
            where: normalizeUpsertWhere(model, args.where as Record<string, unknown>),
            create: withTenantData(model, args.create as Record<string, unknown>),
          };
          return query(next);
        },
      },
    },
  });
}

export type TenantPrismaClient = ReturnType<typeof extendWithTenant>;
