import { apiFetch } from "./api";
import type {
  TallyExportFilters,
  TallyExportSummary,
} from "./tally-types";
import {
  DEFAULT_TALLY_FILTERS,
  filtersQueryString,
} from "./tally-types";

export type {
  TallyExportFilters,
  TallyExportHistoryRow,
  TallyExportSummary,
  TallyExportType,
  TallyReadinessRow,
} from "./tally-types";
export {
  DEFAULT_TALLY_FILTERS,
  tallyDownloadUrl,
} from "./tally-types";

export async function getTallyExportSummary(
  filters: TallyExportFilters = DEFAULT_TALLY_FILTERS
): Promise<TallyExportSummary> {
  const res = await apiFetch(
    `/integrations/tally/summary?${filtersQueryString(filters)}`
  );

  if (!res.ok) {
    throw new Error("Failed to load Tally export summary");
  }

  return res.json();
}
