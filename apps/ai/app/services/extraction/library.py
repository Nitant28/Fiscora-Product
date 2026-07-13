"""
Schema library — the registry of supported document types.

Each entry is pure data. New document types are onboarded here without touching
the extraction engine, keeping the platform extensible (Rule 3 / Rule 14).
"""

from __future__ import annotations

from app.services.extraction.schema import (
    BusinessRuleRef,
    DocumentSchema,
    FieldRole,
    FieldSpec,
    TableSpec,
    ValueKind,
)

_COMMON_HEADER = (
    FieldSpec("invoice_number", ValueKind.IDENTIFIER, FieldRole.HEADER, required=True,
              aliases=("invoice number", "invoice no", "invoice #", "inv no", "bill no", "invoice"),
              weight=1.5),
    FieldSpec("invoice_date", ValueKind.DATE, FieldRole.HEADER, required=True,
              aliases=("invoice date", "bill date", "date of issue", "dated", "date"),
              weight=1.5),
    FieldSpec("due_date", ValueKind.DATE, FieldRole.HEADER,
              aliases=("due date", "payment due", "due by", "pay by")),
    FieldSpec("po_number", ValueKind.IDENTIFIER, FieldRole.HEADER,
              aliases=("po number", "purchase order", "p.o.", "po no", "po #")),
    FieldSpec("currency", ValueKind.CURRENCY, FieldRole.HEADER,
              aliases=("currency",)),
    FieldSpec("tax_id", ValueKind.TAX_ID, FieldRole.HEADER,
              aliases=("gstin", "gst no", "tax id", "vat", "pan")),
    FieldSpec("payment_terms", ValueKind.STRING, FieldRole.HEADER,
              aliases=("payment terms", "terms")),
)

_PARTIES = (
    FieldSpec("vendor_name", ValueKind.STRING, FieldRole.PARTY, required=True,
              aliases=("from", "seller", "vendor", "supplier", "sold by", "bill from"),
              weight=2.0),
    FieldSpec("customer_name", ValueKind.STRING, FieldRole.PARTY,
              aliases=("bill to", "sold to", "customer", "buyer", "account holder", "to")),
)

_MONEY = (
    FieldSpec("subtotal", ValueKind.MONEY, FieldRole.TOTAL,
              aliases=("subtotal", "sub total", "sub-total", "net amount")),
    FieldSpec("tax", ValueKind.MONEY, FieldRole.TOTAL,
              aliases=("tax", "gst", "vat", "cgst", "sgst", "igst")),
    FieldSpec("shipping", ValueKind.MONEY, FieldRole.TOTAL,
              aliases=("shipping", "freight", "delivery")),
    FieldSpec("discount", ValueKind.MONEY, FieldRole.TOTAL,
              aliases=("discount", "less")),
    FieldSpec("total", ValueKind.MONEY, FieldRole.TOTAL, required=True,
              aliases=("balance due", "amount due", "total due", "grand total", "total payable", "total", "amount"),
              negative_aliases=("subtotal", "sub total", "sub-total"),
              weight=2.5),
)

_INVOICE_TABLE = TableSpec()

INVOICE = DocumentSchema(
    doc_type="invoice",
    version="1.0",
    fields=(*_PARTIES, *_COMMON_HEADER, *_MONEY),
    rules=(
        BusinessRuleRef("required_fields"),
        BusinessRuleRef("totals_math"),
        BusinessRuleRef("date_order", "medium"),
        BusinessRuleRef("currency_present", "low"),
    ),
    table=_INVOICE_TABLE,
    classifier_keywords=("invoice", "tax invoice", "bill to", "amount due", "invoice no"),
)

PURCHASE_ORDER = DocumentSchema(
    doc_type="purchase_order",
    version="1.0",
    fields=(
        FieldSpec("po_number", ValueKind.IDENTIFIER, FieldRole.HEADER, required=True,
                  aliases=("po number", "purchase order", "p.o.", "po no", "po #"), weight=2.0),
        FieldSpec("invoice_date", ValueKind.DATE, FieldRole.HEADER,
                  aliases=("order date", "date", "po date")),
        FieldSpec("vendor_name", ValueKind.STRING, FieldRole.PARTY, required=True,
                  aliases=("supplier", "vendor", "to", "bill from"), weight=2.0),
        FieldSpec("customer_name", ValueKind.STRING, FieldRole.PARTY,
                  aliases=("ship to", "buyer", "from", "deliver to")),
        FieldSpec("currency", ValueKind.CURRENCY, FieldRole.HEADER, aliases=("currency",)),
        *_MONEY,
    ),
    rules=(BusinessRuleRef("required_fields"), BusinessRuleRef("totals_math")),
    table=_INVOICE_TABLE,
    classifier_keywords=("purchase order", "po number", "p.o.", "order date", "ship to"),
)

