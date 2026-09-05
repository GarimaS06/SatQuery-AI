from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api.routes import router


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "outputs"

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


app = FastAPI(
    title="SatQuery Router",
    version="0.1.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.mount(
    "/api/router/files",
    StaticFiles(directory=str(OUTPUT_DIR)),
    name="router-files",
)


app.include_router(router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "satquery-router",
    }