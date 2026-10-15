"""FastAPI application.

Dev: `fastapi dev` (entrypoint in pyproject.toml); Vite proxies /api to it.
If the frontend has been built (`frontend/dist`), it is served from `/` with client-side routing
fallback, so the whole lab can run as a single process.
"""

from pathlib import Path

from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import JSONResponse

from .routes import exotics, hedging, multi_asset, strategies, vanilla, volatility

app = FastAPI(title="Derivatives Pricing Lab API", version="0.5.0")

api = APIRouter(prefix="/api")
api.include_router(vanilla.router)
api.include_router(strategies.router)
api.include_router(hedging.router)
api.include_router(volatility.router)
api.include_router(exotics.router)
api.include_router(multi_asset.router)


@api.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api)


@app.exception_handler(ValueError)
async def value_error(_: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})


FRONTEND_DIST = Path(__file__).resolve().parents[3] / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    # Low priority: /api routes match first, then static files, then the SPA fallback.
    app.frontend("/", directory=FRONTEND_DIST)
