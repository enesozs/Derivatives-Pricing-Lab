# AGENTS.md — Derivatives Pricing Lab

Reference for any agent (or human) working on this project. Read this before changing code.
Keep it current: when a roadmap item is finished or a decision changes, update this file in the same change.

---

## 1. Goal

Build a **derivatives pricing lab**: a tested Python pricing library, an HTTP API over it, and a
polished web app that prices, risk-manages and explains derivatives. Scope grows from vanilla equity
options to **exotic derivatives** (path-dependent, multi-asset and structured payoffs) and
non-equity products (rates).

It is an **educational research tool**, not a trading system. Priorities, in order:

1. **Correctness.** Every price is validated against a closed form, a reference library (QuantLib)
   or a convergence study. A fast wrong number is worthless.
2. **Clarity.** Code reads like the math. Each engine states its model, assumptions and the
   numerical error it introduces. The UI explains what the user is looking at.
3. **Extensibility.** Adding a product, model or numerical method must not require editing the
   others (see §3).
4. **Performance and polish.** Only after 1–3; optimise where profiling shows a hot spot.

The owner is learning the subject while building it, so docstrings, UI copy and `docs/` notes
should explain *why*, not just *what*.

---

## 2. Current state (2026-10-15)

- The legacy Streamlit project (`options_lab`) was **deleted** for a fresh start. Nothing from it
  remains except the ideas and reference values carried into the new tests.
- **MVP is built and working**: a vanilla-options page with three pricing methods, Greeks, value and
  Greek curves across spot, a method comparison table, and tree and Monte Carlo convergence studies.
  - Library: `AnalyticEngine` (Black–Scholes + analytic Greeks), `CRREngine` (European/American,
    tree Greeks), `MonteCarloEngine` (path-based, antithetic + control variate), research helpers.
  - API: `POST /api/vanilla/{price,profile,convergence}`, `GET /api/health`.
  - Tests: 44 backend tests (reference values, parity property test, convergence, API).
- Not a git repository yet (see §7).

---

## 3. Architecture

Three layers, each depending only on the one below it:

```
frontend/  React + TypeScript UI ── fetch /api/* ──▶  backend/src/derivlab_api/  FastAPI
                                                          │  JSON ⇄ library objects, no math
                                                          ▼
                                                     backend/src/derivlab/  pricing library
                                                          (NumPy/SciPy, no web dependencies)
```

Inside the library, the core idea is borrowed from QuantLib. **What is traded**, **the market**,
**how the market moves** and **how we compute the price** live in separate layers. Any engine
that supports an (instrument, model) pair can price it.

```
Instrument  (contract terms only: payoff + exercise + features like barriers)
   +
Market      (observable state today: spot, rates, dividends; later curves and quotes)
   +
Model       (assumed dynamics: Black–Scholes; later Heston, Merton jumps, local vol, Hull–White…)
   │
   ▼
Engine      (numerical method: analytic, lattice, Monte Carlo; later PDE, Fourier)
   │
   ▼
PricingResult(value, stderr | None, greeks | None, diagnostics: dict)
```

The current API (this is real code, see `backend/tests/`):

```python
from derivlab import (AnalyticEngine, BlackScholes, CRREngine, European, American, Market,
                      MonteCarloEngine, PlainVanilla, VanillaOption)

option = VanillaOption(PlainVanilla("call", strike=100.0), European(expiry=1.0))
market = Market(spot=100.0, rate=0.05, dividend_yield=0.0)
model  = BlackScholes(volatility=0.20)

AnalyticEngine().price(option, market, model).value               # 10.4506
CRREngine(steps=500).price(option, market, model).greeks          # tree Greeks
MonteCarloEngine(paths=100_000, seed=42).price(option, market, model).confidence_interval()
```

### Design rules

- **Instruments never contain market data or model parameters.** A strike is contract data; a
  volatility is a model parameter; a spot is market data.
- **Payoffs are defined once** (`instruments/payoffs.py`) as vectorised callables used by every engine.
- **Engines declare what they support** and raise `UnsupportedError` for anything else. They never
  silently approximate an unsupported product. The API reports these as `status: "unsupported"`
  and the UI shows the reason.
- **Monte Carlo is path-based.** `gbm_paths` returns `(paths, steps + 1)` arrays, so path-dependent
  products only need a new payoff, not a new engine.
- **The library (`derivlab`) never imports FastAPI, pandas or anything web-related.** It works on
  NumPy arrays and floats and returns dataclasses.
- **The API contains no pricing math.** It validates input (Pydantic), builds library objects, calls
  engines and serialises results.
- **The frontend contains no pricing math.** It only converts display units (e.g. % → decimal, vega per
  1.0 → per vol point), formats numbers and draws charts.
