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

- **Phases 0–8 are complete.** §5 lists possible extensions; none is scheduled.
- **Vanilla** area, 5 pages: Pricer (5 methods), Implied volatility, Trees & grids, Strategies,
  Hedging. See `docs/01-vanilla-options.md`.
- **Volatility** area, 3 pages:
  - **Surface** (`/volatility`): SPY snapshot / synthetic Heston / live Yahoo chain; cleaning
    report, per-expiry smile with SVI fit, term structure, 3D implied and Dupire local-vol
    surface, butterfly/calendar arbitrage flags.
  - **Models** (`/volatility/models`): Black–Scholes, Heston, Merton, SABR playground; smiles
    across expiries and the risk-neutral density.
  - **Calibration** (`/volatility/calibration`): Heston (whole surface) or SABR (per expiry);
    parameters, RMSE, Feller check, market-vs-model small multiples.
  - See `docs/02-volatility.md`.
- **Exotics** area, 2 pages:
  - **Exotic pricer** (`/exotics`): digital, barrier (continuous or discrete monitoring), Asian
    (arithmetic/geometric, fixed/floating), lookback; Black–Scholes or Heston. It shows value
    vs the equivalent vanilla, Greeks, a value/delta profile across spot, simulated paths
    illustrating the payoff, and which methods can price it.
  - **American by simulation** (`/exotics/american`): Longstaff–Schwartz vs tree, with the
    exercise boundary vs the PDE and convergence in paths. Works under Heston too.
  - See `docs/03-exotics.md`.
- **Multi-asset** area, 2 pages:
  - **Correlation lab** (`/multi-asset`): exchange, spread, basket, best-of and worst-of options
    on 2–5 assets with uniform correlation. Shows the closed form vs Monte Carlo, price against
    correlation with a sensitivity, and a scatter of joint terminal scenarios.
  - **Quanto** (`/multi-asset/quanto`): quanto call/put, the drift adjustment, price against
    asset–FX correlation, and a joint asset+FX Monte Carlo check.
  - See `docs/04-multi-asset.md`.
- **Rates** area, 4 pages, all priced off one shared, editable curve (`CurveProvider` context):
  - **Curves** (`/rates`): quote editor (deposits, swaps; parallel bumps), zero and forward
    curves, discount factors, bootstrapped nodes with repricing errors.
  - **Swaps & bonds** (`/rates/linear`): swap NPV, par rate, annuity, DV01, cash flows, NPV vs
    parallel shift; bond price, yield, durations, convexity, price–yield approximations.
  - **Caps & swaptions** (`/rates/options`): Black-76 or Bachelier; caplet strip, equivalent vol
    in the other model, the smile each model implies.
  - **Short-rate models** (`/rates/models`): Hull–White vs Vasicek fans and curve fit; European
    swaption (Jamshidian vs trinomial tree) and Bermudan; Hull–White calibration to cap vols.
  - See `docs/05-rates.md`.
- **Structured** area, 5 pages (underlying starts at 100; values in % of notional):
  - **Autocallables** (`/structured`): single or worst-of-3, memory coupons, protection at
    maturity or daily; value, fair coupon, redemption-date probabilities, return distribution,
    fair coupon vs volatility and vs correlation. Black–Scholes or Heston (single asset).
  - **Reverse convertibles** (`/structured/reverse-convertible`): plain or barrier; bond +
    coupons − put decomposition, fair coupon, touch probability, payoff at maturity.
  - **Cliquets** (`/structured/cliquet`): local cap/floor, global floor; Black–Scholes vs Heston
    (forward-smile model risk), closed form when no global bound binds; forward-start option.
  - **Variance swaps** (`/structured/variance`): 1/K² option-strip replication (COS) vs exact
    expected variance under BS/Heston/Merton; strike-spacing convergence; jump bias; simulated
    realised vol and the volatility-swap convexity adjustment.
  - **Portfolio risk** (`/structured/risk`): editable book of options, barriers and notes;
    bump-and-revalue Greeks, spot × vol stress grid, scenarios (full revaluation vs Taylor).
  - See `docs/06-structured.md`.
