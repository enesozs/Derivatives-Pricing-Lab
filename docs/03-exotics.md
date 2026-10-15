# 03 · Exotic options: path dependence, barriers, averages and early exercise by simulation

An **exotic option** is any option whose payoff is more complicated than a plain call or put.
Usually that means it depends on the *path* the price takes, not just where it ends. This note
covers the four exotics in the lab, the three ways of pricing them, and American options by
simulation. Page: *Exotics*. Code: `instruments/exotic.py`, `engines/analytic/exotics.py`,
`engines/montecarlo/exotics.py`, `engines/montecarlo/lsm.py`, `engines/pde/`.

---

## 1. The products

| Product | Payoff | Why people use it |
|---|---|---|
| **Digital (binary)** | cash-or-nothing: $c\,\mathbb 1\{S_T > K\}$; asset-or-nothing: $S_T\,\mathbb 1\{S_T > K\}$ | Pure bets on a level; building blocks of structured notes |
| **Barrier** | a vanilla that knocks *in* or *out* if $S$ ever touches $H$ (up or down) | Cheaper protection or exposure ("I don't need the call if the stock crashes first") |
| **Asian** | on the *average* price over fixing dates: $\max(\bar S - K, 0)$ (fixed) or $\max(S_T - \bar S, 0)$ (floating) | Commodities and FX: hedges average exposure; hard to manipulate at expiry |
| **Lookback** | on the *extreme* price: floating call $S_T - \min S$, fixed call $\max(\max S - K, 0)$ | Perfect hindsight: expensive, mostly a teaching and benchmarking tool |

Some useful identities, all tested:
- **In–out parity:** knock-in + knock-out = vanilla, because exactly one of them is alive at
  expiry.
- **Cash digital call + put** = a zero-coupon bond $e^{-rT}$.
- **Arithmetic Asian ≥ geometric Asian**, because the arithmetic mean is at least the geometric
  mean.
- **Asian < vanilla:** averaging reduces volatility.

**Monitoring.** Textbook formulas watch the barrier *continuously*. Real contracts check it at
fixed times (daily closes, say). Fewer checks mean fewer chances to touch, so a discretely
monitored knock-out is worth more than a continuous one.

---

## 2. Three ways to price an exotic

**Closed forms (Black–Scholes only).** These exist where the reflection principle or
lognormality gives an exact distribution:
- **Barriers:** Reiner–Rubinstein. Eight cases built from four terms (A–D in Haug).
  Discretely monitored barriers use the **Broadie–Glasserman–Kou correction**: price a
  continuous barrier shifted away from spot by $e^{0.5826\,\sigma\sqrt{\Delta t}}$.
- **Digitals:** one $N(\cdot)$ each.
- **Discrete geometric Asians:** the geometric average of lognormals is lognormal, so a
  Black-like formula holds exactly.
- **Continuous lookbacks:** Goldman–Sosin–Gatto and Conze–Viswanathan.

Every one matches QuantLib to ~1e-14 in the tests.

**PDE.** A knock-out is just the Black–Scholes PDE on a smaller domain. The grid ends exactly
on the barrier, where the option is worth 0. Knock-ins follow from in–out parity. Accuracy is
about 5e-4 in ~15 ms.

**Monte Carlo (any model).** Simulate paths, apply the payoff, and average. It needs care in
two places:
- **Continuous monitoring on a discrete grid.** A path seen once a day can cross a barrier, or
  set a new maximum, between observations. For Black–Scholes the in-between path, given its
  endpoints, is a **Brownian bridge** with known behaviour:
  - Probability of crossing between grid points:
    $p = \exp\!\big(-2\ln(S_i/H)\ln(S_{i+1}/H)/(\sigma^2\Delta t)\big)$. The knock-out payoff
    is multiplied by the survival probability $\prod (1-p)$. That gives an exact continuous
    price in expectation, with *lower* variance than checking hits.
  - The bridge's maximum can be sampled exactly from one uniform per step, which is used for
    lookbacks.

  For Heston and Merton the same formulas use an effective volatility, which is an
  approximation, and the app labels it as one.
- **Variance reduction.** The arithmetic Asian uses the geometric Asian, which has a closed
  form and is ~99% correlated, as a **control variate**. Its standard error drops ~17×.

**Which method when?** The *Which methods can price it* table answers this live:
- **Closed forms** are instant but rare.
- **PDEs** are fast and accurate in 1–2 dimensions, but each product needs its own boundary
  conditions.
- **Monte Carlo** handles any payoff and any model, at the price of noise.

---

## 3. What exotics teach about risk

**Barrier deltas misbehave.** On the *Delta* view, a down-and-out call has a delta above 1 just
above the barrier. A small move up both raises the call's value *and* moves it away from
extinction. At the barrier, the value jumps to zero. Near a barrier the Greeks are large and
change sign fast. So barriers are hard to hedge, and dealers charge for that.

**Model risk.** Switch the model from Black–Scholes to Heston at the same volatility level. The
vanilla barely moves, but the down-and-out call drops (9.92 → 9.18 at default settings).
- **Why:** with negative correlation, volatility rises exactly when the price falls towards the
  barrier, so knock-outs become more likely.
- **The lesson:** two models that agree on vanillas can disagree on exotics. That's why exotic
  desks care so much about which model they calibrate (Phase 2), and why stochastic-local
  volatility models exist.

---

## 4. American options by simulation (page: *Exotics → American by simulation*)

Simulation runs *forward*, but optimal exercise is decided *backwards*: exercise today if
today's payoff beats the expected value of continuing. That expectation is unknown on a single
path. **Longstaff & Schwartz (2001)** estimate it by regression. At each exercise date, going
backwards:
1. Take the in-the-money paths. Regress the discounted cash flow each one receives later on
   simple functions of today's spot (here polynomials in $S/K$).
2. The fitted value is the estimated continuation value. Exercise where the payoff exceeds it,
   and record that cash flow instead.

The price is the average discounted cash flow. Allowing exercise only on $N$ dates makes it a
*Bermudan* price, slightly below the American one. Fitting and valuing on the same paths biases
it slightly upwards. Together these leave the small gap to the tree you see on the page
(≈0.02 at 50 dates).

The page plots where simulated paths chose to exercise. The boundary they imply tracks the
exact PDE boundary, without the method ever building a grid. That is why Longstaff–Schwartz
is the industry workhorse for callable and American-style products under models where trees
and PDEs can't go: it already prices American puts under Heston here.

---

## References

- Haug, *The Complete Guide to Option Pricing Formulas*, 2nd ed., ch. 4: barrier, Asian, lookback and digital formulas
- Reiner & Rubinstein (1991), "Breaking down the barriers", *Risk*
- Broadie, Glasserman & Kou (1997), "A continuity correction for discrete barrier options", *Mathematical Finance*
- Kemna & Vorst (1990), "A pricing method for options based on average asset values", *J. Banking & Finance*
- Glasserman, *Monte Carlo Methods in Financial Engineering*: ch. 6 (path-dependent options, Brownian bridge), ch. 8 (American options)
- Longstaff & Schwartz (2001), "Valuing American options by simulation: a simple least-squares approach", *Review of Financial Studies*
