/**
 * Fiscora API — Main Fastify server entry point.
 *
 * Bootstraps the HTTP API: CORS, multipart uploads, static files, and modular
 * route plugins (auth, PO, PR, RFQ, payments, etc.). Inline handlers below
 * cover invoice upload/list/detail, document actions, analytics, approvals,
 * notifications, control tower, vendors, and audit logs. Listens on port 4000
 * after enterprise seeds and SLA engine startup.
 */

import fastifyStatic from "@fastify/static";
import cors from "@fastify/cors";
import { invoiceQueue } from "./queue";
import Fastify, {
  FastifyRequest,
  FastifyReply,
} from "fastify";
import type {
  CategoryAnalyticsResponse,
  ExecutiveAnalyticsResponse,
  RiskQueueResponse,
  VendorSpendResponse,
} from "./types/analytics";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import prisma from "./db";
import { setRequestContext, formatRequestId, setRequestUserId } from "./lib/requestContext";
import { setTenantId } from "./lib/tenantContext";
import { trackError } from "./services/errorTracking";
import {
  getHealthStatus,
  getReadyStatus,
  getVersionInfo,
} from "./services/opsHealth";
import { notDeleted } from "./lib/softDelete";
import {
  computeDocumentItemIntelligence,
} from "./procurement/itemIntelligence";
import { calculateCategoryAnalytics } from "./services/categoryAnalytics";
import {
  calculateExecutiveAnalytics,
  calculateVendorSpend,
} from "./services/executiveAnalytics";
import { purchaseOrderRoutes } from "./modules/purchase-orders/purchase-order.routes";
import { purchaseRequestRoutes } from "./modules/purchase-requests/purchase-request.routes";
import {
  matchInvoice,
} from "./modules/purchase-orders/purchase-order.service";
import { runProcurementAgent } from "./agents/procurement-agent";
import { departmentRoutes } from "./modules/departments/department.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { vendorOnboardingRoutes } from "./modules/vendor-onboarding/vendor-onboarding.routes";
import { contractRoutes } from "./modules/contracts/contract.routes";
import { contractStaticRoutes } from "./modules/contracts/contract-static.routes";
import { savingsRoutes } from "./modules/savings/savings.routes";
import { roiRoutes } from "./modules/roi/roi.routes";
import { catalogRoutes } from "./modules/catalog/catalog.routes";
import { rfqRoutes } from "./modules/rfq/rfq.routes";
import { paymentRoutes } from "./modules/payments/payment.routes";
import { analyticsRoutes } from "./modules/analytics/analytics.routes";
import { getApprovalInboxForUser } from "./services/approvalInbox";
import {
  getUnreadCount,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "./services/notifications";
import { startSlaEngine } from "./services/slaEngine";
import { startIdentityJobs } from "./services/identityService";
import { requireAuth, requirePermission } from "./lib/authMiddleware";
import { hasPermission } from "./lib/auth";
import { PERMISSION_KEYS } from "./lib/permissions";
import { getControlTowerData } from "./services/controlTower";
import {
  listVendors,
  getVendor360,
  updateVendorPaymentTerms,
} from "./services/vendorDirectory";
import { listSpendCategories } from "./services/spendCategories";
import {
  auditContextFromRequest,
  listAuditLogs,
  recordAuditLog,
  resolveApprover,
} from "./lib/audit";
import {
  queryAuditLogs,
  exportAuditLogsCsv,
  getAuditFilterOptions,
  type AuditQueryFilters,
} from "./services/auditExplorer";
import { runEnterpriseSeeds } from "./lib/seed";
import { notifyInvoiceApproved } from "./services/notificationService";
import { recordBudgetSpend } from "./services/budgetEngine";
import { schedulePaymentIfMatched, computePaymentDueDate } from "./services/paymentEngine";
import { getThreeWayMatchForInvoice } from "./services/threeWayMatch";
import {
  documentHasDuplicateRisk,
  getDuplicateMatchForDocument,
} from "./services/fraudDetection";
import auditRoutes
from "./routes/audit.routes";
import { vendorPortalRoutes } from "./modules/vendor-portal/vendor-portal.routes";
import { complianceRoutes } from "./modules/compliance/compliance.routes";
import { emailApprovalRoutes } from "./modules/email-approvals/email-approval.routes";
import { tallyRoutes } from "./integrations/tally/tally.routes";
import { adminRoutes } from "./modules/admin/admin.routes";
import { userRoutes } from "./modules/users/user.routes";
import { accessRequestRoutes } from "./modules/access-requests/access-request.routes";
import { billingRoutes } from "./modules/billing/billing.routes";
import { importRoutes } from "./modules/import/import.routes";
import { onboardingRoutes } from "./modules/onboarding/onboarding.routes";
import { searchRoutes } from "./modules/search/search.routes";
import { apiKeyRoutes } from "./modules/api-keys/api-key.routes";
import { copilotRoutes } from "./modules/copilot/copilot.routes";
import { getEnterpriseDemoSummary } from "./lib/seed/enterpriseDemo";


const app = Fastify({
  logger: true,
});

app.addHook("onRequest", async (request, reply) => {
  const headerId = request.headers["x-request-id"];
  const rawId =
    typeof headerId === "string" && headerId
      ? headerId
      : crypto.randomUUID();
  const requestId = formatRequestId(rawId);

  const forwardedFor = request.headers["x-forwarded-for"];
  const clientIp =
    (typeof forwardedFor === "string"
      ? forwardedFor.split(",")[0]?.trim()
      : Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : undefined) ?? request.ip;
  const userAgent = request.headers["user-agent"];

  setRequestContext({
    requestId,
    route: request.url,
    method: request.method,
    ip: clientIp,
    userAgent:
      typeof userAgent === "string"
        ? userAgent
        : undefined,
  });
  setTenantId(1);
  reply.header("X-Request-ID", requestId);
  request.log = request.log.child({ requestId });
});

app.setErrorHandler(async (error, request, reply) => {
  await trackError({
    error,
    route: request.url,
    method: request.method,
    userId: request.user?.id,
  });

  const requestId = reply.getHeader("X-Request-ID");
  const statusCode =
    typeof (error as { statusCode?: number }).statusCode ===
    "number"
      ? (error as { statusCode: number }).statusCode
      : 500;
  const message =
    error instanceof Error
      ? error.message
      : "Internal server error";

  if (!reply.sent) {
    reply.status(statusCode).send({
      success: false,
      error: message,
      requestId: requestId ?? undefined,
    });
  }
});

app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

const VALID_STATUSES = [
  "queued",
  "processing",
  "processed",
  "approved",
  "rejected",
  "paid",
  "failed",
  "in_review",
  "escalated",
  "clarification_requested",
  "blocked",
];

const ACTION_STATUSES: Record<string, string> = {
  APPROVE: "approved",
  REJECT: "rejected",
  MARK_PAID: "paid",
};

app.register(cors, {
  origin: "*",
  methods: [
    "GET",
    "POST",
    "PATCH",
    "PUT",
    "DELETE",
    "OPTIONS",
  ],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Request-ID",
  ],
});

