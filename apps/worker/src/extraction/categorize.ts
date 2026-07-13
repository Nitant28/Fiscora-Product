/**
 * Spend category inference from line-item descriptions (keyword scoring + token fallback).
 */

/* --- CATEGORY KEYWORDS --- */
const CATEGORY_KEYWORDS: Record<
  string,
  string[]
> = {
  Furniture: [
    "bookcase",
    "bookcases",
    "book case",
    "chair",
    "armchair",
    "desk",
    "table",
    "shelf",
    "shelving",
    "cabinet",
    "furniture",
    "sofa",
    "stool",
    "rack",
    "credenza",
    "file cabinet",
    "workstation",
    "fur-bo",
    "fur-ch",
    "fur-de",
  ],
  Technology: [
    "laptop",
    "monitor",
    "printer",
    "computer",
    "phone",
    "tablet",
    "keyboard",
    "mouse",
    "server",
    "router",
    "headset",
    "webcam",
    "dock",
    "tech-",
  ],
  "Office Supplies": [
    "paper",
    "pen",
    "pencil",
    "stapler",
    "notebook",
    "binder",
    "folder",
    "marker",
    "envelope",
    "tape",
    "clip",
    "off-",
  ],
  Food: [
    "coffee",
    "tea",
    "snack",
    "water",
    "beverage",
    "catering",
    "lunch",
    "food",
  ],
  Shipping: [
    "shipping",
    "freight",
    "delivery",
    "postage",
  ],
  Equipment: [
    "machine",
    "equipment",
    "tool",
    "motor",
    "engine",
    "appliance",
  ],
};

/* --- TEXT NORMALIZATION --- */
function normalizeText(
  description: string
): string {
  return description
    .toLowerCase()
    .replace(/[_/\\|]/g, " ")
    .replace(/[^a-z0-9\s,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractProductTokens(
  text: string
): string[] {
  return text
    .split(/[\s,]+/)
    .filter(
      (token) =>
        token.length >= 4 &&
        !/^\d+$/.test(token)
    );
}

/* --- PRIMARY CATEGORIZATION --- */
export function categorizeItem(
  description: string
): string {
  const text =
    normalizeText(description);

  if (!text) {
    return "Other";
  }

  let bestMatch: {
    category: string;
    score: number;
  } | null = null;

  for (const [
    category,
    keywords,
  ] of Object.entries(
    CATEGORY_KEYWORDS
  )) {
    for (const keyword of keywords) {
      if (!text.includes(keyword)) {
        continue;
      }

      const score =
        keyword.length +
        (text.includes(
          ` ${keyword} `
        ) ||
        text.startsWith(keyword) ||
        text.endsWith(keyword)
          ? 5
          : 0);

      if (
        !bestMatch ||
        score > bestMatch.score
      ) {
        bestMatch = {
          category,
          score,
        };
      }
    }
  }

  if (bestMatch) {
    return bestMatch.category;
  }

  const tokens =
    extractProductTokens(text);

  for (const token of tokens) {
    for (const [
      category,
      keywords,
    ] of Object.entries(
      CATEGORY_KEYWORDS
    )) {
      if (
        keywords.some(
          (keyword) =>
            keyword.includes(token) ||
            token.includes(keyword)
        )
      ) {
        return category;
      }
    }
  }

  return "Other";
}

/* --- BATCH RECATEGORIZE --- */
export function recategorizeAllItems(
  items: {
    description: string;
    category?: string | null;
  }[]
) {
  return items.map((item) => ({
    ...item,
    category: categorizeItem(
      item.description
    ),
  }));
}
