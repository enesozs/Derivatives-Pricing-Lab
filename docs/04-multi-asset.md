# 04 · Multi-asset options and correlation

When an option depends on several prices, it also depends on how those prices move
*together*. Correlation cannot be observed directly, it is hard to hedge, and every
multi-asset product has a first-order exposure to it. Page: *Multi-asset*. Code:
`multi_asset/`, `core/bivariate.py`.

---

## 1. The model: correlated geometric Brownian motions

Each asset $i$ follows Black–Scholes with its own volatility $\sigma_i$ and dividend yield
$q_i$. The driving Brownian motions are correlated: $\mathrm{corr}(dW_i, dW_j) = \rho_{ij}$.
To simulate this, draw independent normals $Z$ and multiply by the **Cholesky factor** $L$ of
the correlation matrix ($LL^\top = \rho$). Then $LZ$ has exactly the required correlations.

A correlation matrix must be **positive semi-definite**: you can't have three assets that are
all strongly *negatively* correlated with each other. For a uniform correlation $\rho$ between
$n$ assets this means $\rho \ge -1/(n-1)$. The correlation slider enforces that bound.

The *Joint scenarios* chart shows the effect directly:
- independent assets give a round cloud of outcomes;
- correlated assets give a tilted ellipse;
- perfectly correlated assets give a line.

---

## 2. Products and how correlation moves their price

| Product | Payoff | Closed form | ρ ↑ means |
|---|---|---|---|
| Exchange | $\max(S_1 - S_2, 0)$ | **Margrabe** (exact) | cheaper |
| Spread | $\max(S_1 - S_2 - K, 0)$ | **Kirk** (approximation) | cheaper |
| Basket | $\max(\sum w_i S_i - K, 0)$ | **Levy** moment matching (approximation) | dearer |
| Best-of call | $\max(\max_i S_i - K, 0)$ | **Stulz** (exact, 2 assets) | cheaper |
| Worst-of call | $\max(\min_i S_i - K, 0)$ | **Stulz** (exact, 2 assets) | dearer |

The intuition for each row:
- **Exchange and spread options** pay on the *difference* between two assets. The difference
  has variance $\sigma_1^2 + \sigma_2^2 - 2\rho\sigma_1\sigma_2$, which shrinks as $\rho$ rises.
  Margrabe's trick: measure everything in units of asset 2, and the exchange option becomes a
  Black–Scholes call on the ratio $S_1/S_2$.
- **Baskets** pay on the *sum*. Its variance *grows* with $\rho$: less diversification.
- **Best-of** options profit when one asset breaks away from the others. That is less likely
  when they move together.
- **Worst-of** options suffer when one asset lags. That is also less likely when they move
  together, so worst-ofs gain value as $\rho$ rises.

Selling worst-of options (inside "autocallable" and similar notes) leaves banks *long*
correlation. That is why correlation desks exist.

**Approximations, visibly.** The Levy basket formula matches the basket's first two moments
with a lognormal. It is usually within 0.1–0.5% of the true price. The page puts it next to a
Monte Carlo estimate whose control variate (the *geometric* basket, exactly lognormal) makes it
precise enough to show the difference.

**Two-asset formulas need the bivariate normal CDF.** SciPy's version is only accurate to
~1e-5, so the lab implements Genz's algorithm (`core/bivariate.py`). It agrees with QuantLib to
2e-16, and every two-asset closed form matches QuantLib's engines in the tests.

Beyond two or three assets, trees and PDE grids become infeasible: the grid size grows
exponentially with dimension. **Monte Carlo** does not care about dimension, which is why the
page falls back to it automatically for 3–5 asset rainbows.

---

## 3. Quanto options (page: *Multi-asset → Quanto*)

A quanto pays a foreign asset's option payoff in *your* currency at a fixed exchange rate. For
example, a Nikkei call paid in dollars, one dollar per index point. You carry no currency risk,
but the price still depends on the currency.

Under the domestic pricing measure, the foreign asset's drift changes from $r_f - q$ to

$$r_f - q - \rho\,\sigma_S\,\sigma_X$$

where $\sigma_X$ is the FX volatility and $\rho$ the correlation between the asset and the
exchange rate (domestic per foreign). This is the **quanto adjustment**. With $\rho > 0$ the
asset tends to rise when its currency strengthens, which a fixed-rate payout doesn't capture,
so a quanto call is worth less. The closed form is Black–Scholes with that shifted drift, and
it matches QuantLib to 1e-14. The Monte Carlo check simulates the asset *and* the FX rate
jointly, so it reproduces the adjustment by simulation rather than by assumption.

---

## References

- Margrabe (1978), "The value of an option to exchange one asset for another", *J. Finance*
- Stulz (1982), "Options on the minimum or the maximum of two risky assets", *J. Financial Economics*
- Kirk (1995), "Correlation in the energy markets", in *Managing Energy Price Risk*
- Levy (1992), "Pricing European average rate currency options", *J. International Money and Finance*
- Haug, *The Complete Guide to Option Pricing Formulas*, ch. 5 (multi-asset), quanto section
- Genz (2004), "Numerical computation of rectangular bivariate and trivariate normal and t probabilities"
- Glasserman, *Monte Carlo Methods in Financial Engineering*, ch. 2.3 (correlated normals)
