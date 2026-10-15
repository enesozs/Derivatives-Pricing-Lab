# 05 · Interest-rate derivatives

Equity options have one underlying price. Interest-rate products depend on a whole **curve**:
a different rate for every horizon, all moving together but not in lockstep. Everything in this
area starts from that curve. Pages: *Rates → Curves, Swaps & bonds, Caps & swaptions,
Short-rate models*. Code: `rates/`.

**Simplifications, stated once.** Time is ACT/365F year fractions, with no calendars, holidays
or business-day rolls. Every period is exactly 1/frequency years. It is a **single-curve** world
(see §1). A production system adds all three; the pricing ideas are unchanged.

---

## 1. The discount curve (page: *Curves*)

A **discount factor** $P(0,T)$ is today's value of 1 paid at $T$. Every rates price is a sum of
cash flows times discount factors. Equivalent ways to state the same curve:

| Quantity | Definition | Read it as |
|---|---|---|
| Zero rate $z(T)$ | $P(0,T) = e^{-z(T)\,T}$ | Average rate from today to $T$ |
| Forward rate $F(T_1,T_2)$ | $\dfrac{1}{T_2-T_1}\left(\dfrac{P(0,T_1)}{P(0,T_2)} - 1\right)$ | Rate locked in today for a future period |
| Instantaneous forward $f(T)$ | $-\partial_T \ln P(0,T)$ | Forward rate for an instant at $T$ |

Zero rates are averages of forwards ($z(T)\,T = \int_0^T f$), so forwards swing more. Where the
zero curve rises, forwards sit above it.

**Bootstrapping** (`rates/bootstrap.py`) builds the curve from market quotes, shortest first.
Each quote adds one node, solved so that the quote reprices exactly:
- **Deposit** at simple rate $r$ to $T$: $P(0,T) = 1/(1 + rT)$.
- **FRA** for $[T_1,T_2]$: $P(0,T_2) = P(0,T_1)/(1 + r(T_2-T_1))$.
- **Par swap** at rate $s$: the fixed leg $s\sum_i \tau_i P(0,t_i)$ must equal the floating leg
  $1 - P(0,T_n)$. The last node is found by root-finding, because the coupon dates in between
  are interpolated from it.

The *Bootstrapped nodes* table shows the repricing errors: around $10^{-16}$, i.e. exact.

**Interpolation** is linear in $\ln P$, which means forwards are flat between nodes: the steps
on the chart. It is local (moving one quote moves only its own segment) and never creates
negative forwards from positive quotes. Smoother schemes, such as monotone convex (Hagan–West),
exist mainly to make forwards look less jagged.

**Why "single curve" is a simplification.** Before 2008 one curve both projected floating
rates and discounted cash flows. Since then, markets discount with an overnight curve
(SOFR/€STR) and project each floating index (3M, 6M) on its own curve, because the spreads
between them are no longer negligible. The bootstrap mechanics are the same, done once per curve.

---

## 2. Linear products (page: *Swaps & bonds*)

**Interest-rate swap.** One side pays a fixed rate $K$, the other pays the floating rate that
fixes each period. On a single curve, the floating leg is worth exactly $1 - P(0,T_n)$ per unit
notional, because a floating-rate note always resets to par. Hence:

$$\text{annuity } A = \sum_i \tau_i P(0,t_i), \qquad \text{par rate } S = \frac{1 - P(0,T_n)}{A},
\qquad \text{payer NPV} = N\,A\,(S - K).$$

A swap at the par rate is worth zero. That is how swaps are quoted, and why bootstrapping works.
The *Cash flows* chart shows the projected floating coupons (from forward rates) against the
fixed ones. Neither leg is known in advance except the fixed leg; only their present values
balance.

