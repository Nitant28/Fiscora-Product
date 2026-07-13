from fastapi import FastAPI
from enhancement.router import router as enhancement_router
from classification.router import router as classification_router

app = FastAPI(
    title="Fiscora AI",
    version="1.0.0"
)

app.include_router(enhancement_router)
app.include_router(classification_router)

@app.get("/")
async def root():
    return {
        "service": "Fiscora AI",
        "status": "running"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy"
    }