- **Immutable inputs**: frozen dataclasses validated in `__post_init__`; invalid input raises
  `ValueError` with a clear message. Never clamp or "fix" inputs silently.
- **Reproducibility**: every stochastic function takes a `seed` or `np.random.Generator`.
- **Prefer functions and small dataclasses over class hierarchies.** Use `typing.Protocol` for
  interfaces (`engines/base.py: PricingEngine`).

---

## 4. Project structure

Current tree (✓ = exists). Planned directories are created when their phase starts, not before.

```
05-derivatives-pricing-lab/
├── AGENTS.md                        ✓ this file
├── CLAUDE.md                        ✓ imports AGENTS.md for Claude Code
├── README.md                        ✓ quick start for humans
├── Makefile                         ✓ install / dev / test / lint / check / serve
├── backend/
│   ├── pyproject.toml               ✓ deps + ruff, pyright, pytest config
│   ├── src/derivlab/                ✓ pricing library
│   │   ├── core/                    ✓ errors.py (UnsupportedError), stats.py (normal cdf/pdf)
│   │   ├── market.py                ✓ Market (flat rate). Becomes market/ with curves in Phase 5
│   │   ├── models.py                ✓ BlackScholes. Becomes models/ when Heston etc. arrive (Phase 2)
│   │   ├── results.py               ✓ Greeks, PricingResult
│   │   ├── instruments/             ✓ payoffs.py, exercise.py, vanilla.py; later exotic/, rates/
│   │   ├── engines/
│   │   │   ├── base.py              ✓ PricingEngine protocol
│   │   │   ├── analytic/            ✓ Black–Scholes; later Black-76, barriers, Asians, Margrabe…
│   │   │   ├── lattice/             ✓ CRR; later trinomial, short-rate trees
│   │   │   ├── montecarlo/          ✓ paths.py, engine.py; later QMC, Brownian bridge, LSM
│   │   │   ├── pde/                 Phase 1: Crank–Nicolson + Rannacher, American via penalty
│   │   │   └── fourier/             Phase 2: Carr–Madan, COS
│   │   ├── research/                ✓ convergence.py, profile.py
│   │   ├── risk/                    Phase 1: bump-and-revalue, MC pathwise/LR Greeks, scenarios
│   │   ├── calibration/             Phase 2: implied vol, SVI, Heston/SABR calibration
│   │   ├── portfolio/  hedging/     Phase 1–3: strategies, hedging simulations
│   │   └── data/                    Phase 2: option-chain loaders, synthetic data (labelled)
│   ├── src/derivlab_api/            ✓ FastAPI app
│   │   ├── main.py                  ✓ app, /api router, serves frontend/dist if built
│   │   ├── schemas.py               ✓ Pydantic request/response models
│   │   ├── routes/vanilla.py        ✓ one router per product family
│   │   └── export_openapi.py        ✓ dumps the OpenAPI schema
│   └── tests/                       ✓ mirrors src: engines/, research/, api/
├── frontend/
│   ├── package.json  vite.config.ts  components.json (coss/shadcn registry config)
│   └── src/
│       ├── main.tsx  App.tsx  index.css   ✓ providers, shell, Tailwind + coss theme tokens
│       ├── lib/                     ✓ api.ts (typed client), format.ts, theme.tsx, utils.ts
│       ├── hooks/                   ✓ use-debounced-value.ts
│       ├── components/
│       │   ├── ui/                  ✓ coss components (vendored; edit sparingly)
│       │   ├── charts/              ✓ echart.tsx wrapper, theme.ts (palette + chrome), interpolate.ts
│       │   └── app-header.tsx  segmented.tsx  param-control.tsx
│       └── features/
│           └── vanilla/             ✓ one folder per page: params, data hook, panels, charts
└── docs/                            theory notes, one per phase (start in Phase 1)
```

---

## 5. Roadmap

Each phase ends with tests passing, a UI page or section for the new features, a `docs/` note on
the theory, and this file updated. Do the phases in order. Within a phase, order is flexible.

### Phase 0: Foundation reset ✓ (MVP)
- [x] Delete the legacy Streamlit project
- [x] New stack: Python library + FastAPI + React/Vite/TypeScript/Tailwind/coss + ECharts
- [x] Instrument / Market / Model / Engine architecture
- [x] Analytic BSM, CRR (European/American), path-based Monte Carlo with variance reduction
- [x] Vanilla page: inputs, value + Greeks, value/Greek curves, method comparison, convergence
- [x] Tooling: ruff, pyright, pytest + hypothesis, oxlint + prettier, Makefile
- [ ] `git init` and first commit (waiting on the owner)

