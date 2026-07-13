/**
 * Human-readable label variants for invoice fields (used by regex/money label matching).
 */

/* --- FIELD LABEL ALIASES --- */
export const ALIASES = {
  invoiceNumber: [
    "invoice number",
    "invoice no",
    "invoice #",
    "inv #",
    "inv no",
    "document no",
    "reference number"
  ],

  totalAmount: [
    "total",
    "grand total",
    "amount payable"
  ],

  balanceDue: [
    "balance due",
    "amount due",
    "due amount"
  ]
};