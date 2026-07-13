/**
 * Minimal CSV parser for Import Center — no external dependencies.
 */
export type CsvRow = Record<string, string>;

export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const normalized = text.replace(/^\uFEFF/, "").trim();
  if (!normalized) {
    return { headers: [], rows: [] };
  }

  const lines = normalized.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = splitCsvLine(lines[0]!).map(normalizeHeader);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    if (cells.every((cell) => !cell.trim())) {
      continue;
    }

    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? "").trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, "");
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export function pick(row: CsvRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key] ?? row[key.toLowerCase()];
    if (value?.trim()) {
      return value.trim();
    }
  }
  return "";
}
