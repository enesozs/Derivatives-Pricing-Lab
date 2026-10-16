# Derivatives Pricing Lab as one container: the built React app served by the FastAPI API.
#   docker build -t derivlab .
#   docker run -p 8000:8000 derivlab        → http://localhost:8000
# On Render (render.yaml), the platform sets $PORT and the same image runs unchanged.

# --- 1. Build the web app (the Learn pages also bundle docs/*.md) ---------------------------
FROM node:24-alpine AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
COPY docs/ /src/docs/
RUN npm run build

# --- 2. Python runtime: the pricing library and API ----------------------------------------
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DERIVLAB_STATIC_DIR=/app/static \
    PORT=8000
WORKDIR /app
COPY backend /tmp/derivlab
RUN pip install "/tmp/derivlab[api]" && rm -rf /tmp/derivlab
COPY --from=web /src/frontend/dist /app/static
RUN useradd --create-home --uid 10001 derivlab
USER derivlab
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/api/health', timeout=4)"
CMD ["sh", "-c", "exec uvicorn derivlab_api.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers"]
