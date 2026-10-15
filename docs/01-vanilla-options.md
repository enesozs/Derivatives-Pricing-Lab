# 01 · Vanilla options: pricing, Greeks, numerical methods and hedging

This note explains the theory behind the *Vanilla* section of the lab. Each part says which
page shows it and which code implements it. Formulas use continuous compounding, time in years,
and these symbols throughout:

| Symbol | Meaning |
|---|---|
| $S$ | spot price of the underlying (e.g. a stock) |
| $K$ | strike |
| $T$ | time to expiry, in years |
| $r$ | risk-free rate |
| $q$ | dividend yield |
| $\sigma$ | volatility |

---

## 1. What a vanilla option is

A **call** gives the right, not the obligation, to buy the underlying at $K$. A **put** gives the
right to sell at $K$. At expiry they pay

$$\text{call: } \max(S_T - K, 0) \qquad \text{put: } \max(K - S_T, 0)$$

**European** options can only be exercised at expiry. **American** options can be exercised any
time before that. "Vanilla" means plain calls and puts. Everything else (barriers, averages,
baskets…) is *exotic*, which is Phase 3 onwards.

Before expiry an option is worth more than its payoff: the extra is **time value**, the value of
what might still happen. On the Pricer's *Value across spot* chart, it is the gap between the blue
and orange lines.

**Code:** `instruments/payoffs.py`, `instruments/exercise.py`, `instruments/vanilla.py`.

---

## 2. Pricing without predicting: risk-neutral valuation

You never need to know whether the stock will go up. If you can **replicate** the option by
trading the stock and cash, the option must cost what the replica costs; otherwise there is free
money (arbitrage). Black, Scholes and Merton showed that continuously re-balancing
$\Delta = \partial V/\partial S$ shares replicates the option exactly, if:
- the stock follows geometric Brownian motion with constant $\sigma$;
- trading is continuous and free;
- $r$ and $q$ are constant.

The same price comes from a mathematical shortcut. Pretend every asset grows at the risk-free
rate (the **risk-neutral** world), take the expected payoff, and discount it:

$$V_0 = e^{-rT}\,\mathbb{E}^{\mathbb{Q}}[\text{payoff}(S_T)], \qquad S_T = S_0 \exp\big((r - q - \tfrac12\sigma^2)T + \sigma\sqrt{T}\,Z\big),\ Z \sim N(0,1)$$

Every engine in the lab computes this expectation, in a different way.

### The Black–Scholes formula

For European options the expectation has a closed form:

$$C = S e^{-qT} N(d_1) - K e^{-rT} N(d_2), \qquad P = K e^{-rT} N(-d_2) - S e^{-qT} N(-d_1)$$

$$d_1 = \frac{\ln(S/K) + (r - q + \tfrac12\sigma^2)T}{\sigma\sqrt T}, \qquad d_2 = d_1 - \sigma\sqrt T$$

Check: $C - P = S e^{-qT} - K e^{-rT}$ (**put–call parity**). It holds for any model, and the
tests check it on thousands of random inputs.

**Code:** `engines/analytic/black_scholes.py`. **Tests:** `tests/engines/test_analytic.py`,
`tests/test_properties.py`.

---

## 3. The Greeks: how the price moves

| Greek | Definition | Intuition | Shown in the UI as |
|---|---|---|---|
| Delta $\Delta$ | $\partial V/\partial S$ | shares needed to hedge; ≈ probability of finishing in the money | per $1 in spot |
| Gamma $\Gamma$ | $\partial^2 V/\partial S^2$ | how fast delta changes; largest at the money near expiry | per $1 in spot |
| Vega $\nu$ | $\partial V/\partial\sigma$ | sensitivity to volatility; long options are long vega | per 1 vol point (σ +1%) |
| Theta $\Theta$ | $\partial V/\partial t$ | time decay; the rent paid for gamma | per calendar day |
| Rho $\rho$ | $\partial V/\partial r$ | sensitivity to interest rates | per 1% in rates |

They are connected by the Black–Scholes equation itself:

$$\Theta + (r - q) S \Delta + \tfrac12 \sigma^2 S^2 \Gamma = r V$$

The key trade-off follows from it: if you hold positive gamma (you profit from big moves), you
pay for it through negative theta. The PDE engine uses this identity to compute theta.

---

## 4. Numerical methods: when there is no formula

