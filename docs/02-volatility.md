# 02 · Volatility: smiles, surfaces and stochastic models

Phase 1 assumed one constant volatility $\sigma$. Real option prices disagree: each strike and
expiry implies its own volatility. This note covers how the lab measures that from market data,
describes it with a smooth surface, and explains it with models. Each part points to the page
and the code.

---

## 1. The smile is in the data (page: *Volatility → Surface*)

Take every option on SPY expiring on one date, invert each price with Black–Scholes, and plot the
implied volatility against strike. You don't get a flat line. You get a **skew**: low strikes
(downside puts) trade at much higher implied volatility than high strikes. Two common
explanations, which are complementary:
- **Crash risk.** Markets fall faster than they rise. Investors pay up for protection, and
  dealers who sell it charge for the jump risk they can't hedge.
- **Leverage and feedback.** When prices fall, volatility tends to rise. So the left tail of
  the price distribution is fatter than lognormal.

Implied volatility is therefore not the market's forecast of "the" volatility. It's a
re-expression of each option's price in Black–Scholes units: a convenient quoting convention.

### From raw quotes to a smile (`data/cleaning.py`)

Market data is messy, and the cleaning steps are part of the result:
1. **Pick a price per quote.** Use the bid/ask mid if the spread is reasonable. Outside trading
   hours, Yahoo only provides the last trade, which may be stale. Every quote dropped is counted
   by reason, and the table on the page shows them.
2. **Forward from put–call parity.** $C - P = D\,(F - K)$ holds for European options in any
   model. So the forward $F$ (which includes the dividends you'd otherwise have to guess) can be
   read off near-the-money call/put pairs. With `estimate_rate=True` the discount factor $D$ is
   regressed too. That works for European-style index options, but SPY's options are American:
   in-the-money puts carry an early-exercise premium that bends the regression. So by default
   $D$ comes from a rate you set.
3. **Keep out-of-the-money options only.** Puts below the forward, calls above: they're the
   liquid ones. Also drop the far wings beyond 4 standard deviations. Those options cost cents,
   so tick size swamps their information.
4. **Implied volatility** of each remaining price, by Brent's method on Black-76 (Black–Scholes
   on the forward).

---

## 2. Describing a smile: SVI (`calibration/svi.py`)

A noisy cloud of points per expiry is not yet usable for pricing. We fit **SVI** (Stochastic
Volatility Inspired, Gatheral 2004) in total implied variance $w = \sigma_{imp}^2 T$ against
log-moneyness $k = \ln(K/F)$:

$$w(k) = a + b\big(\rho(k - m) + \sqrt{(k - m)^2 + \sigma^2}\big)$$

The five parameters:
- $a$: level;
- $b$: steepness of the wings;
- $\rho$: asymmetry (skew);
- $m$: horizontal shift;
- $\sigma$: roundness of the bottom.

Both wings are linear in $k$, which is exactly the growth no-arbitrage theory permits (Lee's
moment formula), so extrapolating beyond the quotes stays sane.

**Fitting.** The fitter runs two methods and keeps whichever has the lower implied-volatility
error:
- **Zeliade's quasi-explicit method:** for fixed $(m, \sigma)$, SVI is *linear* in its other three
  parameters, so those are solved exactly and only a 2-D search remains.
- **A multi-start direct fit.**

On SPY the fits land within 0.1–0.7 vol points of noisy last-trade quotes.