- **Credit** area, 2 pages:
  - **CDS & default curves** (`/credit`): editable par-spread quotes → bootstrapped hazard
    curve; survival and hazard charts; par spread, upfront at 100/500bp, RPV01, CS01.
  - **Counterparty risk** (`/credit/xva`): Hull–White exposure simulation of a swap; EPE/PFE
    profile, sample paths, CVA/DVA by year, collateral threshold, swaption check of exposure.
  - See `docs/07-credit.md`.
- **Learn** (`/learn`): an educational course on using the lab.
  - **Start here** (`/learn/start`): the shared page layout, units, chart conventions, what
    Monte Carlo intervals mean, and what the numbers are not (risk-neutral ≠ forecast).
  - **7 chapters**, each with two tabs: *Using the pages* (a tour of every page in the area:
    purpose, workflow, and an annotated screenshot whose numbered regions are each explained)
    and *Theory* (the `docs/` note rendered with KaTeX). 3–4 guided experiments per chapter.
  - **Glossary** (`/learn/glossary`): ~75 searchable terms, each linked to a page.
  - Every chart and table card has a "How to read this chart/table" toggle (`ChartGuide`) with
    the same text as the tour; every area's tab row links to its chapter ("Learn this area").
- Instruments: `VanillaOption`, and exotics `DigitalOption`, `BarrierOption`, `AsianOption`,
  `LookbackOption` (union `Instrument`). Exotics implement `payoff_paths(paths, times)`.
- Models: `BlackScholes`, `Heston`, `Merton`, `SABR`, `LocalVol` (union `Model`).
- Engines × models (vanilla):

  | Engine | BS | Heston | Merton | SABR | LocalVol | American |
  |---|---|---|---|---|---|---|
  | `AnalyticEngine` | ✓ Greeks | – | ✓ series | ✓ Hagan | – | – |
  | `CosEngine` (Fourier) | ✓ | ✓ | ✓ | – | – | – |
  | `BinomialEngine` | ✓ Greeks | – | – | – | – | ✓ |
  | `FiniteDifferenceEngine` | ✓ Greeks | – | – | – | ✓ | ✓ |
  | `MonteCarloEngine` | ✓ Greeks | ✓ Euler | ✓ exact | – | ✓ Euler | – |

  Exotics: `AnalyticEngine` (Black–Scholes closed forms: digitals, barriers incl. the BGK
  discrete correction, geometric Asians, continuous lookbacks), `FiniteDifferenceEngine`
  (continuous barriers, Black–Scholes/local vol), `MonteCarloEngine` (everything, any model;
  Brownian-bridge barriers/lookbacks, geometric control variate for Asians).
  `LongstaffSchwartzEngine` prices American/Bermudan vanillas under any model.
  Unsupported combinations raise `UnsupportedError`.
- Data: `derivlab.data`, which covers raw chains, the Yahoo fetcher, the bundled
  `snapshots/spy-2026-10-14.json`, synthetic Heston chains, and cleaning (parity forwards, OTM
  selection, wing trimming).
- Multi-asset (`derivlab.multi_asset`, its own small type family): `MultiAssetMarket`,
  `CorrelatedBlackScholes`, products `ExchangeOption`, `SpreadOption`, `BasketOption`,
  `RainbowOption`, `QuantoOption`. Engines: `MultiAssetAnalyticEngine` (Margrabe, Kirk, Levy,
  Stulz) and `MultiAssetMonteCarloEngine` (Cholesky paths; geometric-basket control variate),
  plus `quanto_price` / `quanto_monte_carlo`. Bivariate normal CDF: `core.bivariate` (Genz).
- Rates (`derivlab.rates`, its own type family; single curve, ACT/365F, no calendars):
  `DiscountCurve` (log-linear DF), `Quote` + `bootstrap`, `FixedRateBond`, `InterestRateSwap`,
  `black` / `bachelier` / `implied_vol`, `CapFloor`, `Swaption`, `Vasicek`, `HullWhite`
  (Jamshidian bond options, caps, swaptions; simulation), `calibrate_hull_white_to_caps`,
  trinomial `build_tree` and `bermudan_swaption`.