**DV01** is the value change when rates move 1bp. Here it is measured as a parallel 1bp fall in
zero rates (the lab's sign convention: positive means you gain when rates fall). A payer swap has
negative DV01: it gains when rates rise. The *Value if rates move* chart shows the whole profile.
Its slope at zero is the DV01, and the slight curvature is convexity.

**Fixed-rate bond.** A bond is a strip of coupons plus the face value, discounted on the curve.
The **yield to maturity** $y$ is the single rate that reproduces that price. Against $y$:
- **Macaulay duration** is the present-value-weighted average time of the cash flows.
- **Modified duration** $D$ is the percentage price change per unit change in yield:
  $\Delta P/P \approx -D\,\Delta y$.
- **Convexity** $C$ is the second-order term: $\Delta P/P \approx -D\,\Delta y + \tfrac12 C\,\Delta y^2$.

The *Price against yield* chart shows why convexity matters. The duration line is the tangent and
always lies below the true curve, so a bond gains more when yields fall than it loses when they
rise by the same amount.

---

## 3. Caps, floors and swaptions (page: *Caps & swaptions*)

**Caplets.** A caplet on period $[t_{i-1}, t_i]$ pays $\tau_i \max(L_i - K, 0)$ at $t_i$, where
$L_i$ is the rate that fixes at $t_{i-1}$. Measured in units of the bond $P(\cdot, t_i)$ (the
"$t_i$-forward measure"), $L_i$ has no drift. A caplet is then simply a call on a forward rate:

$$\text{caplet} = \tau_i\,P(0,t_i)\,\text{Call}(F_i, K, t_{i-1}, \sigma).$$

A **cap** is a strip of caplets, and a **floor** is a strip of floorlets (puts). The first period
is excluded because its rate is already fixed. Cap − floor = payer swap (over the caplet periods);
the tests check this parity.

**Swaptions.** A payer swaption is the right, at expiry $T$, to enter a payer swap at strike $K$.
Measured in units of the annuity $A$, the forward swap rate $S$ has no drift, so:

$$\text{payer swaption} = N\,A(0)\,\text{Call}(S, K, T, \sigma).$$

**Two volatility languages.** "Call" above needs a model for the rate:

| | Black-76 (lognormal) | Bachelier (normal) |
|---|---|---|
| Rate moves | in proportion to its level, $dF = \sigma F\,dW$ | by fixed amounts, $dF = \sigma_N\,dW$ |
| Vol quoted as | % of the rate (e.g. 25%) | basis points a year (e.g. 90bp) |
| Negative rates | impossible ($\ln F$ undefined) | allowed |
| Value | $F N(d_1) - K N(d_2)$ | $(F-K)N(d) + \sigma_N\sqrt{T}\,n(d)$ |

Both are exact for their own assumption and quoted side by side in markets. EUR and JPY rates
went negative around 2015, and that pushed markets to quote normal vols. The page reports the
*equivalent* vol in the other model: the vol that gives the same price.

**What each model implies about the smile.** Match both models at the money and convert
Bachelier's prices back into Black vols across strikes. You get a **skew**: low strikes need a
higher Black vol, because a fixed bp move is a larger percentage of a low rate. Real rate smiles
sit between the two models, which is what SABR (Phase 2) interpolates with its $\beta$.

---

## 4. Short-rate models (page: *Short-rate models*)

Black-76 prices each option on its own forward rate, which is fine for caps and European
swaptions. It cannot price products whose payoff depends on *several* future curves at once. A
**Bermudan swaption** is the standard example: it can be exercised on any of several dates. That
needs a model of how the whole curve evolves. Short-rate models drive everything with one random
instantaneous rate $r(t)$, and bonds are expectations of $e^{-\int r}$.

**Vasicek (1977):** $dr = a(b - r)\,dt + \sigma\,dW$. The rate is pulled towards level $b$ at
speed $a$, with constant volatility. Bonds have closed forms $P(t,T) = A(t,T)\,e^{-B(t,T)r(t)}$,
where $B = (1 - e^{-a(T-t)})/a$. Three constants can produce only a few curve shapes (rising,
falling, slightly humped), so Vasicek **cannot fit today's market curve**. The *Does the model fit
today's curve?* chart shows the mismatch.

**Hull–White (1990):** $dr = (\theta(t) - a r)\,dt + \sigma\,dW$. The time-dependent drift
$\theta(t)$ is solved so the model reproduces today's curve exactly. That is why the HW median
path follows the market forwards, steps included. All the Vasicek formulas carry over, using the
market's $P(0,T)$. Two parameters remain:
- $a$, mean reversion: how fast shocks fade. Higher $a$ damps long-dated volatility.
- $\sigma$, absolute rate volatility (100bp = 0.01 per year). Rates can go negative, which was
  once a flaw and is now realistic.

**Closed forms.** In Gaussian models an option on a zero-coupon bond has a Black-like formula.
A caplet is a put on a zero bond, so caps price in closed form. A swaption is an option on a
*coupon* bond. **Jamshidian's trick** finds the short rate $r^*$ at which the coupon bond equals
the strike, and splits the swaption into a sum of zero-bond options with strikes $P(T, t_i \mid
r^*)$. This is exact, because every bond price falls monotonically in the one factor $r$.

**Trinomial tree** (`rates/tree.py`, Hull–White 1994) for early exercise:
1. Build a symmetric tree for $x = r - \alpha(t)$, which reverts to zero. The tree is truncated
   where branching bends inwards, so probabilities stay positive.
2. Shift each time slice by $\alpha_m$, solved forward with Arrow–Debreu prices, so the tree
   reprices every discount factor exactly.
3. Roll back. At each exercise date, take the larger of continuing and exercising (the swap's
   value at that node).

The European swaption from the tree matches Jamshidian to ~0.1% (48 steps per period on the
page). The Bermudan matches QuantLib's `TreeSwaptionEngine` to 0.03% (tested).

**Why the Bermudan premium can be large.** The page's default is a 2Y-into-5Y swaption with
$a = 0.05$ on an upward-sloping curve. It is worth ~31% more than the European. Later exercise
enters a shorter swap at the same strike, and with rising forwards those shorter swaps are already
in the money. Low mean reversion keeps late volatility high too. Raise $a$ and the premium shrinks.

**Calibration.** The calibration card fits $(a, \sigma)$ so model cap prices match at-the-money
caps quoted as flat Black vols. The error is measured on prices relative to the quote and
reported back in Black vol points. Two parameters cannot match six quotes, and the residual
shows the model's limits. Hull–White's single factor and absolute volatility produce cap vols
that fall with maturity in a fixed shape. Desks calibrate to the instruments they are hedging
(co-terminal swaptions for a Bermudan) and accept misfit elsewhere. Richer models (two-factor
G2++, LMM, SABR-LMM) exist to fit more of the surface.

---

## 5. Validation

| Check | Result |
|---|---|
| Bootstrap repricing of every quote | < 1e-12 (observed ~1e-16) |
| Swap at par rate | NPV 0; payer + receiver = 0 |
| Cap − floor = payer swap; payer − receiver swaption = forward swap | 1e-9 |
| Black / Bachelier implied-vol round trips | 1e-10 |
| Vasicek bond option vs QuantLib | 1e-12 |
| Hull–White bond option vs QuantLib | 1e-12 |
| Hull–White reprices the input curve | 1e-4 analytic; 0.2% by simulation |
| Tree reprices the curve; European tree vs Jamshidian | 1e-12; 0.1% |
| Bermudan swaption vs QuantLib `TreeSwaptionEngine` | 0.1% (observed 0.03%) |

---

## References

- Hull, *Options, Futures, and Other Derivatives*, ch. 4, 7 (curves, swaps), 29 (Black-76 for
  rates), 31–32 (short-rate models, trees)
- Brigo & Mercurio, *Interest Rate Models: Theory and Practice*, ch. 1 (curves), 3 (one-factor
  models, Jamshidian), 6 (caps and swaptions)
- Andersen & Piterbarg, *Interest Rate Modeling*, vol. 1 (multi-curve, conventions)
- Hagan & West (2006), "Interpolation methods for curve construction", *Applied Mathematical Finance*
- Hull & White (1994), "Numerical procedures for implementing term structure models I", *J. Derivatives*
- Jamshidian (1989), "An exact bond option formula", *J. Finance*
- Bachelier (1900), *Théorie de la spéculation*