American options, and most exotics, have no closed form. The lab has three general methods,
plus the formula as a benchmark. **Pricer → Same option, five methods** compares them, and
**Trees & grids** shows what is inside them.

### Binomial trees (`engines/lattice/binomial.py`)

Chop $[0, T]$ into $N$ steps of length $\Delta t$. At each step the spot goes up by $u$ or down by
$d$, with risk-neutral probability $p = (e^{(r-q)\Delta t} - d)/(u-d)$. Start from the payoff at the
last step and roll back:

$$V_{\text{node}} = e^{-r\Delta t}\,[\,p V_{\text{up}} + (1-p) V_{\text{down}}\,]$$

For an American option, take the larger of that and immediate exercise at every node. That one
line is the whole early-exercise logic; the orange nodes in the tree visualiser are where it
binds. The three schemes differ only in how they pick $u$, $d$ and $p$:

| Scheme | Choice | Error in $N$ |
|---|---|---|
| **CRR** | $u = e^{\sigma\sqrt{\Delta t}}$, $d = 1/u$ | $O(1/N)$, zig-zags between odd and even $N$ because the strike falls at different places between nodes |
| **Jarrow–Rudd** | $p \approx \tfrac12$; the tree drifts with the forward | $O(1/N)$ |
| **Leisen–Reimer** | $u, d, p$ inverted from $d_1, d_2$ so the tree is centred on the strike | $O(1/N^2)$ for European, no zig-zag |

On the Pricer's convergence chart, Leisen–Reimer at 500 steps is about 1000× more accurate than
CRR at the same cost.

**Tree Greeks.** Delta and gamma come from the first two levels of the tree, at no extra cost.
Vega and rho come from re-running the tree with $\sigma$ or $r$ bumped.

### Finite differences: solving the PDE (`engines/pde/finite_difference.py`)

The option value satisfies the Black–Scholes PDE. In log-spot $x = \ln S$ and time-to-expiry
$\tau$, it has constant coefficients:

$$\frac{\partial V}{\partial \tau} = \tfrac12\sigma^2 V_{xx} + (r - q - \tfrac12\sigma^2) V_x - rV$$

We put a grid on $x$, replace derivatives with differences, and march from the payoff at
$\tau = 0$ to $\tau = T$:
- **Crank–Nicolson** averages the explicit and implicit schemes, giving second-order accuracy
  in time. The payoff's kink makes it ring, so **Rannacher smoothing** uses four small fully
  implicit steps at the start.
- **American exercise** uses the **penalty method**. Wherever the solution dips below the
  payoff, a huge penalty pushes it back up, and the step is re-solved until nothing changes
  (2–3 iterations).
- **Error:** $O(\Delta x^2 + \Delta\tau^2)$. Doubling the grid cuts the error by ~4.

The *PDE solution as time runs out* chart shows rows of this grid. The *early-exercise boundary*
is, at each date, the spot where the penalty starts binding.

### Monte Carlo (`engines/montecarlo/`)

Simulate many risk-neutral paths, average the discounted payoffs. The error is statistical,
$\approx \text{std}/\sqrt{n}$, so 4× the paths halves it. That is slow, but the method works for
any payoff and any number of assets, which is why exotics rely on it. Two **variance-reduction**
tricks:
- **Antithetic variates:** pair each path $Z$ with its mirror $-Z$.
- **Control variate:** the discounted terminal spot has a known mean ($S e^{-qT}$), so we
  subtract the part of the payoff's noise that is correlated with it.

**Monte Carlo Greeks**, from the same paths:
- **Pathwise** (delta, vega, rho, theta): differentiate each path's payoff.
- **Likelihood ratio** (gamma): differentiate the probability density instead, because the
  payoff's second derivative is a spike. It is unbiased but noisier, which shows in the
  methods table.

Monte Carlo cannot price American options directly: at each date you'd need the continuation
value, which is an expectation inside a simulation. Phase 3 adds **Longstaff–Schwartz**, which
estimates it by regression.

### Generic bump Greeks (`risk/bump.py`)

Re-price with each input nudged up and down. It works with any engine. For Monte Carlo, the up
and down runs must reuse the same random numbers, or the noise swamps the difference.

---

## 5. Implied volatility (page: *Implied volatility*)