### Phase 1: Vanilla options done properly
- Implied volatility solver (Brent with no-arbitrage bounds) and an IV calculator in the UI
- Black-76 (options on futures/forwards) and Bachelier (normal model) analytic engines
- PDE engine: Crank–Nicolson with Rannacher smoothing, American via penalty/Brennan–Schwartz,
  non-uniform grid around the strike
- Trinomial and Jarrow–Rudd trees; Richardson extrapolation; interactive small-tree visualiser
- `risk/`: bump-and-revalue Greeks for any engine (common random numbers for MC); MC pathwise and
  likelihood-ratio Greeks
- Multi-leg strategies (spreads, straddles, butterflies): payoff diagrams, aggregated Greeks
- Delta-hedging simulator (discrete rebalancing, costs, vol misspecification)
- More hypothesis properties: price bounds, monotonicity in strike/vol/maturity, convexity in strike
- Frontend: routing (React Router or TanStack Router) once there is a second page

### Phase 2: Volatility beyond a constant σ
- Real option-chain loading (yfinance) with cleaning; cached snapshots for reproducible tests
- Implied-vol surface; SVI / SSVI fitting; static-arbitrage checks (calendar, butterfly)
- Models: Merton jump-diffusion, Heston (Fourier: Carr–Madan FFT and COS), SABR (Hagan)
- Dupire local volatility from the fitted surface
- Calibration of Heston and SABR to market smiles, with error reporting
- 3D surface charts (ECharts GL or Plotly, decide then)

### Phase 3: First exotics, path-dependent options
"Exotic" means anything beyond a plain call or put: the payoff depends on the price path, on several
assets, has an unusual shape, or embeds features like early redemption.
- Path infrastructure: time grids, Brownian bridge, Sobol quasi-random numbers, Heston paths (QE)
- Digital options (cash-or-nothing, asset-or-nothing)
- Barrier options (knock-in/out, up/down): analytic (Reiner–Rubinstein), MC with Brownian-bridge
  crossing correction, PDE with barrier boundaries; in–out parity tests
- Asian options: geometric (closed form) and arithmetic (MC with geometric control variate)
- Lookback options (fixed and floating strike)
- American/Bermudan by Monte Carlo: Longstaff–Schwartz
- Hedging experiments for exotics (why barriers are hard to hedge near the barrier)
- Numba only if profiling shows MC/LSM or PDE loops are the bottleneck

### Phase 4: Multi-asset and correlation
- Correlated paths (Cholesky); correlation as a model parameter
- Exchange/spread (Margrabe, Kirk), basket (moment matching + MC), rainbow (best-of/worst-of), quanto
- Correlation sensitivities and stress

### Phase 5: Interest-rate derivatives
- Day counts and schedules; curve bootstrapping from deposits/FRAs/swaps (`market/` package)
- Bonds, FRAs, interest-rate swaps
- Caps/floors and swaptions (Black-76 and Bachelier)
- Short-rate models: Vasicek, Hull–White (analytic bonds + trinomial tree); calibration

### Phase 6: Structured products and advanced topics
- Autocallables, reverse convertibles, cliquets / forward-start options
- Variance and volatility swaps
- Portfolio-level risk across mixed products; scenario and stress engine
- Optional: credit (CDS, hazard-rate bootstrapping), xVA basics

---

## 6. Technology stack

| Area | Choice | Why |
|---|---|---|
| Pricing library | Python 3.13 (`>=3.12,<3.14`), NumPy, SciPy | The quant ecosystem; vectorised numerics |
| Acceleration | Numba, later and only if profiled | Loops that can't be vectorised (LSM, PSOR) |
| API | FastAPI + Pydantic v2, served by uvicorn | Typed validation, auto OpenAPI docs at `/docs` |
| Python env | venv + pip, deps in `backend/pyproject.toml` (hatchling) | uv is not installed on this machine; switching later is optional |
| Python quality | pytest + hypothesis, ruff (lint + format, line 100), pyright (standard) | |
| Reference oracle | QuantLib-Python, dev dependency only, from Phase 2–3 | Test exotics/rates against an independent library |
| Market data | yfinance from Phase 2 | Free option chains |
| Frontend build | Vite 8, React 19, TypeScript 6 | Fast dev server; `/api` proxied to :8000 |
| Styling | Tailwind CSS v4 | Utility CSS; theme tokens in `src/index.css` |
| Components | **coss UI** (Base UI primitives, shadcn-style copy-in components) | Accessible, polished, owned in-repo. Add with `npx shadcn@latest add @coss/<name>` |
| Charts | Apache ECharts 6 (modular imports) | Canvas performance, smooth updates, log axes, 3D later via echarts-gl |
| Data fetching | TanStack Query | Caching, cancellation, keep-previous-data during slider drags |
| Icons / fonts | lucide-react; Inter Variable + Geist Mono (fontsource) | |
| Frontend quality | `tsc -b` (strict), oxlint, prettier | |
| Version control | git (not initialised yet) | |

