/**
 * StatusBadge (web) — now delegates to the Fiscora Design System.
 * Kept as a default export so existing imports across the app keep working
 * while the unified status component lives in @repo/ui.
 */
import { StatusBadge as DSStatusBadge } from "@repo/ui/status-badge";

type Props = {
  status?: string | null;
};

export default function StatusBadge({ status }: Props) {
  return <DSStatusBadge status={status} />;
}
