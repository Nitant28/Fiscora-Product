from pathlib import Path

from PIL import Image

from app.orchestrator.engine import PipelineEngine


def test_pipeline_engine_processes_invoice_image(tmp_path: Path) -> None:
    image_path = tmp_path / "INV-1001.png"
    image = Image.new("RGB", (220, 120), color="white")
    image.save(image_path)

    engine = PipelineEngine()
    result = engine.run_file(image_path)

    assert result["document_type"] == "invoice"
    assert result["invoice_number"] == "1001"
    assert result["confidence"] >= 0.0
    assert result["status"] == "validated"
