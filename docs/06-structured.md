# 06 · Structured products and portfolio risk

A structured product is a package: usually a bond plus one or more options, sold as a single
note with a simple-sounding promise ("8% a year while the market doesn't crash"). Pricing one
means taking it apart into pieces the library already prices. This area does that for the four
best-known families, then puts them in a book and stress-tests it. Pages: *Structured →
Autocallables, Reverse convertibles, Cliquets, Variance swaps, Portfolio risk*. Code:
`structured/`, `risk/portfolio.py`.

Throughout, the underlying starts at 100, so every level reads as a percentage of the
**initial fixing** (the price on the trade date), and note values are quoted in % of notional.
A note is **fairly priced** when it is worth 100%. Real issuers price below that: the gap is
their margin.

---

## 1. Reverse convertibles: a bond plus a short put

The investor pays 100 and receives a fixed coupon $c$ whatever happens. At maturity they get:
- 100 back if the stock ends at or above the strike $K$;
- otherwise shares worth $100 \cdot S_T/K$, i.e. they take the stock's loss below the strike.

That redemption is $100 - 100\,(K - S_T)^+/K$, so

$$\text{note} = \underbrace{\text{zero-coupon bond}}_{DF(T)} + \underbrace{\text{coupons}}_{c\sum \tau_i DF(t_i)} - \frac{\text{put}(K)}{K}.$$

The coupon is high because the investor has **sold a put**, and the coupon is the premium. The
**fair coupon** solves note = 100:
$c^* = \big(1 - DF(T) + \text{put}/K\big) / \sum\tau_i DF(t_i)$.
Higher volatility makes the put dearer and the fair coupon higher. A 15% coupon is a statement
about risk, not generosity.

**Barrier version.** The investor converts only if the stock *also* touched a lower barrier $B$
during the note's life. The put becomes a **down-and-in put**, which is cheaper, so it pays a
lower coupon. With $B = K$ the barrier is irrelevant: ending below $K$ means it was touched. The
page shows the risk-neutral touch probability, which has a closed form for GBM (the
first-passage formula, Shreve vol. II §7.2).

Put prices come from the best available engine:
- Black–Scholes: closed forms (vanilla and barrier, Phase 3);
- Heston, vanilla put: COS;
- Heston, barrier put: Monte Carlo with Brownian-bridge crossings.

---

## 2. Autocallables

The best-selling structured product in Europe and Asia. On each observation date $t_j$ (say
quarterly) the note looks at the performance $W_j = S(t_j)/S(0)$:

| Event | Condition | What happens |
|---|---|---|
| Coupon | $W_j \ge$ coupon barrier (e.g. 70%) | pays $c/4$; with **memory**, also every coupon missed before |
| Autocall | $W_j \ge$ autocall level (e.g. 100%) | redeems 100 immediately; the note ends |
| At maturity, not called | protection barrier (e.g. 60%) breached | investor receives $100\,W_T$: the full loss below 100 |
| | otherwise | 100 back |

The protection barrier is checked either on the final fixing only ("European") or on every daily
close (riskier for the investor).

**Pricing.** There is no closed form. The path matters (when is it called? were coupons
missed?), so the lab simulates paths and walks through the observation dates. The note's value
is linear in the coupon rate: $V = A + cB$, where $A$ is the principal leg and $B$ the value of
the coupon stream per unit of coupon rate. So the fair coupon $c^* = (1 - A)/B$ comes from the
same simulation at no extra cost. Simulation choices:
- Black–Scholes with protection checked at maturity: paths only on the observation dates (exact).
- Daily monitoring or Heston: a 252-step-a-year grid.
- Paths run in batches of 4,000 to keep memory bounded.

**What the charts show.**
- *When does the note end?* Most notes are called at the first observation. The risk sits in the
  final bar, where the investor either gets 100 or takes the stock's loss.
- *What the investor ends up with.* Many small gains (one or two coupons, then redemption), and a
  thin tail of large losses. This is the classic "picking up pennies" profile of a short put.
- *Fair coupon against volatility.* The investor is short volatility, so the coupon rises with it.

**Worst-of notes** reference the worst of several stocks. The worst of three is much more likely
to breach a barrier than any one of them, so worst-ofs pay far higher coupons. Lower correlation
makes the worst performer worse, so the investor is **short correlation** (and the issuing bank
long). That is the correlation exposure from Phase 4. Banks run large books of it and cannot
hedge it with listed instruments.

