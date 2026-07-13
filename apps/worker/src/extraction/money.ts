/**
 * Money parsing and label-based extraction from OCR text; merges regex totals into AI output.
 */

/* --- PARSING --- */
const AMOUNT_PATTERN =
  /\$?\s*([\d,\s]+\.\d{2})/;

export function parseMoney(
  value: string | unknown
): number | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isNaN(value)
      ? null
      : value;
  }

  const cleaned = String(value)
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .trim();

  if (!cleaned) {
    return null;
  }

  const num = parseFloat(cleaned);

  return Number.isNaN(num)
    ? null
    : num;
}

function findAmountInText(
  text: string
): number | null {
  const match = text.match(
    AMOUNT_PATTERN
  );

  if (!match) {
    return null;
  }

  return parseMoney(match[1]);
}

function normalizeLabel(
  value: string
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/:$/, "");
}

/* --- LABEL-BASED EXTRACTION --- */
export function extractMoney(
  text: string,
  label: string
): number | null {
  const labelNorm =
    label.toLowerCase();

  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const parts = line.split("\t");

    if (parts.length >= 2) {
      const fieldLabel =
        normalizeLabel(parts[0]);

      if (
        fieldLabel === labelNorm ||
        fieldLabel.startsWith(
          `${labelNorm}:`
        )
      ) {
        for (
          let i = 1;
          i < parts.length;
          i++
        ) {
          const amount =
            findAmountInText(
              parts[i]
            );

          if (amount != null) {
            return amount;
          }
        }
      }
    }

    const inline = new RegExp(
      `(?:^|[\\t\\s])${label}\\s*:?\\s*(.+)$`,
      "i"
    );

    const inlineMatch =
      line.match(inline);

    if (inlineMatch) {
      const amount =
        findAmountInText(
          inlineMatch[1]
        );

      if (amount != null) {
        return amount;
      }
    }
  }

  if (labelNorm === "total") {
    const totalRegex =
      /(?:^|[\t\s])Total\s*:?\s*\$?\s*([\d,\s]+\.\d{2})/gim;

    let match;

    while (
      (match =
        totalRegex.exec(text)) !== null
    ) {
      const prefix = text.slice(
        Math.max(
          0,
          match.index - 6
        ),
        match.index
      );

      if (
        !prefix
          .toLowerCase()
          .endsWith("sub")
      ) {
        return parseMoney(match[1]);
      }
    }

    return null;
  }

  const regex = new RegExp(
    `(?:^|[\\t\\s])${label}\\s*:?\\s*\\$?\\s*([\\d,\\s]+\\.\\d{2})`,
    "im"
  );

  const match = text.match(regex);

  if (!match) {
    return null;
  }

  return parseMoney(match[1]);
}

/* --- FINANCIAL FIELD BUNDLE --- */
export type FinancialFields = {
  subtotal: number | null;
  shipping: number | null;
  tax: number | null;
  discount: number | null;
  balanceDue: number | null;
  totalAmount: number | null;
};

/* --- EXTRACT ALL AMOUNTS FROM TEXT --- */
export function extractFinancialFields(
  text: string
): FinancialFields {
  const subtotal =
    extractMoney(text, "Subtotal");

  const shipping =
    extractMoney(text, "Shipping");

  const tax =
    extractMoney(text, "Tax");

  const discount =
    extractMoney(text, "Discount");

  const balanceDue =
    extractMoney(
      text,
      "Balance Due"
    );

  const total =
    extractMoney(text, "Total");

  const totalAmount =
    balanceDue ?? total ?? null;

  return {
    subtotal,
    shipping,
    tax,
    discount,
    balanceDue,
    totalAmount,
  };
}

/* --- MERGE OCR AMOUNTS INTO AI JSON --- */
export function mergeFinancialFields<
  T extends Record<string, unknown>
>(
  extracted: T,
  fromText: FinancialFields
): T {
  const merged = {
    ...extracted,
  } as T & FinancialFields;

  const fields: Array<
    keyof FinancialFields
  > = [
    "subtotal",
    "shipping",
    "tax",
    "discount",
    "balanceDue",
    "totalAmount",
  ];

  for (const field of fields) {
    const textValue =
      fromText[field];

    if (textValue == null) {
      continue;
    }

    const current = parseMoney(
      merged[field as keyof T] as unknown
    );

    const suspiciouslyLow =
      current != null &&
      current < 10 &&
      textValue > 100;

    const missing =
      current == null;

    if (
      missing ||
      suspiciouslyLow
    ) {
      (merged as FinancialFields)[
        field
      ] = textValue;
    }
  }

  return merged;
}