Every input to Black–Scholes is observable except $\sigma$. Markets therefore quote options by
the volatility their price implies: the $\sigma$ that makes the model price equal the market
price. Price rises monotonically with volatility, from the zero-vol floor (discounted intrinsic
value) towards an upper bound ($Se^{-qT}$ for a call). So every price strictly inside those
bounds has exactly one implied volatility, and **Brent's method** finds it in ~5–10 iterations.

A price outside the bounds is an arbitrage. For a price barely above the floor (deep in the
money), volatility is not recoverable: tiny price changes would imply huge volatility changes.
The solver refuses both cases instead of returning noise.

Real markets imply a different volatility for each strike and expiry: the **smile** and the
**surface**. Fitting and modelling it is Phase 2.

**Code:** `calibration/implied_vol.py`.

---

## 6. Strategies (page: *Strategies*)

Positions combine linearly, so value and Greeks add up leg by leg. Classic shapes:

| Strategy | Legs | View |
|---|---|---|
| Straddle | long call + long put at K | big move, either direction (long vega) |
| Strangle | long OTM put + long OTM call | same, cheaper, needs a bigger move |
| Bull call spread | long call K₁, short call K₂ > K₁ | moderately bullish, capped profit |
| Butterfly | +1 K−w, −2 K, +1 K+w | price stays near K (short vega) |
| Iron condor | short strangle + long wings | price stays in a range; collects premium |
| Covered call | long stock + short OTM call | income, gives up upside |
| Calendar spread | short near-dated, long far-dated, same K | sells fast theta, owns slow theta |

**P&L at horizon** values every leg on the first expiry date. Expired legs pay their payoff;
longer-dated legs keep their time value, which is what makes the calendar spread's tent shape.
The **stress test** heatmap re-prices the whole position across spot × volatility at a chosen
date. It shows exposures a payoff diagram hides, such as a straddle's vega.

**Code:** `portfolio/strategy.py`.

---

## 7. Delta hedging (page: *Hedging*)

Sell an option and hold $\Delta$ shares. Over a short interval the position's P&L is

$$\text{P\&L} \approx \tfrac12 \Gamma S^2 \left(\frac{(\Delta S)^2}{S^2} - \sigma_{\text{implied}}^2 \Delta t\right)$$

From the seller's point of view: you lose on big moves and earn theta on quiet days.
- If you re-balance **continuously** and the realised volatility equals the volatility you sold
  at, these exactly cancel. That is the Black–Scholes argument.
- **Discrete** re-balancing leaves a random error with standard deviation
  $\approx \sqrt{\pi/4}\,\nu\,\sigma/\sqrt{N}$ (Derman & Kamal). Halving it costs 4× the trades.
  The simulator matches this formula within a few percent.
- **Wrong volatility:** if realised $\sigma$ exceeds what you sold at, you lose roughly
  $\nu \times (\sigma_{\text{realised}} - \sigma_{\text{implied}})$ on average, however often you
  hedge. Option trading is, at heart, trading volatility.
- **Transaction costs** grow with the number of trades, so there is an optimal frequency.

**Code:** `hedging/delta.py`.

---

## 8. Convergence orders at a glance

| Method | Error shrinks like | Doubling the work cuts error by |
|---|---|---|
| CRR / Jarrow–Rudd tree | $1/N$ (oscillating) | ~2× (cost ×4, since trees are $O(N^2)$) |
| Leisen–Reimer tree | $1/N^2$ (European) | ~4× |
| Crank–Nicolson PDE | $\Delta x^2 + \Delta\tau^2$ | ~4× per halving of both steps |
| Monte Carlo | $1/\sqrt{n}$ | ~1.4× |

Monte Carlo's slow rate is offset by its generality: its rate does not depend on the number of
assets, while trees and grids become infeasible beyond 2–3 underlyings.

---

## References

- Hull, *Options, Futures, and Other Derivatives*: ch. 13 (trees), 15 (Black–Scholes), 19 (Greeks), 21 (numerical methods)
- Glasserman, *Monte Carlo Methods in Financial Engineering*: ch. 4 (variance reduction), 7 (Greeks)
- Duffy, *Finite Difference Methods in Financial Engineering*: θ-schemes, Rannacher, American options
- Leisen & Reimer (1996), "Binomial models for option valuation – examining and improving convergence"
- Forsyth & Vetzal (2002), "Quadratic convergence for valuing American options using a penalty method"
- Derman & Kamal (1999), "When you cannot hedge continuously"
