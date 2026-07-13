/**
 * Contracts List
 * Purpose: Active contract registry with utilization and expiration signals.
 * Data: GET /contracts (apiFetch).
 * Roles: contract.view.
 */
import Link from "next/link";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { Button } from "@repo/ui/button";
import StatusBadge from "../../components/StatusBadge";
import { formatINR } from "../../lib/metrics";
import { apiFetch } from "../../lib/api";

type ContractRow = {
  id: number;
  contractNumber: string;
  title: string;
  vendor: { id: number; name: string };
  value: number;
  utilized: number;
  remaining: number;
  utilizationPercent: number;
  endDate: string;
  status: string;
};

async function getContracts(): Promise<
  ContractRow[]
> {
  const res = await apiFetch("/contracts");
  if (!res.ok) return [];
  const data = await res.json();
  return data.contracts ?? [];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

export default async function ContractsPage() {
  const contracts = await getContracts();

  return (
    <PageContainer>
      <PageHeader
        title="Contracts"
        description="Contract repository and utilization"
        actions={
          <>
            <Link href="/contracts/intelligence">
              <Button variant="primary">Contract Intelligence</Button>
            </Link>
            <Link href="/contracts/renewals">
              <Button variant="secondary">Renewal Queue</Button>
            </Link>
          </>
        }
      />

      {contracts.length === 0 ? (
        <p className="text-gray-400">
          No contracts yet
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="px-6 py-4">
                  Contract
                </th>
                <th className="px-6 py-4">
                  Vendor
                </th>
                <th className="px-6 py-4">
                  Value
                </th>
                <th className="px-6 py-4">
                  Utilized
                </th>
                <th className="px-6 py-4">
                  Remaining
                </th>
                <th className="px-6 py-4">
                  End Date
                </th>
                <th className="px-6 py-4">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract) => (
                <tr
                  key={contract.id}
                  className="border-b hover:bg-gray-50"
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/contracts/${contract.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {contract.title}
                    </Link>
                    <p className="text-xs text-gray-400">
                      {contract.contractNumber}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/vendors/${contract.vendor.id}`}
                      className="hover:underline"
                    >
                      {contract.vendor.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    {formatINR(contract.value)}
                  </td>
                  <td className="px-6 py-4">
                    {formatINR(contract.utilized)}
                  </td>
                  <td className="px-6 py-4">
                    {formatINR(contract.remaining)}
                  </td>
                  <td className="px-6 py-4">
                    {formatDate(
                      contract.endDate
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge
                      status={
                        contract.status ??
                        "ACTIVE"
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