**No-arbitrage checks:**
- **Butterfly:** within one expiry, the implied density must be non-negative. For SVI this is
  Durrleman's condition
  $g(k) = \big(1 - \tfrac{k w'}{2w}\big)^2 - \tfrac{w'^2}{4}\big(\tfrac1w + \tfrac14\big) + \tfrac{w''}{2} \ge 0$.
- **Calendar:** total variance must not decrease with maturity at fixed $k$. Otherwise a
  longer option would be cheaper than a shorter one.

Both are checked only where quotes exist, and flagged in the quality table.

---

## 3. The surface and local volatility (`calibration/surface.py`)

Between expiries, total variance is interpolated linearly in $T$ at fixed $k$. This keeps an
arbitrage-free set of slices arbitrage-free in between. The result is the **implied volatility
surface** $\sigma_{imp}(K, T)$ in the 3D chart.

**Dupire's local volatility.** Is there a model with no extra randomness that reproduces
*every* option price on the surface? Dupire (1994) showed yes, uniquely: let volatility depend
on spot and time, $dS/S = (r-q)\,dt + \sigma_{loc}(S,t)\,dW$, with

$$\sigma_{loc}^2(k, T) = \frac{\partial w/\partial T}{1 - \frac{k}{w} w_k + \frac14\left(-\frac14 - \frac1w + \frac{k^2}{w^2}\right) w_k^2 + \frac12 w_{kk}}$$

In the 3D chart, switch to *Local (Dupire)*: the local skew is about twice as steep as the
implied one. That is the classic rule of thumb, because an implied vol is roughly an *average*
of local vols along the path. Where the surface has arbitrage, the formula breaks down
(negative or infinite variance); those points fall back to implied vol and are counted.

The PDE engine prices with local volatility directly (`LocalVol` model, variable coefficients).
The test suite checks the full chain:

> synthetic quotes → cleaning → SVI → Dupire → PDE prices → implied vols

and requires them to match the input to within half a vol point.

**Weakness:** local vol fits today's smile perfectly, but predicts that smiles flatten as time
passes, which they don't. That matters for path-dependent exotics (Phase 3).

---

## 4. Explaining the smile: models (page: *Volatility → Models*)

All three models below price European options through the **characteristic function**
$\varphi(u) = \mathbb{E}[e^{iu \ln(S_T/S_0)}]$, which is known in closed form even when the
density is not. The **COS method** (`engines/fourier/cos.py`) expands the density in a Fourier
cosine series whose coefficients come straight from $\varphi$. Pricing a whole smile then takes
about 2 ms, which is what makes calibration fast. Validated against Black–Scholes (1e-14), the
Merton series (1e-10) and QuantLib's Heston engine (~1e-8).

### Heston (`models/heston.py`)

Variance is itself a mean-reverting random process:

$$dS/S = (r-q)\,dt + \sqrt{v}\,dW_1,\qquad dv = \kappa(\theta - v)\,dt + \xi\sqrt v\,dW_2,\qquad \mathrm{corr}(dW_1,dW_2) = \rho$$

| Parameter | Effect on the smile |
|---|---|
| $v_0$ | short-dated level ($\sqrt{v_0}$ ≈ short ATM vol) |
| $\theta$ | long-dated level |
| $\kappa$ | how fast short-dated vol converges to long-dated: the term structure |
| $\xi$ | vol of variance: curvature (smile) |
| $\rho$ | negative → skew (vol rises when price falls) |

**Feller condition** $2\kappa\theta > \xi^2$: variance can never touch zero. Fitted equity
parameters usually violate it. That's harmless for Fourier pricing, but it makes simulation
harder (Phase 3 adds the QE scheme).

**Limitation:** a diffusion can't move far in a few days. So Heston can't produce the steep
skews of very short expiries; see the calibration page, where the 6-day smile fits worst.

### Merton jump-diffusion (`models/merton.py`)

Black–Scholes plus a Poisson number of lognormal jumps, with intensity $\lambda$ per year, mean
log jump $\mu_j$ and spread $\sigma_j$. Jumps fatten the tails *immediately*, so they steepen
short-dated smiles most: exactly what Heston lacks. The price is also a closed-form series: a
Poisson-weighted sum of Black–Scholes prices, one per possible number of jumps.

### SABR (`models/sabr.py`)

For a forward: $dF = \alpha F^\beta dW_1$, $d\alpha = \nu\alpha\,dW_2$, correlation $\rho$.
Hagan's 2002 formula gives the implied volatility directly. Desks use SABR per expiry as a
smile *interpolator*: $\alpha$ sets the level, $\rho$ the skew, $\nu$ the curvature, and
$\beta$ (fixed) how the smile moves when the forward moves.

### Risk-neutral density

The density chart shows the distribution of $S_T$ each model implies, recovered from $\varphi$
by the same cosine expansion. Compare it with the lognormal (Black–Scholes) density at the same
at-the-money vol. Heston with negative $\rho$ fattens the left tail and thins the right: the
picture behind the skew.

---

## 5. Calibration (page: *Volatility → Calibration*, code: `calibration/models.py`)

Calibration finds the parameters that best reproduce market implied volatilities:
- **Heston:** one parameter set for the whole surface. The fit minimises vega-scaled price
  errors $(P_{model} - P_{mkt})/\text{vega}$, which approximate volatility errors without
  inverting prices inside the loop. On synthetic data generated by a known Heston model, it
  recovers the true parameters (the tests check this). On SPY it gives a typical equity
  picture: $\rho \approx -0.7$, Feller violated, worst fit at the shortest expiries.
- **SABR:** a separate fit per expiry with $\beta$ fixed. It fits more closely but says nothing
  about how expiries connect; note how $\nu$ falls with maturity.

The lesson: a model that fits *today's* prices is necessary but not sufficient. Exotic prices
depend on how the model makes smiles *evolve*, and models that fit equally well can disagree
there. That is the motivation for Phase 3.

---

## References

- Gatheral, *The Volatility Surface* (2006): SVI, local vol, Heston, the skew
- Gatheral & Jacquier (2014), "Arbitrage-free SVI volatility surfaces", *Quantitative Finance* 14(1)
- Zeliade Systems (2009), "Quasi-explicit calibration of Gatheral's SVI model"
- Dupire (1994), "Pricing with a smile", *Risk*
- Heston (1993); Albrecher et al. (2007), "The little Heston trap"
- Fang & Oosterlee (2008), "A novel pricing method for European options based on Fourier-cosine series expansions"
- Merton (1976), "Option pricing when underlying stock returns are discontinuous"
- Hagan, Kumar, Lesniewski & Woodward (2002), "Managing smile risk", *Wilmott*
