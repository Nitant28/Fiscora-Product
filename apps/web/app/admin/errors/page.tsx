import ErrorCenterPanel from "../../../components/admin/ErrorCenterPanel";
import { getAdminErrors } from "../../../lib/admin";

export default async function AdminErrorsPage() {
  const data = await getAdminErrors(50).catch(() => ({
    errors: [],
    nextCursor: null,
    hasMore: false,
  }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Latest API exceptions with request ID correlation for
        support and incident response.
      </p>
      <ErrorCenterPanel errors={data.errors} />
    </div>
  );
}