app.register(multipart);

app.register(purchaseOrderRoutes);
app.register(purchaseRequestRoutes);
app.register(departmentRoutes);
app.register(authRoutes);
app.register(vendorOnboardingRoutes);
app.register(contractStaticRoutes);
app.register(savingsRoutes);
app.register(roiRoutes);
app.register(contractRoutes);
app.register(catalogRoutes);
app.register(rfqRoutes);
app.register(paymentRoutes);
app.register(analyticsRoutes);

app.register(fastifyStatic, {
  root: path.join(
    process.cwd(),
    "uploads"
  ),
  prefix: "/files/",
});

app.register(auditRoutes);
app.register(vendorPortalRoutes);
app.register(complianceRoutes);
app.register(emailApprovalRoutes);
app.register(tallyRoutes);
app.register(adminRoutes);
app.register(userRoutes);
app.register(accessRequestRoutes);
app.register(billingRoutes);
app.register(importRoutes);
app.register(onboardingRoutes);
app.register(searchRoutes);
app.register(apiKeyRoutes);
app.register(copilotRoutes);

app.get("/health", async () => getHealthStatus());

app.get("/ready", async (_request, reply) => {
  const status = await getReadyStatus();

  if (!status.ready) {
    return reply.status(503).send(status);
  }

  return status;
});

app.get("/version", async () => getVersionInfo());

app.get("/demo/summary", async () => getEnterpriseDemoSummary());

/*
|--------------------------------------------------------------------------
| Health
| GET / — API liveness and identity
|--------------------------------------------------------------------------
*/

app.get("/", async () => {
  return {
    status: "Fiscora API Running",
  };
});

/*
|--------------------------------------------------------------------------
| Upload
| POST /upload — queue invoice PDF/image for extraction (INVOICE_UPLOAD)
|--------------------------------------------------------------------------
*/

