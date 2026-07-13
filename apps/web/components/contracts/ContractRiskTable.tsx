import Link from "next/link";
import ContractActionButtons, {
  type ContractActionContext,
} from "./ContractActionButtons";

type Row = {
  id: number;
  cells: string[];
  urgency?: "critical" | "warning" | "healthy";
  vendorId?: number;
};

type Props = {
  title: string;
  description: string;
  columns: string[];
  rows: Row[];
  actionContext?: ContractActionContext;
  canManage?: boolean;
};

const URGENCY_DOT = {
  critical: "bg-red-500",
  warning: "bg-amber-500",
  healthy: "bg-emerald-500",
};

export default function ContractRiskTable({
  title,
  description,
  columns,
  rows,
  actionContext,
  canManage = false,
}: Props) {
  const showActions = Boolean(
    actionContext && canManage
  );

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">
        {description}
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">
          No items in this view.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-3" />
                {columns.map((column) => (
                  <th
                    key={column}
                    className="py-2 pr-3 font-medium"
                  >
                    {column}
                  </th>
                ))}
                {showActions && (
                  <th className="py-2 pr-3 font-medium">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b last:border-0 align-top"
                >
                  <td className="py-3 pr-3">
                    {row.urgency && (
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${URGENCY_DOT[row.urgency]}`}
                      />
                    )}
                  </td>
                  {row.cells.map((cell, index) => (
                    <td
                      key={`${row.id}-${index}`}
                      className="py-3 pr-3"
                    >
                      {index === 0 &&
                      actionContext !==
                        "concentration" ? (
                        <Link
                          href={`/contracts/${row.id}`}
                          className="font-medium text-indigo-700 hover:underline"
                        >
                          {cell}
                        </Link>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                  {showActions && actionContext && (
                    <td className="py-3 pr-3 min-w-[220px]">
                      <ContractActionButtons
                        context={actionContext}
                        contractId={
                          actionContext ===
                          "concentration"
                            ? undefined
                            : row.id
                        }
                        vendorId={row.vendorId}
                        canManage={canManage}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
