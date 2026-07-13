/**
 * BullMQ consumer for the "invoice-processing" queue (producer: apps/api/src/queue.ts).
 * End-to-end pipeline: OCR → AI/regex extraction → validation & flags → Prisma persist → vendor/PO intelligence.
 */
import "dotenv/config";

import { Worker } from "bullmq";
import IORedis from "ioredis";
import fs from "fs";

import { analyzeInvoice } from "./ocr";
import { extractInvoiceData } from "./extract";
import { extractViaPlatform } from "./aiClient";

import prisma from "../../api/src/db";
// Financial Validation
import {
  validateInvoice,
  detectUnusualAmount,
} from "./extraction/validator";

// Confidence Engine
import {
  calculateConfidence,
} from "./extraction/confidence";

import { parseMoney } from "./extraction/money";

import {
  createFlag,
  isBusinessRiskFlag,
  TypedFlag,
} from "./extraction/flags";

import {
  calculateExtractionConfidence,
  detectExtractionErrors,
} from "./extraction/extractionQuality";

import {
  buildDataQualityScores,
} from "./extraction/dataQuality";

import { categorizeItem } from "./extraction/categorize";

import {
  detectPriceAnomaly,
} from "./extraction/anomaly";

import {
  detectSavingsOpportunity,
} from "./procurement/savings";

import {
  detectBenchmarkOpportunity,
} from "./procurement/benchmark";

import {
  calculateVendorScores,
} from "./procurement/vendorScore";

import {
  autoMatchInvoiceToPO,
  runThreeWayMatchWorker,
} from "./procurement/poMatcher";

import {
  detectRoundAmountRisk,
  detectUnusualInvoiceDate,
  detectDuplicatePayment,
  detectPossibleFraud,
} from "./risk/fraud";
import {
  findDuplicateInvoice,
  recordDuplicateInvoiceDetected,
} from "../../api/src/services/fraudDetection";

// Redis connection — must match API queue.ts (BullMQ requires maxRetriesPerRequest: null).
// Fallback uses non-default 6380 (Docker mapping) to avoid clashing with other projects.
const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6380", {
  maxRetriesPerRequest: null,
});

