# 07 · Credit: default curves, CDS and counterparty risk

Every product so far assumed that whoever owes you money pays. Credit is about what happens
when they don't. Credit risk shows up in two places:
- as a **product**: the credit default swap, which trades the risk of a company defaulting;
- as an **adjustment to every other product**: CVA, the price of the chance that your
  counterparty defaults while owing you.

Pages: *Credit → CDS & default curves, Counterparty risk (xVA)*. Code: `credit/`.

---

## 1. Modelling default: hazard rates

The lab uses the market-standard **reduced-form** model. Default is a surprise event, the first
jump of a Poisson process with intensity $\lambda(t)$, the **hazard rate**. Given survival to
$t$, the chance of defaulting in the next instant is $\lambda(t)\,dt$. So

$$Q(T) = P(\text{survive to } T) = \exp\Big(-\int_0^T \lambda(u)\,du\Big),\qquad
P(\text{default in } (t_1, t_2]) = Q(t_1) - Q(t_2).$$

The hazard rate plays the role of the instantaneous forward rate, and $Q$ the role of the
discount factor. Every bootstrapping idea from Phase 5 carries over. `HazardCurve` keeps
$\lambda$ constant between nodes (piecewise flat, like log-linear discount factors).

The alternative, **structural** models (Merton 1974), treat equity as a call on the firm's
assets with the debt as the strike: default happens when assets fall below debt. They explain
*why* firms default but fit market prices poorly, so trading desks use hazard rates.

---

## 2. Credit default swaps (page: *CDS & default curves*)

A CDS is insurance on a borrower ("the reference entity"):
- the **protection buyer** pays a running spread $s$ on the notional, quarterly, until maturity
  or default;
- on default, the **protection seller** pays the loss $(1 - R)$ per unit notional, where $R$ is
  the recovery rate (typically assumed 40% for senior unsecured debt).

Valuing each leg means weighting cash flows by survival:

$$\text{premium leg} = s \times \underbrace{\Big[\sum_i \tau_i\,DF(t_i)\,Q(t_i) + \text{accrual on default}\Big]}_{\text{RPV01, the risky annuity}},
\qquad
\text{protection leg} = (1 - R)\int_0^T DF(t)\,(-dQ(t)).$$

Accrual on default is the premium owed for the part of a period before default (on average
half a period). The integrals are evaluated period by period at the midpoint. That is the same
convention as QuantLib's `MidPointCdsEngine`, and the two agree to 3e-5 (the residual is
QuantLib rounding quarter-years to whole days).

**Par spread** $s^* = \text{protection}/\text{RPV01}$, the spread at which the CDS is worth zero.

**The credit triangle.** With a flat hazard rate, $s^* \approx \lambda(1 - R)$: the spread is
default rate × loss rate. 115bp at 40% recovery means about 1.9% a year, a 9% chance of
default over five years. In the page's table, the "credit triangle" column is the *average*
hazard to each maturity. The "segment hazard" column is the hazard on that segment alone, which
is higher on an upward-sloping curve, just as forward rates exceed zero rates on a rising yield
curve.

**Bootstrapping** follows the same steps as the yield curve: take quotes in maturity order and
solve one hazard segment per quote so that quote prices at par (errors ~1e-17). A spread curve
can be *impossible*. If a long spread is too low relative to the short ones, matching it would
need a negative hazard rate, i.e. a probability of "un-defaulting". The bootstrap rejects that.

**Fixed coupons and upfronts.** Since the 2009 "Big Bang", contracts trade at standard coupons
(100bp for investment grade, 500bp for high yield). The difference is settled upfront:
$\text{upfront} = (s^* - c)\times\text{RPV01}$. A 115bp name traded at 100bp costs the buyer
about 0.67% upfront.

**CS01** is the value change for a 1bp widening of every spread (re-bootstrapped). It is the
credit counterpart of DV01, and is about RPV01 × 1bp × notional.

---

## 3. Counterparty risk and CVA (page: *Counterparty risk (xVA)*)

A bank's swap with a client is valued by discounting expected cash flows, assuming the client
pays. If the client defaults while the swap is worth $V > 0$ to the bank, the bank recovers only
$R\,V$. If $V < 0$, the bank still owes it. The bank's loss is therefore $(1 - R)\,V^+$ at the
default time, and its price is the **credit valuation adjustment**:

