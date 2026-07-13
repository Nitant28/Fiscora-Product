import QueueDashboardPanel from "../../../components/admin/QueueDashboardPanel";
import { getQueueDashboard } from "../../../lib/admin";

export default async function AdminQueuesPage() {
  const data = await getQueueDashboard().catch(() => ({
    queues: [],
    updatedAt: new Date().toISOString(),
  }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Notifications, email approvals, invoice OCR, and Tally
        export activity across async pipelines.
      </p>
      <QueueDashboardPanel
        queues={data.queues}
        updatedAt={data.updatedAt}
      />
    </div>
  );
}
