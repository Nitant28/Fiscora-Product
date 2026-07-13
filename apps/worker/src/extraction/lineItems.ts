/**
 * Parses line-item tables from OCR text (tab- or space-separated rows between header and totals).
 */
import { parseMoney } from "./money";

/* --- TYPES --- */
export type ExtractedLineItem = {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
};

/* --- TABLE BOUNDARIES --- */
function isTableHeader(line: string) {
  const normalized = line
    .replace(/\t/g, " ")
    .toLowerCase();

  return (
    normalized.includes("item") &&
    normalized.includes("quantity") &&
    normalized.includes("rate") &&
    normalized.includes("amount")
  );
}

function isTableEnd(line: string) {
  const label = line
    .split("\t")[0]
    .trim()
    .toLowerCase();

  return (
    label.startsWith("subtotal") ||
    label.startsWith("shipping") ||
    label.startsWith("tax") ||
    label.startsWith("discount") ||
    label.startsWith("total") ||
    label.startsWith("notes") ||
    label.startsWith("terms")
  );
}

/* --- ROW PARSING --- */
function parseItemRow(
  line: string
): ExtractedLineItem | null {
  const tabParts = line.split("\t");

  if (tabParts.length >= 4) {
    const description =
      tabParts[0].trim();

    const quantity = parseFloat(
      tabParts[1].trim()
    );

      const rate = parseMoney(
      tabParts[2]
    );

    const amount = parseMoney(
      tabParts[3]
    );

    if (
      description &&
      !Number.isNaN(quantity) &&
      rate != null &&
      amount != null
    ) {
      return {
        description,
        quantity,
        rate,
        amount,
      };
    }
  }

  const spaceMatch = line.match(
    /^(.+?)\s+(\d+(?:\.\d+)?)\s+\$?\s*([\d,\s.]+)\s+\$?\s*([\d,\s.]+)\s*$/
  );

  if (!spaceMatch) {
    return null;
  }

  const rate = parseMoney(
    spaceMatch[3]
  );

  const amount = parseMoney(
    spaceMatch[4]
  );

  if (rate == null || amount == null) {
    return null;
  }

  return {
    description:
      spaceMatch[1].trim(),
    quantity: parseFloat(
      spaceMatch[2]
    ),
    rate,
    amount,
  };
}

/* --- MAIN EXTRACTOR --- */
export function extractLineItems(
  parsedText: string
): ExtractedLineItem[] {
  const lines = parsedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const items: ExtractedLineItem[] = [];
  let inTable = false;

  for (const line of lines) {
    if (isTableHeader(line)) {
      inTable = true;
      continue;
    }

    if (!inTable) {
      continue;
    }

    if (isTableEnd(line)) {
      break;
    }

    const item = parseItemRow(line);

    if (item) {
      items.push(item);
      continue;
    }

    const continuation = line
      .replace(/\t/g, " ")
      .trim();

    if (
      continuation &&
      items.length > 0
    ) {
      items[items.length - 1]
        .description +=
        ` ${continuation}`;
    }
  }

  return items;
}
