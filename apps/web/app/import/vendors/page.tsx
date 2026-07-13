import ImportCsvForm from "../../../components/import/ImportCsvForm";

export default function ImportVendorsPage() {
  return (
    <ImportCsvForm
      title="Import Vendors"
      description="Upload your vendor master. Duplicate names within your company are rejected."
      endpoint="/api/proxy/import/vendors"
      formatHint="name,email,paymentTerms"
      sampleCsv={`name,email,paymentTerms
Dell,dell@corp.com,NET30
HP,hp@corp.com,NET45
Tata Steel,procurement@tata.com,NET60`}
    />
  );
}