- Structured (`derivlab.structured`): `Autocallable` + `price_autocallable` /
  `price_worst_of_autocallable` (batched Monte Carlo, V = A + cB gives the fair coupon),
  `ReverseConvertible` (decomposition via `_common.price_instrument`: closed form → COS → MC),
  `ForwardStartOption`, `Cliquet` (+ Black–Scholes closed forms), `replicate_variance`,
  `expected_variance`, `simulate_realised_variance`. Note pricers take a `reference` (initial
  fixing) separate from today's spot, so shocks move a note's performance.
- Credit (`derivlab.credit`): `HazardCurve` (piecewise-flat), `CDS` (mid-point legs, par
  spread, upfront), `bootstrap_hazard`, `swap_exposure` (Hull–White paths, closed-form
  revaluation, optional threshold), `credit_adjustments` (CVA/DVA), `cva_spread`.
- Portfolio risk (`derivlab.risk.portfolio`): `Position`, `Scenario`, `shock` (BS/Heston),
  `revalue`, `portfolio_risk`, `stress_grid`, `scenario_report`, `STRESS_SCENARIOS`.
- Tests: 382 backend tests, with QuantLib cross-checks for:
  - Heston and SABR;
  - all barrier cases, digitals, geometric Asians and lookbacks;
  - Margrabe, Stulz, Kirk, quanto and the bivariate normal;
  - Vasicek and Hull–White bond options, and the Bermudan swaption tree;
  - forward-start options and the CDS mid-point engine;

  plus the synthetic → SVI → Dupire → PDE consistency test, and a Playwright smoke test over
  all 23 pages plus the Learn chapters.

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
from derivlab import (AnalyticEngine, BinomialEngine, BlackScholes, European, American, Market,
                      MonteCarloEngine, PlainVanilla, VanillaOption)

option = VanillaOption(PlainVanilla("call", strike=100.0), European(expiry=1.0))
market = Market(spot=100.0, rate=0.05, dividend_yield=0.0)
model  = BlackScholes(volatility=0.20)

