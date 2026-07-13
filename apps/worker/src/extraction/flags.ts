/**
 * Typed invoice flags with category (extraction / financial / fraud / procurement).
 */

/* --- TYPES & CATEGORY MAP --- */
export type FlagCategory =
  | "EXTRACTION"
  | "FINANCIAL"
  | "FRAUD"
  | "PROCUREMENT";

export type TypedFlag = {
  type: string;
  severity: string;
  message: string;
  flagCategory: FlagCategory;
};

const FLAG_CATEGORIES: Record<
  string,
  FlagCategory
> = {
  MISSING_INVOICE_NUMBER:
    "EXTRACTION",
  MISSING_VENDOR: "EXTRACTION",
  EXTRACTION_ERROR: "EXTRACTION",
  LOW_EXTRACTION_CONFIDENCE:
    "EXTRACTION",
  FINANCIAL_MISMATCH:
    "FINANCIAL",
  UNUSUAL_AMOUNT: "FINANCIAL",
  DUPLICATE_INVOICE: "FRAUD",
  FRAUD_RISK: "FRAUD",
  POSSIBLE_DUPLICATE_PAYMENT:
    "FRAUD",
  ROUND_AMOUNT_RISK: "FRAUD",
  UNUSUAL_INVOICE_DATE: "FRAUD",
  POSSIBLE_FRAUD: "FRAUD",
  PRICE_ANOMALY: "PROCUREMENT",
  SAVINGS_OPPORTUNITY:
    "PROCUREMENT",
  PROCUREMENT_SAVING_OPPORTUNITY:
    "PROCUREMENT",
};

/* --- CATEGORY LOOKUP --- */
export function getFlagCategory(
  type: string
): FlagCategory {
  return (
    FLAG_CATEGORIES[type] ??
    "FINANCIAL"
  );
}

/* --- FLAG FACTORY --- */
export function createFlag(
  type: string,
  severity: string,
  message: string
): TypedFlag {
  return {
    type,
    severity,
    message,
    flagCategory:
      getFlagCategory(type),
  };
}

/* --- RISK FILTER (excludes low-severity extraction noise) --- */
export function isBusinessRiskFlag(
  flag: TypedFlag
): boolean {
  return (
    flag.flagCategory !==
    "EXTRACTION"
  );
}
