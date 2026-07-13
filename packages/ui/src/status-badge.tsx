/**
 * StatusBadge — the single source of truth for status display across Fiscora.
 *
 * V2 additions:
 *   • dot variant — small colored dot, no pill
 *   • label override — show "Awaiting Review" instead of "PROCESSED"
 *   • size prop — sm | md | lg
 *   • Human-readable label mapping
 */
import { Badge, type BadgeTone, type BadgeSize } from "./badge";

const STATUS_TONES: Record<string, BadgeTone> = {
  // Success states
  APPROVED:          "success",
  PAID:              "success",
  ACTIVE:            "success",
  ACCEPTED:          "success",
  RECEIVED:          "success",
  AWARDED:           "success",
  MATCHED:           "success",
  VALID:             "success",
  VERIFIED:          "success",
  COMPLETED:         "success",
  LOW:               "success",
  HEALTHY:           "success",

  // Warning states
  SUBMITTED:         "warning",
  IN_REVIEW:         "warning",
  UNDER_REVIEW:      "warning",
  PARTIALLY_RECEIVED:"warning",
  READY:             "warning",
  MEDIUM:            "warning",
  PENDING_REVIEW:    "warning",
  PENDING_APPROVAL:  "warning",
  EXPIRING_SOON:     "warning",

  // Info / in-flight
  SENT:              "info",
  OPEN:              "info",
  SCHEDULED:         "info",
  CONVERTED_TO_PO:   "info",
  PROCESSING:        "info",
  INVITED:           "info",
  PROCESSED:         "info",

  // Danger
  REJECTED:          "danger",
  FAILED:            "danger",
  CANCELLED:         "danger",
  TERMINATED:        "danger",
  MISMATCH:          "danger",
  INVALID:           "danger",
  BUDGET_EXCEEDED:   "danger",
  BLOCKED:           "danger",
  ESCALATED:         "danger",
  SUSPENDED:         "danger",
  LOCKED:            "danger",
  HIGH:              "danger",
  CRITICAL:          "danger",
  DUPLICATE_GST:     "danger",
  INVALID_FORMAT:    "danger",
  OVERDUE:           "danger",

  // Neutral
  DRAFT:             "neutral",
  QUEUED:            "neutral",
  CLOSED:            "neutral",
  EXPIRED:           "neutral",
  PENDING:           "neutral",
  MISSING_GST:       "neutral",
  CLARIFICATION_REQUESTED: "info",
  UNKNOWN:           "neutral",
  ARCHIVED:          "neutral",
};

/** Human-readable label overrides — what users see */
const STATUS_LABELS: Record<string, string> = {
  PROCESSED:         "Awaiting Review",
  CONVERTED_TO_PO:   "PO Raised",
  PARTIALLY_RECEIVED:"Partial Receipt",
  PENDING_APPROVAL:  "Pending Approval",
  IN_REVIEW:         "In Review",
  UNDER_REVIEW:      "Under Review",
  BUDGET_EXCEEDED:   "Over Budget",
  CLARIFICATION_REQUESTED: "Clarification Needed",
  EXPIRING_SOON:     "Expiring Soon",
  DUPLICATE_GST:     "Duplicate GST",
  INVALID_FORMAT:    "Invalid Format",
  MISSING_GST:       "Missing GST",
};

export function resolveStatusTone(status: string): BadgeTone {
  return STATUS_TONES[status.toUpperCase()] ?? "neutral";
}

export function resolveStatusLabel(status: string): string {
  const upper = status.toUpperCase();
  if (STATUS_LABELS[upper]) return STATUS_LABELS[upper];
  // Convert snake_case to Title Case
  return upper
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({
  status,
  label,
  size = "md",
  dot = false,
  className,
}: {
  status?: string | null;
  /** Override the displayed label */
  label?: string;
  size?: BadgeSize;
  /** Show as a dot-only indicator */
  dot?: boolean;
  className?: string;
}) {
  const normalized =
    typeof status === "string" && status.trim()
      ? status.trim().toUpperCase()
      : "UNKNOWN";

  const displayLabel = label ?? resolveStatusLabel(normalized);
  const tone = resolveStatusTone(normalized);

  return (
    <Badge
      tone={tone}
      size={size}
      dot={dot}
      className={className}
    >
      {dot ? null : displayLabel}
    </Badge>
  );
}
