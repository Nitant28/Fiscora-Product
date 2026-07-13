"""
Value normalisers used by the resolvers. Deterministic and dependency-free so
they are trivially unit-testable and identical across every document type.
"""

from __future__ import annotations

import re
from typing import Optional

_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

DATE_RE = re.compile(
    r"(\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}"
    r"|\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}"
    r"|[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{2,4}"
    r"|\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{2,4})"
)

# OCR digit confusions corrected only inside clearly-numeric contexts.
_DIGIT_FIX = str.maketrans({"O": "0", "o": "0", "l": "1", "I": "1", "S": "5", "B": "8", "_": "."})

_MONEY_RE = re.compile(r"-?\d[\d,\s]*(?:\.\d{1,2})?")


def parse_money(value: object) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return None if (isinstance(value, float) and value != value) else float(value)

    text = str(value).strip()
    if not text:
        return None
    # Repair common OCR noise ($44_50 -> 44.50, SO.089 handled by digit-fix).
    text = text.replace("$", "").replace("₹", "").replace("£", "").replace("€", "")
    candidate = text.translate(_DIGIT_FIX)
    m = _MONEY_RE.search(candidate)
    if not m:
        return None
    cleaned = m.group(0).replace(",", "").replace(" ", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _iso(y: int, m: int, d: int) -> Optional[str]:
    if y < 100:
        y += 2000 if y < 50 else 1900
    if not (1 <= m <= 12 and 1 <= d <= 31 and 1900 <= y <= 2100):
        return None
    return f"{y:04d}-{m:02d}-{d:02d}"


def normalize_date(raw: Optional[str]) -> Optional[str]:
    """Best-effort ISO (yyyy-mm-dd). Returns None when not confidently parseable."""
    if not raw:
        return None
    s = raw.strip()

    m = re.match(r"^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$", s)
    if m:
        return _iso(int(m[1]), int(m[2]), int(m[3]))

    m = re.match(r"^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$", s)
    if m:
        a, b, y = int(m[1]), int(m[2]), int(m[3])
        if a > 12 and b <= 12:
            return _iso(y, b, a)  # unambiguous dd/mm
        return _iso(y, a, b)  # default mm/dd

    m = re.match(r"^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{2,4})$", s)
    if m:
        mon = _MONTHS.get(m[1][:3].lower())
        if mon:
            return _iso(int(m[3]), mon, int(m[2]))

    m = re.match(r"^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{2,4})$", s)
    if m:
        mon = _MONTHS.get(m[2][:3].lower())
        if mon:
            return _iso(int(m[3]), mon, int(m[1]))

    return None


def detect_currency(text: str) -> Optional[str]:
    t = text.lower()
    if re.search(r"₹|\brs\.?\b|\binr\b|gstin|\bgst\b", t):
        return "INR"
    if "£" in text or re.search(r"\bgbp\b", t):
        return "GBP"
    if "€" in text or re.search(r"\beur\b", t):
        return "EUR"
    if "$" in text or re.search(r"\busd\b|\bdollar", t):
        return "USD"
    m = re.search(r"\b(AED|SAR|SGD|AUD|CAD)\b", text, re.IGNORECASE)
    return m.group(1).upper() if m else None