---

## 3. Forward-start options and cliquets

**Forward-start option** (Rubinstein 1991). The strike is fixed at a future date $t_1$ as
$m \cdot S(t_1)$, and the option expires at $T$. Under Black–Scholes the option's value scales
with $S(t_1)$, so

$$V = S_0\,e^{-q t_1}\;\text{BS}\big(\text{spot } 1,\ \text{strike } m,\ T - t_1\big).$$

It depends only on volatility *between* $t_1$ and $T$: it is a bet on **forward volatility**.
This closed form matches QuantLib's `ForwardEuropeanEngine` to 1e-15 (tested).

**Cliquet** (ratchet): the sum of periodic returns $R_i = S(t_i)/S(t_{i-1}) - 1$, each clipped
to a local floor and cap, then clipped overall by a global floor (the capital guarantee):

$$\text{payoff} = \max\Big(F_g,\ \sum_i \min\big(C,\ \max(F,\ R_i)\big)\Big).$$

Each clipped return is a forward-start call spread:
$\min(C, \max(F, R)) = F + (X - (1+F))^+ - (X - (1+C))^+$ with $X = S(t_i)/S(t_{i-1})$.
So without a binding global floor, Black–Scholes gives a closed form, and the Monte Carlo is
tested against it.

**Why the page prices it twice.** Black–Scholes and Heston can be set to the same volatility
level. They then agree roughly on today's at-the-money options, yet disagree on cliquets by a
few percent of notional. Each period is a forward-start option, so the price depends on the
smile the model predicts *in the future*. That forward smile is not observable today, and the
gap is **model risk**: why cliquet desks lost money in the 2000s, and why stochastic-local
volatility models were developed (Gatheral ch. 10).

---

## 4. Variance and volatility swaps

A variance swap pays $N\,(\sigma_R^2 - K_{var})$ at maturity. Here
$\sigma_R^2 = \frac{1}{T}\sum_i \ln^2(S_i/S_{i-1})$ is the realised variance of daily returns.
It is a pure volatility bet: the payoff does not depend on the stock's direction.

**Replication** (Demeterfi, Derman, Kamal & Zou 1999). For any diffusion, Itô's lemma gives

$$\sigma_R^2\,T = 2\int_0^T \frac{dS}{S} - 2\ln\frac{S_T}{S_0}.$$

The first term is a dynamic position in the stock with zero expected cost (beyond the forward);
the second is a **log contract**. A log payoff can be built from a static strip of
out-of-the-money options, each weighted by $1/K^2$. Hence

$$K_{var} = \frac{2e^{rT}}{T}\left[\int_0^F \frac{P(K)}{K^2}dK + \int_F^\infty \frac{C(K)}{K^2}dK\right].$$

This is the formula behind the **VIX** (30-day S&P 500 variance in vol points). The page prices
the strip with the COS method under Black–Scholes, Heston or Merton jumps, and compares it with
the model's exact expected variance:
- **Black–Scholes:** every method gives $\sigma^2$.
- **Heston:** expected variance is $\theta + (v_0 - \theta)\frac{1 - e^{-\kappa T}}{\kappa T}$.
  The negative spot–vol correlation skews the smile, so low-strike puts are dear, and the
  $1/K^2$ weights favour them.
- **Strike discretisation.** The integrand has a kink at the forward. The trapezoid error is
  therefore about $\frac{2}{T}\frac{\Delta x^2}{12}$ (with $\Delta x$ the log-strike spacing),
  and it falls with the square of the spacing. The *More options, smaller error* chart shows it.
  The skewed left tail also needs a wide strike range (±10 standard deviations for strong skew).
- **Jumps break replication.** The log contract prices $2E[e^J - 1 - J]$ per jump rather than
  the jump's squared size $E[J^2]$. With downward jumps the strip *underprices* realised
  variance. The tests confirm the predicted gap $\lambda(E[J^2] - 2E[e^J-1-J])$ to 0.1%. This is
  one reason variance swaps on single stocks are capped.