// Job payload: { documentId, filePath } — added by API on upload
const worker = new Worker(
  "invoice-processing",

  async (job) => {
    try {
      console.log("📄 Processing invoice");
      console.log(job.data);

      await prisma.document.update({
        where: {
          id: job.data.documentId,
        },
        data: {
          status: "processing",
        },
      });

      if (!fs.existsSync(job.data.filePath)) {
        throw new Error(
          `Invoice file not found: ${job.data.filePath}`
        );
      }

      // --- Extraction ---
      // Primary path: the AI platform runs the full pipeline (OCR → Graph →
      // Extraction → Vision → Validation → Fusion) behind one HTTP call. The
      // worker holds no AI logic. If the platform is unreachable, fall back to
      // the local OCR + extraction path so processing never stalls.
      console.log("📁 File:", job.data.filePath);

      let structuredData: any;
      let parsedText = "";

      const platform = await extractViaPlatform(
        job.data.filePath
      );

      if (platform) {
        console.log(
          `✅ Extracted via AI platform (type=${platform.docType}, conf=${platform.overallConfidence}, vision=${platform.visionModel ?? "none"})`
        );
        structuredData = platform;
        parsedText = platform.rawText || "";
      } else {
        console.log(
          "🧠 Running local OCR + extraction fallback..."
        );
        const result = await analyzeInvoice(
          job.data.filePath
        );
        parsedText =
          result?.ParsedResults?.[0]?.ParsedText || "";
        structuredData =
          await extractInvoiceData(
            parsedText,
            job.data.filePath
          );
      }


        

      /*
       ----------------------------------
       UPSERT VENDOR
       ----------------------------------
      */
      
      let vendor = null;

      if (structuredData.vendorName) {
        vendor =
          await prisma.vendor.upsert({
            where: {
              name:
                structuredData.vendorName,
            },

            update: { isOcrGenerated: true },

            create: {
              name:
                structuredData.vendorName,
              isOcrGenerated: true,
            },
          });
      }
        

      console.log(
        "✅ Structured Invoice Data"
      );

      console.dir(structuredData, {
        depth: null,
      });

      const normalizedAmount =
        parseMoney(
          structuredData.totalAmount
        );

      const subtotal =
        parseMoney(
          structuredData.subtotal
        );

      const shipping =
        parseMoney(
          structuredData.shipping
        );

      const tax =
        parseMoney(
          structuredData.tax
        );

      const discount =
        parseMoney(
          structuredData.discount
        );

      const balanceDue =
        parseMoney(
          structuredData.balanceDue
        );

      const extractionConfidence =
        calculateExtractionConfidence(
          {
            vendorName:
              structuredData.vendorName,
            invoiceDate:
              structuredData.invoiceDate,
            subtotal,
            shipping,
            tax,
            discount,
            totalAmount:
              normalizedAmount,
            balanceDue,
          },
          parsedText
        );

      const dataQuality =
        buildDataQualityScores(
          extractionConfidence,
          structuredData.lineItems ?? []
        );

      /*
       ----------------------------------
       RISK FLAGS
       ----------------------------------
      */

      const flags: TypedFlag[] = [];

      for (const error of detectExtractionErrors(
        {
          subtotal,
          totalAmount:
            normalizedAmount,
          balanceDue,
        },
        parsedText,
        extractionConfidence
      )) {
        flags.push(
          createFlag(
            error.type,
            error.severity,
            error.message
          )
        );
      }

      if (
        !structuredData.invoiceNumber
      ) {
        flags.push(
          createFlag(
            "MISSING_INVOICE_NUMBER",
            "HIGH",
            "Invoice number missing"
          )
        );
      }

      if (!structuredData.vendorName) {
        flags.push(
          createFlag(
            "MISSING_VENDOR",
            "HIGH",
            "Vendor not detected"
          )
        );
      }

      let duplicateMatch = null;

      if (
        structuredData.invoiceNumber &&
        structuredData.vendorName &&
        normalizedAmount != null
      ) {
        duplicateMatch =
          await findDuplicateInvoice({
            documentId:
              job.data.documentId,
            vendorId: vendor?.id,
            vendorName:
              structuredData.vendorName,
            invoiceNumber:
              structuredData.invoiceNumber,
            totalAmount:
              normalizedAmount,
          });
      }

      if (duplicateMatch) {
        flags.push(
          createFlag(
            "DUPLICATE_INVOICE",
            "HIGH",
            `Duplicate invoice ${duplicateMatch.invoiceNumber ?? duplicateMatch.id} from ${duplicateMatch.vendorName ?? "vendor"} for ${normalizedAmount?.toLocaleString()}`
          )
        );

        flags.push(
          createFlag(
            "FRAUD_RISK",
            "HIGH",
            "Potential duplicate invoice — payment blocked pending review"
          )
        );
      }

      const isDuplicateBlocked =
        duplicateMatch != null;

      const skipFinancialValidation =
        extractionConfidence.amounts <
        75;

      const validationFlags =
        validateInvoice(
          {
            subtotal,
            shipping,
            tax,
            discount,
            totalAmount:
              normalizedAmount,
            balanceDue,
          },
          {
            skipIfLowConfidence:
              skipFinancialValidation,
          }
        );

      for (const flag of validationFlags) {
        flags.push(flag);
      }

      if (
        !skipFinancialValidation &&
        normalizedAmount &&
        normalizedAmount > 100
      ) {
        const priorInvoices =
          await prisma.document.findMany({
            where: {
              vendorName:
                structuredData.vendorName,

              totalAmount: {
                not: null,
              },

              NOT: {
                id: job.data.documentId,
              },
            },

            select: {
              totalAmount: true,
            },
          });

        if (priorInvoices.length >= 2) {
          const priorTotal =
            priorInvoices.reduce(
              (sum, inv) =>
                sum +
                (inv.totalAmount || 0),
              0
            );

          const vendorAverage =
            priorTotal /
            priorInvoices.length;

          const unusualFlag =
            detectUnusualAmount(
              normalizedAmount,
              vendorAverage,
              priorInvoices.length
            );

          if (unusualFlag) {
            flags.push(unusualFlag);
          }
        }
      }

      /*
      ----------------------------------
      FRAUD DETECTION
      ----------------------------------
      */

      const roundFlag =
        detectRoundAmountRisk(
          normalizedAmount
        );

      if (roundFlag) {
        flags.push(
          createFlag(
            roundFlag.type,
            roundFlag.severity,
            roundFlag.message
          )
        );
      }

      const dateFlag =
        detectUnusualInvoiceDate(
          structuredData.invoiceDate
        );

      if (dateFlag) {
        flags.push(
          createFlag(
            dateFlag.type,
            dateFlag.severity,
            dateFlag.message
          )
        );
      }

      const duplicatePaymentFlag =
        await detectDuplicatePayment(
          structuredData.vendorName,
          normalizedAmount,
          job.data.documentId,
          prisma as any
        );

      if (duplicatePaymentFlag) {
        flags.push(
          createFlag(
            duplicatePaymentFlag.type,
            duplicatePaymentFlag.severity,
            duplicatePaymentFlag.message
          )
        );
      }

      const fraudFlag =
        detectPossibleFraud(
          flags.map((f) => ({
            type: f.type,
            severity: f.severity,
            message: f.message,
          }))
        );

      if (fraudFlag) {
        flags.push(
          createFlag(
            fraudFlag.type,
            fraudFlag.severity,
            fraudFlag.message
          )
        );
      }

      const businessFlags =
        flags.filter(isBusinessRiskFlag);

      /*
      ----------------------------------
      CONFIDENCE SCORE
      ----------------------------------
      */

      const confidenceScore =
        calculateConfidence(
          {
            vendorName:
              structuredData.vendorName,

            invoiceNumber:
              structuredData.invoiceNumber,

            invoiceDate:
              structuredData.invoiceDate,

            totalAmount:
              normalizedAmount,
          },

          businessFlags.length
        );


      /*
       ----------------------------------
       UPDATING DOCUMENT
       ----------------------------------
      */
      console.log(
        "Updating document:",
        job.data.documentId
      );

      const existingDocument =
        await prisma.document.findUnique({
          where: {
            id: job.data.documentId,
          },
        });

      console.log(
        "Existing document:",
        existingDocument
      );

      /*
       ----------------------------------
       SAVE DOCUMENT
       ----------------------------------
      */

      await prisma.document.update({
        where: {
          id: job.data.documentId,
        },

        data: {
          status: isDuplicateBlocked
            ? "blocked"
            : "processed",
          vendorId: vendor?.id ?? null,

          vendorName:
            structuredData.vendorName ||
            null,

          invoiceNumber:
            structuredData.invoiceNumber ||
            null,

          invoiceDate:
            structuredData.invoiceDate ||
            null,

          customerName:
            structuredData.customerName ||
            null,

          totalAmount:
            normalizedAmount,

          subtotal,
          shipping,
          tax,
          discount,
          balanceDue,

          currency:
            structuredData.currency ||
            null,

          rawText: parsedText,

          extractedData:
            structuredData,

          confidenceScore: confidenceScore,

          extractionConfidence:
            dataQuality.extractionConfidence,

          financialConfidence:
            dataQuality.financialConfidence,

          lineItemConfidence:
            dataQuality.lineItemConfidence,

          vendorConfidence:
            dataQuality.vendorConfidence,

          dataQualityScore:
            dataQuality.dataQualityScore,

          requiresReview:
            dataQuality.requiresReview,

          riskScore: Math.max(
            100 -
              businessFlags.length * 15,
            0
          ),
        },
      });

      /*
      ----------------------------------
      Save Line Items
      ----------------------------------
      */

      if (
        structuredData.lineItems?.length
      ) {
        await prisma.lineItem.deleteMany({
          where: {
            documentId:
              job.data.documentId,
          },
        });

        await prisma.lineItem.createMany({
          data:
            structuredData.lineItems.map(
              (item: {
                description: string;
                quantity?: number;
                rate?: number;
                amount?: number;
              }) => ({
                description:
                  item.description,

                quantity:
                  item.quantity ?? null,

                rate:
                  item.rate ?? null,

                amount:
                  item.amount ?? null,

                category:
                  categorizeItem(
                    item.description
                  ),

                documentId:
                  job.data.documentId,
              })
            ),
        });

        for (
          const item of
          structuredData.lineItems
        ) {
          if (!item.rate) {
            continue;
          }

          const category =
            categorizeItem(
              item.description
            );

          const anomaly =
            await detectPriceAnomaly(
              item.description,
              item.rate
            );

          if (anomaly) {
            flags.push(
              createFlag(
                anomaly.type,
                anomaly.severity,
                anomaly.message
              )
            );
          }

          const savings =
            await detectSavingsOpportunity(
              item.description,
              item.rate,
              category,
              job.data.documentId
            );

          if (savings) {
            flags.push(
              createFlag(
                savings.flag.type,
                savings.flag.severity,
                savings.flag.message
              )
            );
          }

          const benchmark =
            await detectBenchmarkOpportunity(
              item.description,
              item.rate,
              category,
              job.data.documentId
            );

          if (benchmark) {
            flags.push(
              createFlag(
                benchmark.type,
                benchmark.severity,
                benchmark.message
              )
            );
          }
        }
      }

      const finalBusinessFlags =
        flags.filter(isBusinessRiskFlag);

      /*
       ----------------------------------
       SAVE FLAGS
       ----------------------------------
       */

      await prisma.invoiceFlag.deleteMany({
        where: {
          documentId:
            job.data.documentId,
        },
      });

      for (const flag of flags) {
        await prisma.invoiceFlag.create({
          data: {
            documentId:
              job.data.documentId,

            type: flag.type,

            flagCategory:
              flag.flagCategory as any,

            severity:
              flag.severity,

            message:
              flag.message,
          },
        });
      }

      if (duplicateMatch) {
        await recordDuplicateInvoiceDetected(
          job.data.documentId,
          duplicateMatch
        );
      }

      await prisma.document.update({
        where: {
          id: job.data.documentId,
        },
        data: {
          riskScore: Math.max(
            100 -
              finalBusinessFlags.length *
                15,
            0
          ),
        },
      });

      // ==========================================
      // VENDOR INTELLIGENCE ENGINE
      // ==========================================

      if (structuredData.vendorName) {

        // Find existing vendor
        let vendor =
        await prisma.vendor.findUnique({
          where: {
            name: structuredData.vendorName,
          },
        });

        // Create vendor if missing
        if (!vendor) {
          vendor =
            await prisma.vendor.create({
              data: {
                name:
                  structuredData.vendorName,
                isOcrGenerated: true,
              },
            });
        }

        // Fetch all invoices
        const vendorInvoices =
          await prisma.document.findMany({
            where: {
              vendorName:
                structuredData.vendorName,
            },
          });

        // Calculate spend
        const totalSpend =
          vendorInvoices.reduce(
            (sum, invoice) =>
              sum +
              (invoice.totalAmount || 0),
            0
          );

        const invoiceCount =
          vendorInvoices.length;

        const averageInvoice =
          invoiceCount > 0
            ? totalSpend / invoiceCount
            : 0;

        // Vendor risk score (business flags only)
        const businessFlagCount =
          flags.filter(
            isBusinessRiskFlag
          ).length;

        let riskScore = Math.max(
          100 - businessFlagCount * 10,
          0
        );

        // Update vendor intelligence
        const scores =
          await calculateVendorScores(
            vendor.id,
            structuredData.vendorName
          );

        await prisma.vendor.update({
          where: {
            id: vendor.id,
          },

          data: {
            totalSpend,

            invoiceCount,

            averageInvoice,

            riskScore,

            reliabilityScore:
              scores.reliabilityScore,

            deliveryScore:
              scores.deliveryScore,

            priceCompetitivenessScore:
              scores.priceCompetitivenessScore,

            invoiceAccuracyScore:
              scores.invoiceAccuracyScore,

            responseTimeScore:
              scores.responseTimeScore,

            lastInvoiceDate:
              new Date(),
          },
        });

        console.log(
          "📊 Vendor health updated"
       );
      }

      /*
       ----------------------------------
       PO Auto-Match + Three-Way Match
       ----------------------------------
       */

      const poMatch =
        await autoMatchInvoiceToPO(
          job.data.documentId
        );

      if (poMatch.matched) {
        console.log(
          `🔗 PO matched: ${poMatch.poNumber} (${poMatch.confidence}%)`
        );

        const linked =
          await prisma.document.findUnique({
            where: {
              id: job.data.documentId,
            },
            select: {
              purchaseOrderId: true,
            },
          });

        if (linked?.purchaseOrderId) {
          await runThreeWayMatchWorker(
            linked.purchaseOrderId,
            job.data.documentId
          );
        }
      }

      console.log(
        "✅ Invoice saved to database"
      );

      console.log(
        `🚩 ${flags.length} risk flag(s) created`
      );

    } catch (error) {
      // Mark document failed; job is not retried automatically here
      console.error(
        "❌ Worker Processing Failed"
      );

      console.error(error);

      if (job.data?.documentId) {
        try {
          await prisma.document.update({
            where: {
              id: job.data.documentId,
            },

            data: {
              status: "failed",
            },
          });
        } catch (dbError) {
          console.error(
            "❌ Failed to update DB status"
          );

          console.error(dbError);
        }
      }
    }
  },

  {
    connection: connection as any,
  }
);

import { WORKER_HEARTBEAT_KEY } from "../../api/src/queue";

async function writeHeartbeat() {
  try {
    await connection.set(
      WORKER_HEARTBEAT_KEY,
      String(Date.now())
    );
  } catch (error) {
    console.error("Worker heartbeat failed", error);
  }
}

void writeHeartbeat();
setInterval(writeHeartbeat, 30_000);

// Listens on Redis; enqueue via apps/api invoiceQueue.add(...)
console.log("🚀 Worker started");