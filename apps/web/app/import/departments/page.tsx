import ImportCsvForm from "../../../components/import/ImportCsvForm";

export default function ImportDepartmentsPage() {
  return (
    <ImportCsvForm
      title="Import Departments"
      description="Creates departments and assigns budgets in one operation."
      endpoint="/api/proxy/import/departments"
      formatHint="name,budget"
      sampleCsv={`name,budget
IT,2000000
Marketing,1000000
Finance,1500000
Operations,800000`}
    />
  );
}
