from app.domain.document.invoice.policies import InvoicePolicy


def test_invoice_policy_accepts_reasonable_confidence() -> None:
    policy = InvoicePolicy(minimum_confidence=0.55)
    assert policy.is_valid(0.7, "Example Vendor", "INV-1001")


def test_invoice_policy_rejects_missing_required_fields() -> None:
    policy = InvoicePolicy(minimum_confidence=0.55)
    assert not policy.is_valid(0.7, "", "INV-1001")
