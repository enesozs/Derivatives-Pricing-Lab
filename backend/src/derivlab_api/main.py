"""FastAPI application. Dev: `uvicorn derivlab_api.main:app --reload` (Vite proxies /api).

If the frontend has been built (`frontend/dist`), it is served from `/` so the whole lab
runs as a single process.
"""

from pathlib import Path

from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .routes import vanilla

app = FastAPI(title="Derivatives Pricing Lab API", version="0.1.0")

api = APIRouter(prefix="/api")
api.include_router(vanilla.router)


@api.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api)


@app.exception_handler(ValueError)
async def value_error(_: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})


FRONTEND_DIST = Path(__file__).resolve().parents[3] / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
