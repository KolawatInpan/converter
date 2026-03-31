import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.japan_routes import router as japan_router
from app.routes.pdf_routes import router as pdf_router

app = FastAPI(title="PDF Converter API")


def get_allowed_origins() -> list[str]:
    default_origins = [
        "http://localhost:5001",
        "http://127.0.0.1:5001",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    configured = os.getenv("CORS_ALLOW_ORIGINS", "").strip()
    if configured:
        merged: list[str] = []
        for origin in [*configured.split(","), *default_origins]:
            normalized = origin.strip()
            if normalized and normalized not in merged:
                merged.append(normalized)
        return merged

    return default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(pdf_router, prefix="/api/pdf", tags=["PDF"])
app.include_router(japan_router, prefix="/api/japan", tags=["JAPAN"])


@app.get("/api")
async def root():
    return {"message": "PDF Converter API is running"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=5000, reload=True)
