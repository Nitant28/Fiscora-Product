import SystemHealthWidget, {
  OverallStatusBanner,
} from "../../../components/admin/SystemHealthWidget";
import { getSystemStatus } from "../../../lib/admin";

export default async function AdminSystemPage() {
  const status = await getSystemStatus().catch(() => ({
    overall: "critical" as const,
    uptime: 0,
    version: {
      version: "—",
      build: "—",
      environment: "unknown",
    },
    components: [],
    timestamp: new Date().toISOString(),
  }));

  return (
    <div className="space-y-6">
      <OverallStatusBanner
        status={status.overall}
        uptime={status.uptime}
        version={`${status.version.version} (${status.version.environment})`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {status.components.map((component) => (
          <SystemHealthWidget
            key={component.id}
            label={component.label}
            status={component.status}
            detail={component.detail}
          />
        ))}
      </div>
    </div>
  );
}
