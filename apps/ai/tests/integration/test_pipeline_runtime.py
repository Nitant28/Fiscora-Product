from app.orchestrator.engine import PipelineEngine


def test_pipeline_engine_runtime_smoke() -> None:
    engine = PipelineEngine()
    result = engine.run_file("./tests/fixtures/invoice_sample.png")
    assert result["document_type"] == "invoice"