AnalyticEngine().price(option, market, model).value               # 10.4506
BinomialEngine(steps=500).price(option, market, model).greeks     # tree Greeks (CRR)
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
│   │   ├── core/                    ✓ errors (UnsupportedError), stats (normal), bivariate (Genz)
│   │   ├── market.py                ✓ Market (flat rate) for equity products
│   │   ├── models/                  ✓ black_scholes, heston, merton, sabr, local_vol (+ char. functions)
│   │   ├── results.py               ✓ Greeks, PricingResult
│   │   ├── instruments/             ✓ payoffs, exercise, vanilla, exotic (digital/barrier/Asian/lookback)
│   │   ├── engines/
│   │   │   ├── base.py              ✓ PricingEngine protocol
│   │   │   ├── analytic/            ✓ black_scholes (BS, Merton, SABR), exotics (closed forms)
│   │   │   ├── lattice/             ✓ binomial.py (CRR, Jarrow–Rudd, Leisen–Reimer; tree_nodes)
│   │   │   ├── montecarlo/          ✓ paths, engine (pathwise/LR Greeks), exotics (bridge), lsm
│   │   │   ├── pde/                 ✓ Crank–Nicolson + Rannacher, American (penalty), barriers
│   │   │   └── fourier/             ✓ COS method (vectorised over strikes), risk-neutral density
│   │   ├── research/                ✓ convergence.py, profile.py
│   │   ├── multi_asset/             ✓ market/model, instruments, analytic, montecarlo
│   │   ├── rates/                   ✓ curve, schedule, bootstrap, products (bond/swap), options
│   │   │                              (Black-76/Bachelier caps, swaptions), short_rate (Vasicek,
│   │   │                              Hull–White, calibration), tree (trinomial, Bermudan)
│   │   ├── calibration/             ✓ implied_vol, svi (quasi-explicit + direct), surface (Dupire),
│   │   │                              models (Heston/SABR calibration)
│   │   ├── portfolio/               ✓ strategy.py (signed legs + underlying, horizon values)
│   │   ├── credit/                  ✓ hazard, cds (+ bootstrap), xva (exposure, CVA/DVA)
│   │   ├── structured/              ✓ autocallable, reverse_convertible, cliquet (+ forward-start),
│   │   │                              variance (replication, realised variance), _common
│   │   ├── risk/                    ✓ bump.py (Greeks for any engine), portfolio.py (book risk, stress)
│   │   ├── hedging/                 ✓ delta.py (discrete delta hedging, frequency study)
│   │   └── data/                    ✓ chain, yahoo, synthetic, cleaning, snapshots/*.json
│   ├── src/derivlab_api/            ✓ FastAPI app
│   │   ├── main.py                  ✓ app, /api router, app.frontend() serves frontend/dist
│   │   ├── schemas/                 ✓ common, vanilla, strategies, hedging, volatility, exotics,
│   │   │                              multi_asset, rates, structured, credit
│   │   ├── routes/                  ✓ vanilla, strategies, hedging, volatility, exotics, multi_asset,
│   │   │                              rates, structured, credit
│   │   └── export_openapi.py        ✓ dumps the OpenAPI schema
│   └── tests/                       ✓ mirrors src; test_properties.py = no-arbitrage properties
├── frontend/
│   ├── package.json  vite.config.ts  components.json (coss/shadcn registry config)
│   └── src/
│       ├── main.tsx  App.tsx  index.css   ✓ providers + BrowserRouter, route table, theme tokens
│       ├── lib/                     ✓ api.ts (typed client), format.ts, theme.tsx, input-mode.ts, utils.ts
│       ├── types/                   ✓ echarts-gl.d.ts (the 3D library ships without types)
│       ├── hooks/                   ✓ use-debounced-value.ts
│       ├── components/
│       │   ├── ui/                  ✓ coss components (vendored; edit sparingly)
│       │   ├── charts/              ✓ echart.tsx wrapper, theme.ts (palette + chrome), interpolate.ts,
│       │   │                          simple-charts.tsx (LinesChart, HistogramChart)
│       │   ├── charts/chart-card.tsx  ✓ card + legend keys shared by every chart
│       │   ├── greek-tiles.tsx      ✓ shared by every area (metadata in lib/greeks.ts)
│       │   ├── area-nav.tsx         ✓ every area's tab row + link to its Learn chapter
│       │   ├── chart-guide.tsx      ✓ "How to read this chart" toggle (text from content/guides)
│       │   ├── model-section.tsx    ✓ Black–Scholes / Heston panel (exotics, structured)
│       │   ├── stat-grid.tsx        ✓ hairline stat tiles (rates, structured)
│       │   └── app-shell, app-header, page-header, panel-section, param-control,
│       │       number-input, segmented, not-found, page-fallback   ✓ shared building blocks
│       └── features/
│           └── vanilla/             ✓ product area
│               ├── layout.tsx       ✓ sub-navigation + Suspense for lazy pages
│               ├── pages.ts         ✓ lazy page imports (also used to preload on hover)
│               ├── pricer/          ✓ one folder per page: params.ts, data hook, panels, charts
│               ├── implied-vol/     ✓
│               ├── methods/         ✓ Trees & grids page
│               ├── strategies/      ✓ presets in params.ts; scenario heatmap
│               └── hedging/         ✓
│           ├── volatility/          ✓ layout + source context shared by surface/, models/, calibration/
│           ├── exotics/             ✓ pricer/, american/, shared model-section (BS / Heston)
│           ├── multi-asset/         ✓ correlation-page, quanto-page, shared correlation-chart
│           ├── rates/               ✓ curve-context (shared quotes), curves/linear/options/models pages
│           ├── structured/          ✓ five pages + market-section.tsx
│           ├── credit/              ✓ cds-page, xva-page
│           └── learn/               ✓ chapters.ts (course + experiments), start, glossary, course and
│                                      chapter pages, page-tour + annotated-screen, screens.json
│       ├── content/                 ✓ guides/ (one PageGuide per page: regions, how to read them),
│                                      glossary.ts
├── e2e/smoke.py                     ✓ Playwright smoke test over every page (`make e2e`)
├── e2e/learn_screens.py             ✓ Learn screenshots + region boxes (`make learn-shots`)
├── frontend/public/learn/*.jpg      ✓ one screenshot per page (generated)
└── docs/                            ✓ 01-vanilla-options … 07-credit; one note per phase
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
- [x] `git init` and first commit

### Phase 1: Vanilla options done properly ✓
- [x] Implied volatility solver (Brent with no-arbitrage bounds, any engine) and IV page
- [x] Routing (React Router, lazy pages with hover preloading) and the Vanilla sub-navigation
- [x] Multi-leg strategies: presets, leg editor (incl. American legs), P&L today/at horizon,
      breakevens, max profit/loss, spot × volatility stress heatmap
- [x] Binomial schemes CRR, Jarrow–Rudd, Leisen–Reimer; tree Greeks; small-tree visualiser
- [x] PDE engine: Crank–Nicolson + Rannacher, log-spot grid, American via penalty method,
      solution slices and early-exercise boundary
- [x] Monte Carlo pathwise (Δ, ν, ρ, Θ) and likelihood-ratio (Γ) Greeks; generic bump Greeks
- [x] Delta-hedging simulator: discrete re-balancing, costs, volatility misspecification,
      frequency study against Derman–Kamal
- [x] Hypothesis no-arbitrage properties: bounds, monotonicity, convexity, American ≥ European
- [x] Browser smoke test (`e2e/smoke.py`); theory note `docs/01-vanilla-options.md`
- Moved: Black-76 and Bachelier engines and trinomial trees to Phase 5, where caps, floors,
  swaptions and short-rate models need them. Dropped: Richardson extrapolation, since
  Leisen–Reimer already gives smooth second-order convergence.

### Phase 2: Volatility beyond a constant σ ✓
- [x] Option-chain data: Yahoo fetcher, bundled SPY snapshot, synthetic Heston chains (labelled)
- [x] Cleaning: mid vs last-trade prices, staleness, parity forwards, OTM selection, wing
      trimming, drop counts by reason
- [x] SVI per expiry (quasi-explicit + direct, best of both); butterfly (Durrleman) and
      calendar checks over quoted ranges
- [x] Surface: total-variance interpolation, forward curve, Dupire local volatility
- [x] Models: Heston, Merton, SABR, LocalVol; COS Fourier engine; Merton series and SABR in the
      analytic engine; Heston/Merton/local-vol Monte Carlo; local vol in the PDE engine
- [x] Calibration: Heston (vega-scaled price errors, ~0.5 s) and SABR (per expiry)
- [x] UI: Surface (3D via echarts-gl), Models playground, Calibration; theory note
      `docs/02-volatility.md`
- Deferred: SSVI (global arbitrage-free parametrisation) and stochastic-local volatility,
  revisited if Phase 3 exotics need them.

### Phase 3: First exotics, path-dependent options ✓
- [x] Instruments: digital (cash/asset), barrier (8 types, continuous/discrete monitoring),
      Asian (arithmetic/geometric, fixed/floating), lookback (fixed/floating, continuous/discrete)
- [x] Closed forms (Haug) cross-checked with QuantLib; BGK correction for discrete barriers
- [x] Monte Carlo for exotics under any model: batched paths, Brownian-bridge barriers and
      lookback extremes, geometric-Asian control variate
- [x] PDE knock-out grids ending on the barrier; knock-ins by in–out parity
- [x] Longstaff–Schwartz (American/Bermudan by regression), any model; exercise boundary
- [x] UI: Exotic pricer (BS vs Heston model risk, value/delta profiles, payoff paths) and
      American by simulation; theory note `docs/03-exotics.md`
- Deferred: Sobol quasi-random numbers and the Heston QE scheme (Euler + Brownian bridge is
  enough at current accuracy); Numba (no hot spot found: the slowest exotic price is ~0.5 s).

### Phase 4: Multi-asset and correlation ✓
- [x] Correlated GBM (Cholesky), PSD-validated correlation matrices, uniform-correlation helper
- [x] Exchange (Margrabe), spread (Kirk), basket (Levy; geometric basket exact), best-of /
      worst-of (Stulz, two assets; Monte Carlo beyond), quanto (exact + joint asset/FX MC)
- [x] Genz bivariate normal CDF; QuantLib cross-checks for every closed form
- [x] Correlation sensitivity (dV/dρ) and price-vs-correlation curves; joint-scenario scatter
- [x] UI: Correlation lab and Quanto pages; theory note `docs/04-multi-asset.md`

### Phase 5: Interest-rate derivatives ✓
- [x] Discount curve (log-linear DF), schedules, bootstrapping from deposits/FRAs/par swaps
- [x] Fixed-rate bonds (yield, durations, convexity, DV01) and interest-rate swaps (par rate,
      annuity, DV01, cash flows)
- [x] Black-76 and Bachelier, implied vols in both; caps/floors and European swaptions
- [x] Vasicek and Hull–White: closed-form bonds and bond options (Jamshidian), caps, swaptions,
      simulation; Hull–White calibration to cap vols
- [x] Hull–White trinomial tree; Bermudan swaptions (QuantLib-checked)
- [x] UI: Curves, Swaps & bonds, Caps & swaptions, Short-rate models on one shared editable
      curve; theory note `docs/05-rates.md`
- Simplified on purpose: a single curve (no OIS/projection split), ACT/365F with no calendars,
  and the rates package kept separate from the equity `Market` instead of a shared `market/`
  package. Revisit if structured products need rates and equity together.

### Phase 6: Structured products and portfolio risk ✓
- [x] Autocallables (single and worst-of, memory, daily or maturity protection), fair coupon
- [x] Reverse convertibles (plain and barrier) as bond + coupons − put; touch probability
- [x] Forward-start options (QuantLib-checked) and cliquets; Black–Scholes vs Heston forward smile
- [x] Variance swaps by option-strip replication; jump bias; volatility swaps and convexity
- [x] Portfolio risk across mixed products: bump Greeks, stress grid, scenario engine
      (full revaluation vs Taylor)
- [x] UI: five Structured pages; theory note `docs/06-structured.md`
- Simplified on purpose: one flat volatility per book in the stress engine (no surface
  shocks), no theta for notes, worst-of notes outside the portfolio page.

### Phase 7: Credit and counterparty risk ✓
- [x] Hazard-rate curves, CDS (mid-point engine, QuantLib-checked), bootstrap, upfront, CS01
- [x] Exposure simulation for swaps under Hull–White (exact swaption check at resets)
- [x] CVA, DVA, collateral threshold, CVA as a running spread
- [x] UI: CDS & default curves, Counterparty risk; theory note `docs/07-credit.md`
- Simplified on purpose: independent default and rates (no wrong-way risk), flat hazards for
  xVA, instant margining (no margin period of risk), single swap (no netting set).

### Phase 8: Learn mode ✓
- [x] In-app course: the `docs/` notes rendered with math (react-markdown + KaTeX), section
      navigation, guided experiments per chapter, progress marks
- [x] Shared `AreaNav` with a link from every area to its chapter
- [x] Page tours: annotated screenshots of all 23 pages, region-by-region reading guides,
      "How to read this chart" in the app, Start-here chapter and glossary

### Possible extensions (not scheduled)
- Wrong-way risk, netting sets and FVA/KVA in the xVA engine
- Stochastic-local volatility, so cliquets and barriers price consistently with the smile
- Multi-curve rates (OIS discounting + projection curves), calendars and day counts
- Sobol quasi-random numbers and the Heston QE scheme for faster, smoother Monte Carlo
- Surface-level stress scenarios (skew and term-structure shocks) in the risk engine
---

## 6. Technology stack

| Area | Choice | Why |
|---|---|---|
| Pricing library | Python 3.13 (`>=3.12,<3.14`), NumPy, SciPy | The quant ecosystem; vectorised numerics |
| Acceleration | Numba, later and only if profiled | Loops that can't be vectorised (LSM, PSOR) |
| API | FastAPI (`fastapi[standard]`) + Pydantic v2; `fastapi dev` / `fastapi run` CLI | Typed validation, OpenAPI docs at `/docs`, `app.frontend()` serves the built SPA |
| Python env | venv + pip, deps in `backend/pyproject.toml` (hatchling) | uv is not installed on this machine; switching later is optional |
| Python quality | pytest + hypothesis, ruff (lint + format, line 100), pyright (standard) | |
| Reference oracle | QuantLib-Python (dev dependency only) | Cross-checks models, exotics, multi-asset, rates and forward-start closed forms and trees |
| Market data | yfinance (in the `api` extra) | Free, delayed option chains; bundled snapshots keep tests offline |
| 3D charts | echarts-gl 2.1 (lazy-loaded on the Surface page) | WebGL surfaces for ECharts 6 |
| Frontend build | Vite 8, React 19, TypeScript 6 | Fast dev server; `/api` proxied to :8000 |
| Styling | Tailwind CSS v4 | Utility CSS; theme tokens in `src/index.css` |
| Components | **coss UI** (Base UI primitives, shadcn-style copy-in components) | Accessible, polished, owned in-repo. Add with `npx shadcn@latest add @coss/<name>` |
| Charts | Apache ECharts 6 (modular imports) | Canvas performance, smooth updates, log axes, 3D later via echarts-gl |
| Data fetching | TanStack Query | Caching, cancellation, keep-previous-data during slider drags |
| Routing | React Router v8, declarative mode (`BrowserRouter`/`Routes`/`NavLink`) | Lazy pages via `React.lazy`; `NavLink` sets `aria-current` for the segmented nav style |
| Learn chapters | react-markdown, remark-gfm, remark-math, rehype-katex, rehype-slug, KaTeX, @tailwindcss/typography | Renders the `docs/` notes (tables, math) in the app; one source of truth for the theory |
| Icons / fonts | lucide-react; Inter Variable + Geist Mono (fontsource) | |
| Frontend quality | `tsc -b` (strict), oxlint, prettier | |
| Browser testing | Playwright (Python, dev dependency) driving the installed Google Chrome | `make e2e`; no browser download needed |
| Version control | git | |

Adding a runtime dependency needs a row (or a note) in this table saying why.

---

## 7. Open decisions

1. **API types**: TypeScript types in `frontend/src/lib/api.ts` are hand-written to mirror
   `backend/src/derivlab_api/schemas/`. Generate them from OpenAPI (`openapi-typescript`) once it
   supports TypeScript 6, or sooner if drift becomes a problem.
2. **Bundle size**: pages are code-split and echarts-gl loads only on the Surface page. Core
   ECharts (~200 kB gzipped) loads with every page because every page has charts.
3. **Snapshots**: one SPY snapshot (2026-10-14, last trades) is bundled. Refresh it with
   `derivlab.data.yahoo.fetch_chain("SPY").save(...)` during US market hours for mid quotes.

Resolved: folder renamed to `05-derivatives-pricing-lab`; package is `derivlab`; Streamlit dropped
for React + FastAPI; pip + venv instead of uv for now; git initialised.

---

## 8. Conventions

**Units and quoting**
- Library: rates, volatilities and dividend yields are annualised decimals (`0.05` = 5%),
  continuously compounded. Time is in years (ACT/365F everywhere, including rates; no calendars). Prices are per unit of underlying.
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
- Pages live under `src/features/<area>/<page>/`, with `params.ts` (state, defaults, unit
  conversion → request), a data hook or `useQuery` call, and components. Each page default-exports
  its component and is registered lazily in `<area>/pages.ts` and in `App.tsx`'s route table.
- Build panels from `PanelSection` + `ParamControl` (slider + exact input) or `NumberInput`
  (compact); options with `Segmented`; headings with `PageHeader`; charts inside `ChartCard`.
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
- The Learn course reads `docs/*.md` directly (Vite `import.meta.glob`, `server.fs.allow: ['..']`).
  Write display math as `$$…$$` (fenced on its own lines or inline; both render) and avoid bare
  `$` for currency. When a page's control labels change, update the experiment steps in
  `features/learn/chapters.ts`; they quote those labels.
- Page guides live in `src/content/guides/<area>.ts`, keyed by page path and card heading.
  When you add, rename or remove a chart card, update its region there (the toggle and the tour
  both disappear silently otherwise), then run `make learn-shots` to refresh the screenshots and
  region boxes. Guide text quotes default-input numbers; re-check them if defaults change.

**Adding a feature, end to end**
1. Library: instrument/model/engine plus tests (reference, consistency, convergence).
2. API: schema + route + API test.
3. Frontend: types in `lib/api.ts`, then the page/section under `features/`.
4. Extend `e2e/smoke.py` with the new page's key interaction, and run `make e2e`.
   For a new area, add a `docs/` chapter and its entry (with experiments) in `features/learn/chapters.ts`.
5. Update §2, §4 and §5 of this file.

---

## 9. Commands

From the project root:

```bash
make install   # backend venv + editable install with [api,dev]; npm install
make dev       # API on :8000 and Vite on :5173 → open http://localhost:5173
make test      # backend pytest (fast tests)
make e2e       # Playwright smoke test over every page (needs `make dev` running + Chrome)
make learn-shots  # refresh the Learn screenshots after UI changes (needs `make dev`)
make lint      # ruff format/check, pyright, tsc, oxlint, prettier --check
make check     # lint + test + frontend build
make serve     # build the UI and serve everything from FastAPI (`fastapi run`) on :8000
```

Direct equivalents: `cd backend && .venv/bin/pytest -q`, `cd frontend && npm run dev`.
API docs: http://localhost:8000/docs while the API is running.

**Editor:** open `05-derivatives-pricing-lab/` itself as the VS Code folder, so `.vscode/settings.json`
applies. It points Pylance at `backend/.venv`. If VS Code uses another interpreter (e.g. Anaconda),
every `fastapi`/`derivlab` import shows as unresolved even though the app runs fine.

---

## 10. Agent skills

Installed at the `QuantProjects/` level (`.claude/skills/`, `.agents/skills/`). Use them:

| Skill | Use for |
|---|---|
| `find-docs` (Context7) | **Before using any library API you're not certain of.** Versions here are new (React Router 8, Vite 8, TypeScript 6, ECharts 6, FastAPI 0.14x) |
| `fastapi` | API code: `Annotated`, return types, routers, `app.frontend()`, `fastapi` CLI |
| `vite` | `vite.config.ts`, build and code-splitting (Vite 8 uses Rolldown) |
| `vercel-react-best-practices` | React structure and performance (lazy loading, re-render rules) |
| `webapp-testing` | Driving the app with Playwright; see `e2e/smoke.py` |
| `coss`, `coss-particles` | UI components and composition patterns |
| `dataviz` (built in) | Any chart: palette, marks, tooltips, accessibility |

---

## 11. References

- Hull, *Options, Futures, and Other Derivatives*: general reference, trees, Greeks, rates basics
- Haug, *The Complete Guide to Option Pricing Formulas*: closed forms for exotics (test oracles)
- Glasserman, *Monte Carlo Methods in Financial Engineering*: paths, variance reduction, MC Greeks, LSM
- Gatheral, *The Volatility Surface*: implied vol, SVI, local and stochastic volatility
- Duffy, *Finite Difference Methods in Financial Engineering*: PDE schemes and stability
- Brigo & Mercurio, *Interest Rate Models: Theory and Practice*: short-rate models, caps, swaptions
