import {
  exportTallyByType,
  getTallyExportSummary,
} from "../src/integrations/tally/tallyExport";
import { DEFAULT_TALLY_EXPORT_FILTERS } from "../src/integrations/tally/tallyGovernance";

async function main() {
  const summary = await getTallyExportSummary(
    DEFAULT_TALLY_EXPORT_FILTERS
  );

  console.log(
    "Summary",
    JSON.stringify(
      {
        vendors: summary.vendors,
        total: summary.totalVendors,
        excluded: summary.excludedVendors,
      },
      null,
      2
    )
  );

  const vendors = await exportTallyByType(
    "vendors",
    DEFAULT_TALLY_EXPORT_FILTERS,
    { id: 1, name: "Test CFO", role: "CFO" }
  );

  console.log(
    "Vendor count",
    vendors.count,
    "excluded",
    vendors.excludedCount
  );
  console.log("Header", vendors.columns.join(","));
  console.log(
    "Has garbage?",
    /INVOICE|OAS-41332|INVALIDGST|Alex Rivera/i.test(
      vendors.csv
    )
  );

  const invoices = await exportTallyByType(
    "invoices",
    DEFAULT_TALLY_EXPORT_FILTERS,
    { id: 1, name: "Test CFO", role: "CFO" }
  );

  const dup = (
    invoices.csv.match(/FRAUD-DEMO-INV-1001/g) ?? []
  ).length;
  console.log(
    "Invoice dup count",
    dup,
    "CGST",
    invoices.columns.includes("CGST")
  );

  const payments = await exportTallyByType(
    "payments",
    DEFAULT_TALLY_EXPORT_FILTERS,
    { id: 1, name: "Test CFO", role: "CFO" }
  );

  console.log("Payment header", payments.columns.join(","));
  console.log("Has PAY-", /PAY-2026/.test(payments.csv));
  console.log("Has 2012", /,2012-/.test(payments.csv));
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