app.post(
  "/upload",
  { preHandler: requirePermission(PERMISSION_KEYS.INVOICE_UPLOAD) },
  async (request, reply) => {
  try {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({
        success: false,
        error: "No file uploaded",
      });
    }

    const allowedMimeTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
    ];

    if (
      !allowedMimeTypes.includes(
        data.mimetype
      )
    ) {
      return reply.status(400).send({
        success: false,
        error:"Supported formats: PDF, PNG, JPG, JPEG",
      });
    }

    const uploadDir = path.join(
      process.cwd(),
      "uploads"
    );

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, {
        recursive: true,
      });
    }

    const buffer =
      await data.toBuffer();

    if (
      buffer.length >
      10 * 1024 * 1024
    ) {
      return reply.status(400).send({
        success: false,
        error:
          "File exceeds 10MB limit",
      });
    }

    const timestamp =
      Date.now();

    const sanitizedFilename =
      data.filename.replace(
        /\s+/g,
        "_"
      );

    const fileName =
      `${timestamp}-${sanitizedFilename}`;

    const filePath =
      path.join(
        uploadDir,
        fileName
      );

    await fs.promises.writeFile(
      filePath,
      buffer
    );

    const document =
      await prisma.document.create({
        data: {
          fileName,
          fileUrl: fileName,
          status: "queued",
        },
      });

    let queued = true;
    try {
      await invoiceQueue.add(
        "process-invoice",
        {
          documentId: document.id,
          filePath,
          fileName,
          fileUrl: fileName,
        }
      );
    } catch (queueError) {
      // Redis/worker unavailable: persist the upload and mark it pending so a
      // later requeue can pick it up. Do not fail the user's upload.
      queued = false;
      console.warn(
        "[upload] Failed to enqueue invoice job; marking pending.",
        queueError instanceof Error
          ? queueError.message
          : queueError
      );
      await prisma.document.update({
        where: { id: document.id },
        data: { status: "pending_processing" },
      });
    }

    await recordAuditLog(
      "Document",
      document.id,
      "Invoice Uploaded",
      "System",
      { newValue: { fileName, queued } }
    );

    return reply.status(201).send({
      success: true,
      message: queued
        ? "File uploaded and queued successfully"
        : "File uploaded. Processing is pending (queue unavailable).",
      document,
    });

  } catch (error) {
    console.error(error);

    return reply.status(500).send({
      success: false,
      error:
        "Internal server error",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Documents — list & detail
| GET /documents — filterable list; GET /documents/:id — full detail with
| intelligence, PO/three-way match, procurement agent, and duplicate risk
|--------------------------------------------------------------------------
*/

app.get(
  "/documents",
  { preHandler: requirePermission(PERMISSION_KEYS.INVOICE_VIEW) },
  async (request, reply) => {
  try {
    const { status, search } =
      request.query as {
        status?: string;
        search?: string;
      };

    const documents =
      await prisma.document.findMany({
        where: {
          ...notDeleted,
          ...(status
            ? {
                status:
                  status as any,
              }
            : {}),

          ...(search
            ? {
                OR: [
                  {
                    vendorName: {
                      contains:
                        search,
                    },
                  },
                  {
                    invoiceNumber: {
                      contains:
                        search,
                    },
                  },
                ],
              }
            : {}),
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return reply.send({
      success: true,
      documents,
    });

  } catch (error) {
    console.error(error);

    return reply.status(500).send({
      success: false,
      error:
        "Failed to fetch documents",
    });
  }
});

app.get(
  "/documents/:id",
  { preHandler: requirePermission(PERMISSION_KEYS.INVOICE_VIEW) },
  async (request, reply) => {
    try {
      const { id } =
        request.params as {
          id: string;
        };

      const document =
        await prisma.document.findUnique({
          where: {
            id: Number(id),
          },

          include: {
            flags: true,
            vendor: true,
            lineItems: true,
            purchaseOrder: true,
            approvalHistory: {
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        });

      if (!document) {
        return reply.status(404).send({
          success: false,
          error:
            "Document not found",
        });
      }

      const itemIntelligence =
        document.lineItems.length > 0
          ? await computeDocumentItemIntelligence(
              document.id,
              document.vendorName
            )
          : [];

      const extractionFlags =
        document.flags.filter(
          (flag) =>
            flag.flagCategory ===
            "EXTRACTION"
        );

      const businessFlags =
        document.flags.filter(
          (flag) =>
            flag.flagCategory !==
            "EXTRACTION"
        );

      const poMatchResult =
        await matchInvoice(document.id);

      const threeWayMatch =
        await getThreeWayMatchForInvoice(
          document.id
        );

      const procurementAgent =
        document.status === "processed" ||
        document.status === "approved"
          ? await runProcurementAgent(
              document.id
            )
          : null;

      const approver =
        document.totalAmount != null
          ? await resolveApprover({
              amount: document.totalAmount,
            })
          : null;

      let approvalStatus: {
        label: string;
        detail: string | null;
      } = {
        label: document.status,
        detail: null,
      };

      if (document.status === "processed") {
        approvalStatus = {
          label: "Awaiting Approval",
          detail: approver
            ? `Awaiting ${approver}`
            : null,
        };
      } else if (
        document.status === "approved"
      ) {
        approvalStatus = {
          label: "Approved",
          detail: null,
        };
      } else if (
        document.status === "rejected"
      ) {
        approvalStatus = {
          label: "Rejected",
          detail: null,
        };
      } else if (
        document.status === "paid"
      ) {
        approvalStatus = {
          label: "Paid",
          detail: null,
        };
      } else if (
        document.status === "blocked"
      ) {
        approvalStatus = {
          label: "Blocked",
          detail:
            "Duplicate invoice — payment blocked",
        };
      }

      const duplicateMatch =
        document.status === "blocked" ||
        businessFlags.some(
          (flag) =>
            flag.type === "DUPLICATE_INVOICE"
        )
          ? await getDuplicateMatchForDocument(
              document.id
            )
          : null;

      const daysSinceUpload = duplicateMatch
        ? Math.floor(
            (Date.now() -
              duplicateMatch.createdAt.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null;

      return reply.send({
        success: true,
        document,
        itemIntelligence,
        poMatch: poMatchResult,
        threeWayMatch,
        procurementAgent,
        approvalStatus,
        duplicateMatch: duplicateMatch
          ? {
              id: duplicateMatch.id,
              invoiceNumber:
                duplicateMatch.invoiceNumber,
              vendorName:
                duplicateMatch.vendorName,
              totalAmount:
                duplicateMatch.totalAmount,
              uploadedAt:
                duplicateMatch.createdAt.toISOString(),
              daysAgo: daysSinceUpload,
            }
          : null,
        paymentBlocked:
          document.status === "blocked" ||
          duplicateMatch != null,
        paymentPreview: document.vendor
          ? computePaymentDueDate(
              document.vendor,
              document,
              document.approvalHistory.find(
                (entry) =>
                  entry.action === "APPROVE"
              )?.createdAt ?? null
            )
          : null,
        dataQuality: {
          extractionConfidence:
            document.extractionConfidence,
          financialConfidence:
            document.financialConfidence,
          lineItemConfidence:
            document.lineItemConfidence,
          vendorConfidence:
            document.vendorConfidence,
          dataQualityScore:
            document.dataQualityScore,
        },
        extractionFlags,
        businessFlags,
      });

    } catch (error) {
      console.error(error);

      return reply.status(500).send({
        success: false,
        error:
          "Internal server error",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Document actions
| POST /documents/:id/actions — approve/reject/mark paid with audit trail;
| PATCH /documents/:id/status — status override;
| PATCH /documents/:id/correct — human correction of extracted fields
|--------------------------------------------------------------------------
*/

app.post(
  "/documents/:id/actions",
  { preHandler: requireAuth },
  async (request, reply) => {
    try {
      const { id } =
        request.params as {
          id: string;
        };

      const body =
        request.body as {
          action?: string;
          status?: string;
          actorName?: string;
          reason?: string | null;
        };

      if (
        !body?.action
      ) {
        return reply.status(400).send({
          success: false,
          error: "action is required",
        });
      }

      const actionPermission =
        body.action === "APPROVE" ||
        body.action === "REJECT"
          ? PERMISSION_KEYS.INVOICE_APPROVE
          : body.action === "MARK_PAID"
            ? PERMISSION_KEYS.PAYMENT_APPROVE
            : null;

      if (
        actionPermission &&
        request.user &&
        !hasPermission(
          request.user.role,
          actionPermission
        )
      ) {
        return reply.status(403).send({
          success: false,
          error: "Insufficient permissions",
          required: actionPermission,
        });
      }

      const actorName =
        (request.user?.name ??
          body.actorName?.trim()) ||
        "System";

      const existing =
        await prisma.document.findUnique({
          where: {
            id: Number(id),
          },
          include: {
            purchaseOrder: {
              include: {
                request: {
                  select: {
                    id: true,
                    departmentId: true,
                    estimatedAmount: true,
                  },
                },
              },
            },
          },
        });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error:
            "Document not found",
        });
      }

      if (
        body.action === "APPROVE" &&
        (existing.status === "blocked" ||
          (await documentHasDuplicateRisk(
            existing.id
          )))
      ) {
        return reply.status(409).send({
          success: false,
          error:
            "Cannot approve invoice blocked for duplicate fraud risk",
        });
      }

      const status =
        body.status ??
        ACTION_STATUSES[body.action];

      if (
        status &&
        !VALID_STATUSES.includes(status)
      ) {
        return reply.status(400).send({
          success: false,
          error:
            "Invalid status for action",
        });
      }

      const actionRecord =
        await prisma.invoiceAction.create({
          data: {
            documentId: Number(id),
            action: body.action,
            actorName,
            reason:
              body.reason?.trim() ??
              null,
          },
        });

      await prisma.approvalHistory.create({
        data: {
          documentId: Number(id),
          action: body.action,
          user: actorName,
          reason:
            body.reason?.trim() ??
            null,
        },
      });

      const auditLabel =
        body.action === "APPROVE"
          ? "Invoice Approved"
          : body.action === "REJECT"
            ? "Invoice Rejected"
            : body.action === "MARK_PAID"
              ? "Payment Completed"
              : body.action;

      await recordAuditLog(
        "Document",
        Number(id),
        auditLabel,
        actorName,
        {
          newValue: {
            status: status ?? existing.status,
            action: body.action,
          },
          metadata: {
            reason: body.reason ?? null,
          },
          actorContext: auditContextFromRequest({
            user: request.user ?? null,
            permission: actionPermission ?? undefined,
          }),
        }
      );

      const document =
        status
          ? await prisma.document.update({
              where: {
                id: Number(id),
              },
              data: {
                status: status as any,
              },
            })
          : existing;

      let payment = null;

      if (
        body.action === "APPROVE" &&
        document.status === "approved"
      ) {
        try {
          payment =
            await schedulePaymentIfMatched(
              Number(id),
              actorName
            );
        } catch (paymentError) {
          console.error(
            "Failed to schedule payment:",
            paymentError
          );
        }

        void notifyInvoiceApproved(
          {
            id: document.id,
            invoiceNumber:
              document.invoiceNumber,
            vendorName: document.vendorName,
            totalAmount: document.totalAmount,
          },
          actorName
        ).catch(console.error);
      }

      if (
        body.action === "MARK_PAID" &&
        existing.purchaseOrder?.request
          ?.departmentId
      ) {
        const deptId =
          existing.purchaseOrder.request
            .departmentId;
        const amount =
          existing.totalAmount ??
          existing.purchaseOrder.amount ??
          existing.purchaseOrder.request
            .estimatedAmount;

        if (amount > 0) {
          await recordBudgetSpend(
            deptId,
            amount,
            actorName,
            {
              invoiceId: Number(id),
              requestId:
                existing.purchaseOrder.request
                  .id,
            }
          );
        }
      }

      return reply.send({
        success: true,
        action: actionRecord,
        document,
        payment,
      });
    } catch (error) {
      console.error(error);

      return reply.status(500).send({
        success: false,
        error:
          "Failed to record action",
      });
    }
  }
);

app.patch(
  "/documents/:id/status",
  { preHandler: requirePermission(PERMISSION_KEYS.INVOICE_APPROVE) },
  async (request, reply) => {
    try {
      const { id } =
        request.params as {
          id: string;
        };

      const body =
        request.body as {
          status?: string;
        };

      if (!body?.status) {
        return reply.status(400).send({
          success: false,
          error:
            "Status is required",
        });
      }

      if (
        !VALID_STATUSES.includes(
          body.status
        )
      ) {
        return reply.status(400).send({
          success: false,
          error:
            "Invalid status value",
        });
      }

      const existing =
        await prisma.document.findUnique({
          where: {
            id: Number(id),
          },
        });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error:
            "Document not found",
        });
      }

      const document =
        await prisma.document.update({
          where: {
            id: Number(id),
          },

          data: {
            status:
              body.status as any,
          },
        });

      return reply.send({
        success: true,
        document,
      });

    } catch (error) {
      console.error(error);

      return reply.status(500).send({
        success: false,
        error:
          "Failed to update status",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Activity Feed
|--------------------------------------------------------------------------
*/

app.get(
  "/activity",
  { preHandler: requirePermission(PERMISSION_KEYS.CONTROL_VIEW) },
  async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const activities =
        await prisma.document.findMany({
          take: 10,

          orderBy: {
            createdAt: "desc",
          },

          select: {
            id: true,
            vendorName: true,
            invoiceNumber: true,
            status: true,
            createdAt: true,
          },
        });

      return reply.send({
        success: true,
        activities,
      });

    } catch (error) {
      console.error(error);

      return reply.status(500).send({
        success: false,
        error:
          "Failed to load activity",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Dashboard
|--------------------------------------------------------------------------
*/

app.get(
  "/dashboard",
  { preHandler: requirePermission(PERMISSION_KEYS.NOTIFICATION_VIEW) },
  async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const [
        totalInvoices,
        queued,
        processing,
        processed,
        approved,
        paid,
        failed,
      ] = await Promise.all([
        prisma.document.count(),

        prisma.document.count({
          where: {
            status: "queued",
          },
        }),

        prisma.document.count({
          where: {
            status:
              "processing",
          },
        }),

        prisma.document.count({
          where: {
            status:
              "processed",
          },
        }),

        prisma.document.count({
          where: {
            status:
              "approved",
          },
        }),

        prisma.document.count({
          where: {
            status: "paid",
          },
        }),

        prisma.document.count({
          where: {
            status:
              "failed",
          },
        }),
      ]);

      return reply.send({
        success: true,

        metrics: {
          totalInvoices,
          queued,
          processing,
          processed,
          approved,
          paid,
          failed,
        },
      });

    } catch (error) {
      console.error(error);

      return reply.status(500).send({
        success: false,
        error:
          "Failed to load dashboard",
      });
    }
  }
);

const CORRECTABLE_FIELDS = [
  "vendorName",
  "totalAmount",
  "invoiceDate",
  "subtotal",
  "shipping",
  "tax",
  "discount",
  "balanceDue",
] as const;

app.patch(
  "/documents/:id/correct",
  { preHandler: requirePermission(PERMISSION_KEYS.INVOICE_APPROVE) },
  async (request, reply) => {
    try {
      const { id } =
        request.params as {
          id: string;
        };

      const body =
        request.body as {
          field?: string;
          originalValue?: string;
          correctedValue?: string;
        };

      if (
        !body?.field ||
        body.correctedValue == null
      ) {
        return reply.status(400).send({
          success: false,
          error:
            "field and correctedValue are required",
        });
      }

      if (
        !CORRECTABLE_FIELDS.includes(
          body.field as any
        )
      ) {
        return reply.status(400).send({
          success: false,
          error:
            "Invalid field for correction",
        });
      }

      const existing =
        await prisma.document.findUnique({
          where: {
            id: Number(id),
          },
        });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error:
            "Document not found",
        });
      }

      const numericFields = [
        "totalAmount",
        "subtotal",
        "shipping",
        "tax",
        "discount",
        "balanceDue",
      ];

      let parsedValue:
        | string
        | number
        | null =
        body.correctedValue;

      if (
        numericFields.includes(
          body.field
        )
      ) {
        parsedValue = parseFloat(
          body.correctedValue.replace(
            /[$,\s]/g,
            ""
          )
        );

        if (
          Number.isNaN(parsedValue)
        ) {
          return reply.status(400).send({
            success: false,
            error:
              "Invalid numeric value",
          });
        }
      }

      await prisma.extractionCorrection.create(
        {
          data: {
            field: body.field,
            originalValue:
              body.originalValue ??
              "",
            correctedValue:
              body.correctedValue,
            documentId:
              Number(id),
            vendorId:
              existing.vendorId,
          },
        }
      );

      const document =
        await prisma.document.update({
          where: {
            id: Number(id),
          },
          data: {
            [body.field]: parsedValue,
            requiresReview: false,
            extractionConfidence: 95,
          },
        });

      return reply.send({
        success: true,
        document,
      });
    } catch (error) {
      console.error(error);

      return reply.status(500).send({
        success: false,
        error:
          "Failed to save correction",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Analytics
| GET /analytics/categories — spend by category;
| GET /analytics/executive — CFO dashboard aggregates;
| GET /analytics/vendor-spend — vendor concentration;
| GET /analytics/risk-queue — flagged invoices (CONTROL_VIEW)
|--------------------------------------------------------------------------
*/

app.get(
  "/analytics/categories",
  { preHandler: requirePermission(PERMISSION_KEYS.CONTROL_VIEW) },
  async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const result =
        await calculateCategoryAnalytics();

      const response: CategoryAnalyticsResponse =
        {
          success: true,
          categories: result.categories,
          totalSpend: result.totalSpend,
        };

      return reply.send(response);
    } catch (error) {
      console.error(error);

      return reply.status(500).send({
        success: false,
        error:
          "Failed to load category analytics",
      });
    }
  }
);

app.get(
  "/analytics/executive",
  { preHandler: requirePermission(PERMISSION_KEYS.CONTROL_VIEW) },
  async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const data =
        await calculateExecutiveAnalytics();

      const response: ExecutiveAnalyticsResponse =
        {
          success: true,
          data,
        };

      return reply.send(response);
    } catch (error) {
      console.error(error);

      return reply.status(500).send({
        success: false,
        error:
          "Failed to load executive analytics",
      });
    }
  }
);

app.get(
  "/analytics/vendor-spend",
  { preHandler: requirePermission(PERMISSION_KEYS.CONTROL_VIEW) },
  async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const vendors =
        await calculateVendorSpend();

      const response: VendorSpendResponse =
        {
          success: true,
          vendors,
        };

      return reply.send(response);
    } catch (error) {
      console.error(error);

      return reply.status(500).send({
        success: false,
        error:
          "Failed to load vendor spend",
      });
    }
  }
);

app.get(
  "/analytics/risk-queue",
  { preHandler: requirePermission(PERMISSION_KEYS.CONTROL_VIEW) },
  async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const documents =
        await prisma.document.findMany({
          where: {
            flags: {
              some: {
                flagCategory: {
                  in: [
                    "FINANCIAL",
                    "FRAUD",
                    "PROCUREMENT",
                  ],
                },
                resolved: false,
              },
            },
          },
          include: {
            flags: {
              where: {
                flagCategory: {
                  in: [
                    "FINANCIAL",
                    "FRAUD",
                    "PROCUREMENT",
                  ],
                },
                resolved: false,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
        });

      const queue = documents.map(
        (doc) => {
          const topFlag =
            doc.flags.sort(
              (a, b) =>
                (a.severity ===
                "HIGH"
                  ? 0
                  : 1) -
                (b.severity ===
                "HIGH"
                  ? 0
                  : 1)
            )[0];

          return {
            id: doc.id,
            invoiceNumber:
              doc.invoiceNumber,
            vendor: doc.vendorName,
            amount: doc.totalAmount,
            risk: topFlag?.type ?? "UNKNOWN",
            severity:
              topFlag?.severity ??
              "MEDIUM",
            riskScore: doc.riskScore,
          };
        }
      );

      const response: RiskQueueResponse =
        {
          success: true,
          queue,
          availability:
            queue.length > 0,
          source:
            "Documents with unresolved FINANCIAL, FRAUD, or PROCUREMENT flags",
        };

      return reply.send(response);
    } catch (error) {
      console.error(error);

      return reply.status(500).send({
        success: false,
        error:
          "Failed to load risk queue",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Approvals
| GET /approvals — role-scoped approval inbox (APPROVAL_VIEW)
|--------------------------------------------------------------------------
*/

app.get(
  "/approvals",
  { preHandler: requirePermission(PERMISSION_KEYS.APPROVAL_VIEW) },
  async (request, reply) => {
    try {
      const inbox =
        await getApprovalInboxForUser(
          request.user!.role
        );

      return reply.send({
        success: true,
        ...inbox,
      });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({
        success: false,
        error:
          "Failed to load approval inbox",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Notifications
| GET /notifications — user inbox; PATCH /notifications/:id/read — mark read
|--------------------------------------------------------------------------
*/

app.get(
  "/notifications",
  { preHandler: requirePermission(PERMISSION_KEYS.NOTIFICATION_VIEW) },
  async (request, reply) => {
    try {
      const notifications =
        await listNotifications(
          request.user!.id
        );
      const unreadCount =
        await getUnreadCount(
          request.user!.id
        );

      return reply.send({
        success: true,
        notifications,
        unreadCount,
      });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({
        success: false,
        error: "Failed to load notifications",
      });
    }
  }
);

app.patch(
  "/notifications/:id/read",
  { preHandler: requirePermission(PERMISSION_KEYS.NOTIFICATION_VIEW) },
  async (request, reply) => {
    try {
      const { id } =
        request.params as { id: string };

      await markNotificationRead(
        request.user!.id,
        Number(id)
      );

      return reply.send({ success: true });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({
        success: false,
        error: "Failed to mark read",
      });
    }
  }
);

app.patch(
  "/notifications/read-all",
  { preHandler: requirePermission(PERMISSION_KEYS.NOTIFICATION_VIEW) },
  async (request, reply) => {
    try {
      const result = await markAllNotificationsRead(
        request.user!.id
      );

      return reply.send({
        success: true,
        count: result.count,
      });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({
        success: false,
        error: "Failed to mark all read",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Spend Categories
|--------------------------------------------------------------------------
*/

app.get(
  "/spend-categories",
  { preHandler: requirePermission(PERMISSION_KEYS.REQUEST_VIEW) },
  async (_request, reply) => {
    try {
      const categories =
        await listSpendCategories();

      return reply.send({
        success: true,
        categories,
      });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({
        success: false,
        error:
          "Failed to load spend categories",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Control tower
| GET /control-tower — operational KPIs and exception summary (CONTROL_VIEW)
|--------------------------------------------------------------------------
*/

app.get(
  "/control-tower",
  { preHandler: requirePermission(PERMISSION_KEYS.CONTROL_VIEW) },
  async (_request, reply) => {
    try {
      const data =
        await getControlTowerData();

      return reply.send({
        success: true,
        data,
      });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({
        success: false,
        error:
          "Failed to load control tower",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Vendors
| GET /vendors — directory; GET /vendors/:id — 360 view;
| PATCH /vendors/:id — payment terms (VENDOR_VIEW / VENDOR_MANAGE)
|--------------------------------------------------------------------------
*/

app.get(
  "/vendors",
  { preHandler: requirePermission(PERMISSION_KEYS.VENDOR_VIEW) },
  async (_request, reply) => {
    try {
      const vendors =
        await listVendors();

      return reply.send({
        success: true,
        vendors,
      });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({
        success: false,
        error:
          "Failed to load vendors",
      });
    }
  }
);

app.get(
  "/vendors/:id",
  { preHandler: requirePermission(PERMISSION_KEYS.VENDOR_VIEW) },
  async (request, reply) => {
    try {
      const { id } =
        request.params as { id: string };

      const vendor =
        await getVendor360(Number(id));

      if (!vendor) {
        return reply.status(404).send({
          success: false,
          error: "Vendor not found",
        });
      }

      return reply.send({
        success: true,
        vendor,
      });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({
        success: false,
        error: "Failed to load vendor",
      });
    }
  }
);

app.patch(
  "/vendors/:id",
  { preHandler: requirePermission(PERMISSION_KEYS.VENDOR_MANAGE) },
  async (request, reply) => {
    try {
      const { id } =
        request.params as { id: string };

      const body = request.body as {
        paymentTermsDays?: number;
        msmeRegistered?: boolean;
      };

      if (
        body.paymentTermsDays == null
      ) {
        return reply.status(400).send({
          success: false,
          error:
            "paymentTermsDays is required",
        });
      }

      const vendor =
        await updateVendorPaymentTerms(
          Number(id),
          {
            paymentTermsDays:
              body.paymentTermsDays,
            msmeRegistered:
              body.msmeRegistered,
          },
          (request as any).user?.name ??
            "System"
        );

      return reply.send({
        success: true,
        vendor,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update vendor";

      const status =
        message === "Vendor not found"
          ? 404
          : 400;

      return reply.status(status).send({
        success: false,
        error: message,
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Audit logs
| GET /audit-logs — paginated enterprise audit trail (AUDIT_VIEW)
|--------------------------------------------------------------------------
*/

type AuditQueryString = {
  limit?: string;
  actor?: string;
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
  pageSize?: string;
};

function parseAuditFilters(
  q: AuditQueryString
): AuditQueryFilters {
  const toInt = (v?: string) => {
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const toDate = (v?: string) => {
    if (!v) return undefined;
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? undefined
      : d;
  };

  return {
    actor: q.actor || undefined,
    actorUserId: toInt(q.actorUserId),
    entityType: q.entityType || undefined,
    entityId: toInt(q.entityId),
    action: q.action || undefined,
    search: q.search || undefined,
    dateFrom: toDate(q.dateFrom),
    dateTo: toDate(q.dateTo),
    page: toInt(q.page),
    pageSize: toInt(q.pageSize) ?? toInt(q.limit),
  };
}

app.get(
  "/audit-logs",
  { preHandler: requirePermission(PERMISSION_KEYS.AUDIT_VIEW) },
  async (request, reply) => {
    try {
      const q = request.query as AuditQueryString;
      const hasFilters =
        q.actor ||
        q.actorUserId ||
        q.entityType ||
        q.entityId ||
        q.action ||
        q.search ||
        q.dateFrom ||
        q.dateTo ||
        q.page ||
        q.pageSize;

      // Backward-compatible: plain ?limit returns a flat list.
      if (!hasFilters) {
        const logs = await listAuditLogs(
          q.limit ? Number(q.limit) : 50
        );
        return reply.send({ success: true, logs });
      }

      const result = await queryAuditLogs(
        parseAuditFilters(q)
      );

      return reply.send({
        success: true,
        logs: result.rows,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({
        success: false,
        error: "Failed to load audit logs",
      });
    }
  }
);

app.get(
  "/audit-logs/filters",
  { preHandler: requirePermission(PERMISSION_KEYS.AUDIT_VIEW) },
  async (_request, reply) => {
    try {
      const options =
        await getAuditFilterOptions();
      return reply.send({
        success: true,
        ...options,
      });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({
        success: false,
        error: "Failed to load audit filters",
      });
    }
  }
);

app.get(
  "/audit-logs/export",
  { preHandler: requirePermission(PERMISSION_KEYS.AUDIT_VIEW) },
  async (request, reply) => {
    try {
      const csv = await exportAuditLogsCsv(
        parseAuditFilters(
          request.query as AuditQueryString
        )
      );

      const stamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, "-");

      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          `attachment; filename="audit-log-${stamp}.csv"`
        )
        .send(csv);
    } catch (error) {
      console.error(error);
      return reply.status(500).send({
        success: false,
        error: "Failed to export audit logs",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Server startup
| Enterprise seed → SLA engine → listen on 0.0.0.0:4000
|--------------------------------------------------------------------------
*/

runEnterpriseSeeds()
  .catch((err) => {
    console.error("Seed failed:", err);
  })
  .finally(() => {
    startSlaEngine();
    startIdentityJobs();

    app.listen(
      {
        port: Number(process.env.PORT) || 4000,
        host: "0.0.0.0",
      },
      (err, address) => {
        if (err) {
          console.error(err);
          process.exit(1);
        }

        console.log(
          `🚀 Server running at ${address}`
        );
      }
    );
  });
