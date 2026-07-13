import ImportCsvForm from "../../../components/import/ImportCsvForm";

export default function ImportBudgetsPage() {
  return (
    <ImportCsvForm
      title="Import Budgets"
      description="Update budgets for existing departments. Department must already exist."
      endpoint="/api/proxy/import/budgets"
      formatHint="name,budget"
      sampleCsv={`name,budget
Marketing,1000000
IT,2000000
Finance,500000`}
    />
  );
}