**Volatility swaps** pay $\sigma_R - K_{vol}$. The square root is concave, so
$K_{vol} = E[\sigma_R] < \sqrt{E[\sigma_R^2]} = \sqrt{K_{var}}$ (Jensen's inequality). The gap,
the **convexity adjustment**, grows with the volatility of volatility. There is no static hedge,
so the page simulates daily-sampled realised volatility. Under Black–Scholes the adjustment is
only sampling noise (~0); under Heston with $\xi = 0.6$ it is about 2 vol points.

---

## 5. Portfolio risk and stress testing (page: *Portfolio risk*)

A desk doesn't manage products one by one. It manages a **book**, and the risk engine values
everything consistently.

**Revaluation.** Every position is priced by whatever method suits it:
- closed forms for vanillas, digitals and barriers;
- the decomposition for reverse convertibles;
- Monte Carlo for autocallables.

Monte Carlo always reuses the **same random numbers** (fixed seed), so the difference between a
bumped and an unbumped price is smooth and not dominated by noise.

**Notes keep their fixing.** After a 20% fall, an existing reverse convertible is 20 points
closer to conversion; the new spot is not its new strike. The pricers take the initial fixing
(`reference`) separately from today's spot for exactly this.

**Greeks by bump and revalue.** The whole book is revalued with spot ±1%, volatility ±1 point and
rates ±1bp, and the results are central differences. This works for products with no analytic
Greeks (the autocallable). On the page:
- delta is shown per 1% spot move (the "cash delta");
- gamma as the P&L from a 1% move;
- vega per volatility point;
- rho per 1% of rates.

**The stress grid** revalues the book for every combination of spot (−30%…+30%) and volatility
(−10…+20 points) shocks. The preset *note issuer* book is short an autocallable and a reverse
convertible, hedged with some puts. It is long volatility and short the market, and it *gains*
in a crash: the investors are the ones who lose.

**Full revaluation vs Greeks.** The scenario table compares full revaluation with the
second-order Taylor estimate
$\Delta\,dS + \tfrac12\Gamma\,dS^2 + \nu\,d\sigma + \rho\,dr$.
- For moves of a few percent they agree.
- For a crash (−25%, +20 vol points) the estimate is off by about 20%, because the Greeks
  themselves change along the way. Barriers make this worse: a knock-in that switches on during
  the move is invisible to today's Greeks.

That is why risk managers stress books by full revaluation, and why "VaR from Greeks"
underestimates tail losses.

What is simplified:
- **One volatility for every product.** A real desk shocks a whole surface (skew and term
  structure).
- **No theta.** That needs every product to "age"; vanillas can, notes can't yet.
- **Single underlying.** Worst-of notes appear on their own page, not in the book.

---

## 6. Validation

| Check | Result |
|---|---|
| Autocallable with zero volatility: called at the first date | exact |
| Autocallable without autocall/coupons = bond − put − (1−B)·digital | within 4 standard errors |
| Fair coupon reprices the note at 100% | exact (same paths) |
| Worst-of with correlation → 1 equals the single-asset note | 5% |
| Reverse convertible = bond + coupons − put; barrier at strike = plain | 1e-9 |
| Barrier touch probability vs fine-grid simulation | 1.5 percentage points |
| Forward-start vs QuantLib `ForwardEuropeanEngine` | 1e-12 |
| Forward-start and cliquet Monte Carlo vs closed forms | within 4 standard errors |
| Variance replication → $\sigma^2$ (BS) and Heston expected variance | 1e-4 relative |
| Merton jump bias of the replication | 1e-3 relative |
| Portfolio Greeks of a vanilla book vs Black–Scholes Greeks | 1e-3 |

---

## References

- Bouzoubaa & Osseiran, *Exotic Options and Hybrids* (2010): autocallables, reverse convertibles, cliquets
- Hull, *Options, Futures, and Other Derivatives*, ch. 17 (structured products), 22 (VaR, stress testing)
- Rubinstein (1991), "Pay now, choose later", *Risk*: forward-start options
- Demeterfi, Derman, Kamal & Zou (1999), "More than you ever wanted to know about volatility swaps"
- Carr & Lee (2009), "Volatility derivatives", *Annual Review of Financial Economics*
- Gatheral, *The Volatility Surface*, ch. 10–11 (forward smile, cliquets, variance swaps)
- CBOE, *VIX White Paper*: the variance-strip formula in practice
- Shreve, *Stochastic Calculus for Finance II*, §7.2 (first-passage probabilities)
