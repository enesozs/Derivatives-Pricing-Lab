"""FastAPI application.

Dev: `fastapi dev` (entrypoint in pyproject.toml); Vite proxies /api to it.
If the frontend has been built (`frontend/dist`), it is served from `/` with client-side routing
fallback, so the whole lab can run as a single process.
"""

import os
from pathlib import Path

from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import JSONResponse

from .routes import (
    credit,
    exotics,
    hedging,
    multi_asset,
    rates,
    strategies,
    structured,
    vanilla,
    volatility,
)

app = FastAPI(title="Derivatives Pricing Lab API", version="0.8.0")

api = APIRouter(prefix="/api")
api.include_router(vanilla.router)
api.include_router(strategies.router)
api.include_router(hedging.router)
api.include_router(volatility.router)
api.include_router(exotics.router)
api.include_router(multi_asset.router)
api.include_router(rates.router)
api.include_router(structured.router)
api.include_router(credit.router)


@api.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@api.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
def api_not_found(path: str) -> JSONResponse:
    # Registered last: keeps unknown /api paths from falling through to the web app's index.html.
    return JSONResponse(status_code=404, content={"detail": f"Unknown API endpoint '/api/{path}'"})


app.include_router(api)


@app.exception_handler(ValueError)
async def value_error(_: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})


# The built UI: next to the source tree in development, or wherever DERIVLAB_STATIC_DIR points
# (the Docker image installs the package and copies the build to /app/static).
FRONTEND_DIST = Path(
    os.environ.get("DERIVLAB_STATIC_DIR")
    or Path(__file__).resolve().parents[3] / "frontend" / "dist"
)
if FRONTEND_DIST.is_dir():
    # Low priority: /api routes match first, then static files, then the SPA fallback.
    app.frontend("/", directory=FRONTEND_DIST, fallback="index.html")
