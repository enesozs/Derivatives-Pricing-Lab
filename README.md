# Derivatives Pricing Lab

An interactive lab for pricing and analysing derivatives. It pairs a tested Python pricing library
with a web interface. It covers five areas:
- **Vanilla options**: five pricing methods, Greeks, strategies and delta hedging.
- **Volatility**: surfaces from market data, SVI and local vol; Heston and SABR calibration.
- **Exotics**: barriers, Asians, lookbacks, digitals, and American options by simulation.
- **Multi-asset**: spreads, baskets, rainbows and quantos.
- **Rates**: curve bootstrapping, swaps, bonds, caps and swaptions; Hull–White with Bermudan
  swaptions.
- **Structured products**: autocallables, reverse convertibles, cliquets, variance swaps, and
  portfolio stress testing.
- **Credit**: CDS and default curves; counterparty risk (CVA/DVA) on swaps.

Prices are cross-checked against QuantLib. The theory behind each area is in `docs/`; the
roadmap and architecture are in `AGENTS.md`.

Educational research tool, not investment advice.

## Quick start

Requires Python 3.12–3.13 and Node 20+.

```bash
make install   # Python venv + npm packages
make dev       # API on :8000 + UI on :5173
```

Open http://localhost:5173. Run `make test` for the test suite and `make check` for everything.

## Layout

- `backend/src/derivlab/`: the pricing library (NumPy/SciPy)
- `backend/src/derivlab_api/`: FastAPI over the library (`/docs` for the API reference)
- `frontend/`: React + TypeScript + Tailwind + coss UI + ECharts

See `AGENTS.md` for the architecture, roadmap, stack and conventions.
