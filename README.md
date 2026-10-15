# Derivatives Pricing Lab

An interactive lab for pricing and analysing derivatives. It pairs a tested Python pricing library
with a web interface. Today it covers vanilla European and American options, priced three ways
(Black–Scholes closed form, a binomial tree, and Monte Carlo). It shows the Greeks, value and Greek
curves across spot, and how fast each numerical method converges.
Volatility surfaces, exotic options and rates products come next (see `AGENTS.md` §5).

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
