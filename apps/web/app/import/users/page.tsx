import ImportCsvForm from "../../../components/import/ImportCsvForm";

export default function ImportUsersPage() {
  return (
    <ImportCsvForm
      title="Import Users"
      description="Departments must exist before import. Default password: Welcome@123"
      endpoint="/api/proxy/import/users"
      formatHint="name,email,role,department"
      sampleCsv={`name,email,role,department
Rahul Sharma,rahul@company.com,MANAGER,Finance
Meera Iyer,cfo@company.com,CFO,Finance
Anika Patel,anika@company.com,PROCUREMENT,Procurement`}
    />
  );
}