Adding a runtime dependency needs a row (or a note) in this table saying why.

---

## 7. Open decisions

1. **git**: initialise the repo and make the first commit. Waiting on the owner's go-ahead.
2. **API types**: TypeScript types in `frontend/src/lib/api.ts` are hand-written to mirror
   `schemas.py`. Generate them from OpenAPI (`openapi-typescript`) once it supports TypeScript 6,
   or sooner if drift becomes a problem.
3. **Bundle size**: the JS bundle is about 1 MB (330 kB gzipped), mostly ECharts. Code-split per
   page when routing arrives in Phase 1.

Resolved: folder renamed to `05-derivatives-pricing-lab`; package is `derivlab`; Streamlit dropped
for React + FastAPI; pip + venv instead of uv for now.

---

## 8. Conventions

**Units and quoting**
- Library: rates, volatilities and dividend yields are annualised decimals (`0.05` = 5%),
  continuously compounded. Time is in years (ACT/365 until Phase 5). Prices are per unit of underlying.
- Library Greeks: vega and rho per **1.0** change, theta per **year**.
- UI: shows percent inputs and market-convention Greeks (vega per vol point, theta per day, rho per
  1%) and always labels the unit. Conversions live in `features/*/params.ts`, nowhere else.

**Python**
- Type hints on public functions; frozen dataclasses; `ruff format` decides layout.
- Engine and model docstrings state the model, assumptions, error/convergence behaviour and a reference.
- Raise `ValueError` for invalid inputs and `UnsupportedError` for unsupported combinations.
- En dashes in names ("Black–Scholes") are intentional; ruff's RUF001-003 are disabled for that.

**Python tests.** Every pricer needs at least:
1. A reference value (closed form, textbook value or QuantLib) with an explicit tolerance.
2. A limit or consistency check (parity, bounds, T→0, σ→0, in–out parity for barriers).
3. For numerical engines, a convergence test against an analytic or high-resolution benchmark.
- MC tests use fixed seeds and assert within a multiple of the reported standard error.
- Mark slow tests `@pytest.mark.slow`; they're excluded by default (`pytest -m slow` to run).
- Every endpoint gets at least a smoke test in `tests/api/`.

**Frontend**
- One folder per page under `src/features/<page>/`: `params.ts` (state, defaults, unit conversion),
  `use-<page>.ts` (queries), and components.
- Use coss components first (`src/components/ui`); the coss skill and particles catalog show
  composition patterns. Remove components that end up unused (`npx shadcn add` re-adds them).
- Charts follow the dataviz rules:
  - Palette in `components/charts/theme.ts` (blue slot 1, orange slot 2), validated for light and dark.
  - 2px lines, hairline solid grid, 8px markers with a 2px surface ring.
  - A crosshair tooltip with the value first.
  - A legend whenever there are 2+ series. Text never uses a series colour.
  - No dual axes.
  - While refetching, keep the old render at reduced opacity, with no skeleton flash.
- Inputs are debounced (150 ms) before hitting the API; queries use `keepPreviousData`.
- When a backend schema changes, update `src/lib/api.ts` in the same change.
- Label synthetic data as synthetic wherever it appears.

**Adding a feature, end to end**
1. Library: instrument/model/engine plus tests (reference, consistency, convergence).
2. API: schema + route + API test.
3. Frontend: types in `lib/api.ts`, then the page/section under `features/`.
4. Update §2, §4 and §5 of this file.

---

## 9. Commands

From the project root:

```bash
make install   # backend venv + editable install with [api,dev]; npm install
make dev       # API on :8000 and Vite on :5173 → open http://localhost:5173
make test      # backend pytest (fast tests)
make lint      # ruff format/check, pyright, tsc, oxlint, prettier --check
make check     # lint + test + frontend build
make serve     # build the UI and serve everything from FastAPI on http://localhost:8000
```

Direct equivalents: `cd backend && .venv/bin/pytest -q`, `cd frontend && npm run dev`.
API docs: http://localhost:8000/docs while the API is running.

---

## 10. References

- Hull, *Options, Futures, and Other Derivatives*: general reference, trees, Greeks, rates basics
- Haug, *The Complete Guide to Option Pricing Formulas*: closed forms for exotics (test oracles)
- Glasserman, *Monte Carlo Methods in Financial Engineering*: paths, variance reduction, MC Greeks, LSM
- Gatheral, *The Volatility Surface*: implied vol, SVI, local and stochastic volatility
- Duffy, *Finite Difference Methods in Financial Engineering*: PDE schemes and stability
- Brigo & Mercurio, *Interest Rate Models: Theory and Practice*: short-rate models, caps, swaptions
