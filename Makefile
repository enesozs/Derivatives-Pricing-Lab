# Derivatives Pricing Lab — common tasks. Run from the project root.
PY := backend/.venv/bin

.PHONY: install dev api web test lint check build serve

install:            ## Create the Python venv and install both halves
	python3 -m venv backend/.venv
	$(PY)/pip install -q --upgrade pip
	$(PY)/pip install -q -e "backend[api,dev]"
	cd frontend && npm install

dev:                ## API on :8000 + Vite on :5173 (open http://localhost:5173)
	@trap 'kill 0' INT TERM EXIT; \
	$(MAKE) --no-print-directory api & \
	$(MAKE) --no-print-directory web & \
	wait

api:
	cd backend && .venv/bin/uvicorn derivlab_api.main:app --reload --port 8000

web:
	cd frontend && npm run dev

test:               ## Python test suite (fast tests only)
	cd backend && .venv/bin/pytest -q

lint:               ## Format + lint + type-check both halves
	cd backend && .venv/bin/ruff format . && .venv/bin/ruff check . && .venv/bin/pyright
	cd frontend && npx tsc -b && npm run lint

check: lint test    ## Everything CI would run
	cd frontend && npm run build

build:              ## Production build of the frontend (served by FastAPI from frontend/dist)
	cd frontend && npm run build

serve: build        ## Single process: API + built UI on http://localhost:8000
	cd backend && .venv/bin/uvicorn derivlab_api.main:app --port 8000
