/**
 * Tally import column mappings — India GST-ready enterprise field names.
 */

export const TALLY_VENDOR_COLUMNS = [
  "Vendor Code",
  "Vendor Name",
  "GSTIN",
  "PAN",
  "Vendor Type",
  "Contact Person",
  "Email",
  "Phone",
  "Address Line 1",
  "City",
  "State",
  "Country",
  "Payment Terms",
  "Risk Score",
  "Compliance Status",
  "Export Status",
] as const;

export const TALLY_PO_COLUMNS = [
  "PO Number",
  "Vendor Code",
  "Vendor Name",
  "Department",
  "Requester",
  "Approver",
  "PO Amount",
  "Tax Amount",
  "Total Amount",
  "Currency",
  "PO Date",
  "Delivery Date",
  "Status",
  "Linked Contract",
] as const;

export const TALLY_INVOICE_COLUMNS = [
  "Invoice Number",
  "Vendor",
  "Subtotal",
  "CGST",
  "SGST",
  "IGST",
  "Total Tax",
  "Grand Total",
  "Invoice Date",
  "Status",
  "Currency",
] as const;

export const TALLY_PAYMENT_COLUMNS = [
  "Payment ID",
  "Invoice Number",
  "Vendor",
  "Payment Method",
  "Bank Reference",
  "Amount",
  "Currency",
  "Due Date",
  "Payment Date",
  "Status",
  "Approval Status",
] as const;

export type TallyExportType =
  | "vendors"
  | "purchase-orders"
  | "invoices"
  | "payments";

export const TALLY_EXPORT_LABELS: Record<
  TallyExportType,
  { title: string; description: string; filename: string }
> = {
  vendors: {
    title: "Vendors",
    description:
      "Verified vendor master with GSTIN, PAN, and Tally readiness",
    filename: "fiscora-tally-vendors.csv",
  },
  "purchase-orders": {
    title: "Purchase Orders",
    description:
      "PO register with department, approver, and vendor governance",
    filename: "fiscora-tally-purchase-orders.csv",
  },
  invoices: {
    title: "Invoices",
    description:
      "Invoice register with CGST/SGST/IGST breakdown for Tally import",
    filename: "fiscora-tally-invoices.csv",
  },
  payments: {
    title: "Payments",
    description:
      "Payment register with business payment IDs and bank references",
    filename: "fiscora-tally-payments.csv",
  },
};

export function escapeCsvCell(
  value: string | number | null | undefined
): string {
  if (value == null) {
    return "";
  }

  const str = String(value);

  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function rowsToCsv(
  headers: readonly string[],
  rows: Record<string, string | number | null | undefined>[]
): string {
  const headerLine = headers
    .map((h) => escapeCsvCell(h))
    .join(",");

  const dataLines = rows.map((row) =>
    headers
      .map((header) => escapeCsvCell(row[header]))
      .join(",")
  );

  return [headerLine, ...dataLines].join("\r\n");
}
