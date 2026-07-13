/**
 * Value normalisers shared by the heuristic and LLM extractors.
 * Deterministic, dependency-free, and unit-friendly.
 */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Reusable date matcher (numeric, ISO, or spelled-month forms). */
export const DATE_RE =
  /(\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{2,4})/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += y < 50 ? 2000 : 1900;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Best-effort ISO (yyyy-mm-dd) normalisation. Returns null when the string
 * can't be confidently parsed — callers keep the raw text in that case rather
 * than inventing a date.
 */
export function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();

  // yyyy-mm-dd / yyyy.mm.dd
  let m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]);

  // dd/mm/yyyy or mm/dd/yyyy — disambiguate by the >12 rule, default US (mm/dd).
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let a = +m[1];
    let b = +m[2];
    const y = +m[3];
    if (a > 12 && b <= 12) return iso(y, b, a); // clearly dd/mm
    return iso(y, a, b); // default mm/dd
  }

  // Month d, yyyy  (e.g. "May 1, 1943")
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{2,4})$/);
  if (m) {
    const mon = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mon) return iso(+m[3], mon, +m[2]);
  }

  // d Month yyyy  (e.g. "1 May 1943")
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{2,4})$/);
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon) return iso(+m[3], mon, +m[1]);
  }

  return null;
}

/** Detect the document currency from symbols/codes in the OCR text. */
export function detectCurrency(text: string): string | null {
  const t = text.toLowerCase();
  if (/₹|\brs\.?\b|\binr\b|gstin|\bgst\b/.test(t)) return "INR";
  if (/£|\bgbp\b/.test(text)) return "GBP";
  if (/€|\beur\b/.test(text)) return "EUR";
  if (/\$|\busd\b|\bdollars?\b/.test(t)) return "USD";
  if (/\baed\b|\bsar\b|\bsgd\b|\baud\b|\bcad\b/i.test(text)) {
    return (text.match(/\b(AED|SAR|SGD|AUD|CAD)\b/i)?.[1] ?? "").toUpperCase() || null;
  }
  return null;
}

/** Tidy an OCR vendor line: collapse whitespace, drop trailing punctuation. */
export function cleanVendorName(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/[\t\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[.,;:_\-\s]+$/g, "")
    .trim();
  return cleaned.length >= 2 ? cleaned : null;
}
