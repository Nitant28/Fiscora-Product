# Fiscora Trust Audit Report

Generated as part of CEO Directive #7 — Technical Debt Freeze.

## CRITICAL (fixed in this pass)

| Issue | Location | Fix |
|-------|----------|-----|
| Vendor scores displayed with default `75` pricing when no market data | `vendorScore.ts` | Return `0` until ≥2 comparable market rates exist |
| Fake vendor metrics shown at `0/100` | Invoice UI | Gated on `availability`; show "Collecting vendor history" |
| Extraction errors mixed into business risk | Worker flags | `EXTRACTION` category excluded from `riskScore` |
| Analytics returned `0` instead of `null` for missing data | `/analytics/*` | Typed responses with `availability` flags |
| Untyped analytics responses | API | `apps/api/src/types/analytics.ts` |

## HIGH (fixed in this pass)

| Issue | Location | Fix |
|-------|----------|-----|
| Dashboard showed operational metrics (Approved/Paid/Failed) as primary | `dashboard/page.tsx` | Procurement decision cards only at top |
| No item-level price intelligence | Missing | `itemIntelligence.ts` + API |
| No data quality layer (single confidence only) | Document model | `financialConfidence`, `lineItemConfidence`, `vendorConfidence` |
| Approval actions not audited (who/when/why) | Missing | `InvoiceAction` model + API |
| Duplicate dashboard at `/` | `app/page.tsx` | Redirect to `/dashboard` |

## MEDIUM (addressed)

| Issue | Location | Fix |
|-------|----------|-----|
| Vendor ranking without minimum history | Vendor API | Requires `invoiceCount >= 3` and `vendorScore > 0` |
| Line item variance shown without historical data | Invoice UI | Only when `sampleCount >= 3` |
| Missing source labels on metrics | StatCard | `source` prop on all cards |

## LOW (deferred — Phase 2)

| Issue | Notes |
|-------|-------|
| Vendor Trends / Dependency | Phase 2A |
| Alternative vendor suggestions | Phase 2B |
| Approval rules & thresholds | Phase 2C |
| Executive Command Center monthly rollups | Phase 2D |
| Duplicated analytics types (API vs web) | Consolidate to shared package later |

## Vendor Intelligence Field Audit

| Field | Source Table | Formula | API Field | Component |
|-------|-------------|---------|-----------|-----------|
| Vendor Score | `Vendor` | `(pricingScore + reliabilityScore + accuracyScore) ÷ 3` | `vendor.vendorScore` | `VendorIntelligence.tsx` |
| Pricing Score | `Vendor` + `LineItem` | `75 + avg(marketRate − vendorRate)/marketRate × 100` | `vendor.pricingScore` | `VendorIntelligence.tsx` |
| Reliability Score | `Vendor` + `InvoiceFlag` | `70 + min(invoices×3,20) − highFlags×8 − duplicateFlags×15` | `vendor.reliabilityScore` | `VendorIntelligence.tsx` |
| Accuracy Score | `Document` | `avg(confidenceScore) − (missingFields/invoices)×20` | `vendor.accuracyScore` | `VendorIntelligence.tsx` |
| Potential Annual Savings | `ProcurementInsight` | `SUM(savingsAmount) per vendor` | `/analytics/vendors[].savings` | `VendorIntelligence.tsx` |
| Vendor Ranking | `Vendor` | `ORDER BY vendorScore DESC` | `/analytics/vendors[].rank` | `VendorIntelligence.tsx` |

**Minimum data before display:** 3 invoices with the vendor (`invoiceCount >= 3`). Below threshold → "Collecting vendor history".