$$\text{CVA} = (1 - R_c)\;E\big[D(0,\tau_c)\,V(\tau_c)^+\,\mathbf 1\{\tau_c \le T\}\big]
\;\approx\; (1 - R_c)\sum_k EE^*(t_k)\,PD_c(t_{k-1}, t_k).$$

Here $EE^*(t) = E[D(0,t)\,V(t)^+]$ is the **discounted expected exposure**, and the sum assumes
default independent of rates. (When they are correlated, as when a client is hurt by the same
rate move that makes it owe more, the result is **wrong-way risk**, not modelled here.)

**Exposure needs simulation.** The swap's future value depends on future rates:
1. Simulate the short rate with Hull–White (it fits today's curve exactly).
2. On each path and date, revalue the remaining swap with the model's closed-form bond prices.
   The floating coupon in progress was fixed at the last reset on that path.
3. Average the positive parts.

**The exposure profile** of a swap is a hump. Today an at-the-money swap is worth zero. Rates
then drift and the value spreads out (√t). At the same time the remaining payments shrink, and
the value collapses to zero at maturity. Exposure also drops at each payment date, giving the
sawtooth. **PFE** (potential future exposure, here the 95th percentile) is the bad-case number
used for credit limits.

**An exact check.** At a reset date, a payer swap's discounted expected exposure
$E[D(0,t)V(t)^+]$ *is* the price of a payer swaption expiring then: the right to enter the
remaining swap. Hull–White prices swaptions in closed form (Jamshidian), and the simulated
exposure matches within Monte Carlo noise (a few %). The page shows the gap and the tests
check it.

**DVA** is the mirror image: the bank's own default on what it owes,
$(1-R_{own})\sum_k |ENE^*(t_k)|\,PD_{own}$. The bilateral fair value is $V - \text{CVA} + \text{DVA}$.
DVA is controversial. A bank's value rises when its own credit worsens, and it can only
monetise that by defaulting, which is why regulators exclude it from capital.

**Collateral.** Under a credit support annex the counterparty posts collateral for exposure
above a threshold $H$, which caps exposure at $H$ (assuming instant, perfect margining; real
CSAs have a margin period of risk of about 10 days). Lowering the threshold cuts CVA sharply.
This is why almost all interbank trades are collateralised, and why the 2008 losses were
concentrated in uncollateralised trades with monoline insurers.

**CVA as a running spread.** CVA / annuity gives the number of basis points a bank adds to the
fixed rate to charge for it. That is the "xVA desk" quoting a price to the sales desk.

**The rest of "xVA"** (not modelled):
- **FVA**: funding cost of uncollateralised trades.
- **KVA**: cost of the regulatory capital the trade consumes.
- **MVA**: cost of funding initial margin.

They share CVA's machinery: an exposure simulation times a cost rate.

---

## 4. Validation

| Check | Result |
|---|---|
| Survival and default probabilities of a piecewise hazard curve | exact |
| Credit triangle: par spread ≈ λ(1 − R) | 1% |
| Bootstrap reprices every quote | < 1e-12 |
| Par CDS worth zero; upfront zero at the par coupon; buyer = −seller | 1e-15 |
| CDS vs QuantLib `MidPointCdsEngine` (par spread, protection leg) | 1e-4 |
| Discounted EE at resets vs Jamshidian swaption prices | 3% (20,000 paths) |
| Payer EE = −receiver ENE on the same paths | exact |
| No default risk → CVA = 0; doubling λ ≈ doubles CVA; collateral cuts CVA | as expected |

---

## References

- Hull, *Options, Futures, and Other Derivatives*, ch. 24–25 (credit risk, credit derivatives)
- O'Kane, *Modelling Single-name and Multi-name Credit Derivatives* (2008), ch. 3, 6–7
- Gregory, *The xVA Challenge* (4th ed., 2020): exposure, CVA, DVA, collateral, FVA/KVA/MVA
- Brigo, Morini & Pallavicini, *Counterparty Credit Risk, Collateral and Funding* (2013)
- ISDA, *CDS Standard Model* and the 2009 "Big Bang" protocol (standard coupons)
- Merton (1974), "On the pricing of corporate debt", *J. Finance*: the structural model
