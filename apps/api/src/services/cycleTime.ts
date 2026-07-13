/**
 * Phase 16.5 — Procurement cycle time (null-safe, no fake zeros).
 */
import prisma from "../db";
import { notDeleted } from "../lib/softDelete";

const MIN_SAMPLES = 1;

function hoursBetween(start: Date, end: Date) {
  if (end.getTime() <= start.getTime()) return null;
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

function daysBetween(start: Date, end: Date) {
  const h = hoursBetween(start, end);
  return h == null ? null : h / 24;
}

function avg(values: number[]) {
  if (values.length < MIN_SAMPLES) return null;
  const sum = values.reduce((s, v) => s + v, 0);
  return sum / values.length;
}

function metricHours(values: number[]) {
  const mean = avg(values);
  return {
    hours: mean != null ? Math.round(mean * 10) / 10 : null,
    days: mean != null ? Math.round((mean / 24) * 10) / 10 : null,
    label: formatDurationHours(mean),
    sampleSize: values.length,
    hasEnoughData: values.length >= MIN_SAMPLES,
  };
}

function metricDays(values: number[]) {
  const mean = avg(values);
  return {
    days: mean != null ? Math.round(mean * 10) / 10 : null,
    label: formatDurationDays(mean),
    sampleSize: values.length,
    hasEnoughData: values.length >= MIN_SAMPLES,
  };
}

export async function getProcurementCycleTime() {
  const requests = await prisma.purchaseRequest.findMany({
    where: { approvedAt: { not: null } },
    select: {
      id: true,
      createdAt: true,
      approvedAt: true,
      purchaseOrders: {
        where: notDeleted,
        select: {
          id: true,
          createdAt: true,
          invoices: {
            where: notDeleted,
            select: {
              id: true,
              createdAt: true,
              payment: {
                select: { paidDate: true, status: true },
              },
            },
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  const requestToApproval: number[] = [];
  const approvalToPO: number[] = [];
  const poToInvoice: number[] = [];
  const invoiceToPayment: number[] = [];
  const endToEndDays: number[] = [];

  for (const req of requests) {
    if (!req.approvedAt) continue;

    const r2a = hoursBetween(req.createdAt, req.approvedAt);
    if (r2a != null) requestToApproval.push(r2a);

    const po = req.purchaseOrders[0];
    if (!po || !req.approvedAt) continue;

    const a2po = hoursBetween(req.approvedAt, po.createdAt);
    if (a2po != null) approvalToPO.push(a2po);

    const inv = po.invoices[0];
    if (!inv) continue;

    const p2i = daysBetween(po.createdAt, inv.createdAt);
    if (p2i != null) poToInvoice.push(p2i);

    const paidDate =
      inv.payment?.status === "PAID" ? inv.payment.paidDate : null;
    if (paidDate) {
      const i2p = daysBetween(inv.createdAt, paidDate);
      if (i2p != null) invoiceToPayment.push(i2p);

      const e2e = daysBetween(req.createdAt, paidDate);
      if (e2e != null) endToEndDays.push(e2e);
    }
  }

  const requestToApprovalMetric = metricHours(requestToApproval);
  const approvalToPOMetric = metricHours(approvalToPO);
  const poToInvoiceMetric = metricDays(poToInvoice);
  const invoiceToPaymentMetric = metricDays(invoiceToPayment);
  const averageEndToEnd = avg(endToEndDays);

  return {
    requestToApproval: requestToApprovalMetric,
    approvalToPO: approvalToPOMetric,
    poToInvoice: poToInvoiceMetric,
    invoiceToPayment: invoiceToPaymentMetric,
    averageProcurementCycleDays:
      averageEndToEnd != null
        ? Math.round(averageEndToEnd * 10) / 10
        : null,
    averageProcurementCycleLabel:
      averageEndToEnd != null
        ? `${Math.round(averageEndToEnd * 10) / 10} days`
        : "Not enough data",
    completeChainCount: endToEndDays.length,
  };
}

function formatDurationHours(h: number | null) {
  if (h == null || !Number.isFinite(h)) return "Not enough data";
  if (h < 24) return `${Math.round(h)} hours`;
  return `${Math.round((h / 24) * 10) / 10} days`;
}

function formatDurationDays(d: number | null) {
  if (d == null || !Number.isFinite(d)) return "Not enough data";
  return `${Math.round(d * 10) / 10} days`;
}