RECEIPT = DocumentSchema(
    doc_type="receipt",
    version="1.0",
    fields=(
        FieldSpec("vendor_name", ValueKind.STRING, FieldRole.PARTY, required=True,
                  aliases=("merchant", "store", "from"), weight=2.0),
        FieldSpec("invoice_date", ValueKind.DATE, FieldRole.HEADER,
                  aliases=("date", "receipt date")),
        FieldSpec("invoice_number", ValueKind.IDENTIFIER, FieldRole.HEADER,
                  aliases=("receipt no", "receipt #", "ref", "invoice", "no")),
        FieldSpec("currency", ValueKind.CURRENCY, FieldRole.HEADER, aliases=("currency",)),
        FieldSpec("tax", ValueKind.MONEY, FieldRole.TOTAL, aliases=("tax", "gst", "vat")),
        FieldSpec("total", ValueKind.MONEY, FieldRole.TOTAL, required=True,
                  aliases=("total", "amount", "paid", "balance due"), weight=2.5),
    ),
    rules=(BusinessRuleRef("required_fields", "medium"),),
    table=_INVOICE_TABLE,
    classifier_keywords=("receipt", "thank you", "cash", "change", "luncheon", "confections"),
)

CREDIT_NOTE = DocumentSchema(
    doc_type="credit_note",
    version="1.0",
    fields=(*_PARTIES, *_COMMON_HEADER, *_MONEY),
    rules=(BusinessRuleRef("required_fields"), BusinessRuleRef("totals_math")),
    table=_INVOICE_TABLE,
    classifier_keywords=("credit note", "credit memo", "cn no"),
)

UTILITY_BILL = DocumentSchema(
    doc_type="utility_bill",
    version="1.0",
    fields=(
        FieldSpec("vendor_name", ValueKind.STRING, FieldRole.PARTY,
                  aliases=("from", "provider", "utility")),
        FieldSpec("customer_name", ValueKind.STRING, FieldRole.PARTY,
                  aliases=("account holder", "customer", "name")),
        FieldSpec("invoice_number", ValueKind.IDENTIFIER, FieldRole.HEADER,
                  aliases=("account number", "account no", "bill number", "invoice")),
        FieldSpec("invoice_date", ValueKind.DATE, FieldRole.HEADER,
                  aliases=("bill date", "statement date", "date")),
        FieldSpec("due_date", ValueKind.DATE, FieldRole.HEADER,
                  aliases=("due date", "payment due")),
        FieldSpec("tax", ValueKind.MONEY, FieldRole.TOTAL, aliases=("tax", "utility tax")),
        FieldSpec("total", ValueKind.MONEY, FieldRole.TOTAL, required=True,
                  aliases=("total amount due", "amount due", "balance due", "total", "amount"),
                  weight=2.5),
    ),
    rules=(BusinessRuleRef("required_fields", "medium"),),
    classifier_keywords=("utility", "electric", "gas", "kwh", "therms", "meter", "rate code", "usage"),
)

SCHEMA_LIBRARY: dict[str, DocumentSchema] = {
    s.doc_type: s
    for s in (INVOICE, PURCHASE_ORDER, RECEIPT, CREDIT_NOTE, UTILITY_BILL)
}

# Fallback when the classifier is unsure — the invoice schema is the superset.
DEFAULT_SCHEMA = INVOICE


def get_schema(doc_type: str | None) -> DocumentSchema:
    if not doc_type:
        return DEFAULT_SCHEMA
    return SCHEMA_LIBRARY.get(doc_type, DEFAULT_SCHEMA)


def classify(text: str) -> str:
    """Lightweight keyword classifier. Returns the best-matching doc_type.

    A real deployment can swap this for a trained classifier without touching the
    extraction engine — it only needs to return a key present in SCHEMA_LIBRARY.
    """
    t = text.lower()
    best, best_score = DEFAULT_SCHEMA.doc_type, 0
    for doc_type, schema in SCHEMA_LIBRARY.items():
        score = sum(1 for kw in schema.classifier_keywords if kw in t)
        if score > best_score:
            best, best_score = doc_type, score
    return best
