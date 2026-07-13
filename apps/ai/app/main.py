from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.logger import configure_logging, logger

configure_logging()

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
)

# Lazy singleton — importing the heavy pipeline (cv2, runtime) is deferred until
# the first extraction request so `/health` stays cheap.
_engine = None


def get_engine():
    global _engine
    if _engine is None:
        from app.orchestrator.engine import PipelineEngine

        _engine = PipelineEngine()
    return _engine


@app.on_event("startup")
async def startup():
    logger.info(
        "Fiscora AI started",
        version=settings.APP_VERSION,
        environment=settings.APP_ENV,
        device=settings.DEVICE,
        gemini=bool(settings.GEMINI_API_KEY),
    )


@app.get("/")
async def root():
    return {
        "application": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/v1/extract")
async def extract(file: UploadFile = File(...)):
    """Run the full document-intelligence pipeline on an uploaded file.

    This is the single boundary the worker (and any client) calls — no AI logic
    leaks outside the platform. Returns the structured document with per-field
    confidence and provenance.
    """
    suffix = Path(file.filename or "upload").suffix or ".bin"
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(data)
        tmp.close()
        result = await run_in_threadpool(get_engine().run_file, tmp.name)
        result["file_name"] = file.filename
        return result
    except Exception as exc:  # surface a clean error; worker falls back locally
        logger.warning("extract.failed", error=str(exc), file=file.filename)
        raise HTTPException(status_code=500, detail=f"Extraction failed: {exc}") from exc
    finally:
        try:
            Path(tmp.name).unlink(missing_ok=True)
        except OSError:
            pass
