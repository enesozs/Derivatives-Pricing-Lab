import type { PageGuide } from './types'

export const RATES: PageGuide[] = [
  {
    id: 'rates-curves',
    path: '/rates',
    title: 'Yield curves',
    purpose:
      'Build the discount curve every Rates page uses, from market quotes of deposits and swaps. Edit it here and every Rates page reprices.',
    workflow: [
      'Read the zero and forward curves for the sample quotes.',
      'Edit a quote or press a parallel shift.',
      'Open the other Rates pages: they all use the curve you just built.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Quotes and shifts',
        what: 'One row per market quote: deposits (simple rates) for short maturities, par swap rates beyond. Buttons shift every quote at once.',
        read: [
          'The quotes are illustrative, not live market data.',
          'A par swap rate is the fixed rate that makes a swap worth zero today.',
        ],
        try: 'Raise the 10Y swap rate by 0.5% and watch the forward curve jump around the 10-year point.',
      },
      {
        key: 'Zero and forward curves',
        label: 'Zero and forward curves',
        what: 'x: maturity in years; y: rate (%). Blue: zero rates (average rate to each date); orange: instantaneous forwards (the rate for a moment at each date). Dots are the bootstrapped nodes.',
        read: [
          'Forwards are flat between nodes because of how discount factors are interpolated: the steps are expected.',
          'When the zero curve rises, forwards lie above it; when it falls, below.',
          'The summary above the chart gives 2Y, 10Y and 30Y zero rates and the 2s10s slope (10Y minus 2Y, in basis points).',
        ],
      },
      {
        key: 'Discount factors',
        label: 'Discount factors',
        what: 'x: maturity; y: today’s value of 1 paid at that date.',
        read: ['Always falling from 1. At 3% rates, 1 paid in 30 years is worth about 0.4 today.'],
      },
      {
        key: 'Bootstrapped nodes',
        label: 'Node table',
        what: 'For each quote: the discount factor and zero rate solved for, and the repricing error.',
        read: [
          'Errors around 1e-16 mean every quote is matched exactly, the defining property of a bootstrap.',
        ],
      },
    ],
  },
  {
    id: 'rates-linear',
    path: '/rates/linear',
    title: 'Swaps and bonds',
    purpose:
      'Value an interest-rate swap and a fixed-rate bond on the curve, and see how much they move when rates change.',
    workflow: [
      'Keep the swap at par (worth zero) or switch to an off-market fixed rate.',
      'Read the swap’s DV01 and cash flows, and its value under curve shifts.',
      'Change the bond’s coupon and maturity and read duration and convexity.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Swap and bond terms',
        what: 'The swap (direction, maturity, payment frequency, fixed rate) and the bond (coupon, maturity, coupon frequency). Notional 10M for the swap, face 100 for the bond.',
        read: ['Pay fixed (payer swap) gains when rates rise; receive fixed gains when they fall.'],
      },
      {
        key: 'hero',
        label: 'Swap value',
        what: 'The swap’s value (NPV), the par rate, the annuity and the DV01.',
        read: [
          'At the par rate the NPV is 0: neither side pays to enter.',
          'Annuity 4.48 means 1 paid every year for 5 years is worth 4.48 today.',
          'DV01 is the value change for a 1bp fall in rates: −4,657 means the payer loses 4,657 per basis point.',
        ],
      },
      {
        key: 'Cash flows',
        label: 'Cash flows',
        what: 'One bar pair per payment date: floating coupons received (blue, above zero) and fixed coupons paid (orange, below zero) for a payer swap.',
        read: [
          'The floating coupons are projected from forward rates, so their size follows the forward curve.',
        ],
      },
      {
        key: 'Value if rates move',
        label: 'Value under shifts',
        what: 'x: parallel shift of the curve (bp); y: the swap’s value.',
        read: [
          'Almost a straight line: the slope at zero is the DV01. Swaps have little convexity.',
        ],
      },
      {
        key: 'Bond analytics',
        label: 'Bond analytics',
        what: 'Price per 100 face, yield to maturity, Macaulay and modified duration, convexity and DV01.',
        read: [
          'Modified duration 8.2: a 1% rise in yield lowers the price by about 8.2%.',
          'Macaulay duration is the average time to the cash flows, weighted by their present value.',
        ],
      },
      {
        key: 'Price against yield',
        label: 'Price against yield',
        what: 'x: yield; y: price. Blue is the exact price; orange the duration (straight-line) estimate; green dashed adds convexity.',
        read: [
          'The exact curve bends above the straight line on both sides: convexity always helps the holder.',
        ],
      },
    ],
  },
  {
    id: 'rates-options',
    path: '/rates/options',
    title: 'Caps, floors and swaptions',
    purpose:
      'Price options on interest rates under the two standard models, Black (lognormal) and Bachelier (normal), and translate a volatility from one to the other.',
    workflow: [
      'Choose a product: cap, floor, payer or receiver swaption.',
      'Choose a volatility model and level, and a strike (ATM by default).',
      'Read the premium and the equivalent volatility in the other model.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Product and volatility',
        what: 'The product and its dates, the strike, and the volatility in the chosen model.',
        read: [
          'Black volatility is a % of the rate (25%); normal volatility is in basis points a year (about 90bp).',
          'A payer swaption is the right to pay fixed in a swap later: it gains when rates rise.',
        ],
      },
      {
        key: 'hero',
        label: 'Premium',
        what: 'The option’s price for a 10M notional, also in basis points of notional, with the strike, forward rate and equivalent volatility.',
        read: [
          '“Equivalent normal vol 89bp” is the Bachelier volatility giving exactly the same price.',
        ],
      },
      {
        key: 'One option per period',
        label: 'Caplets',
        what: 'For caps and floors: one bar per caplet (one option on each period’s rate), by fixing date.',
        read: [
          'Later caplets are worth more: more time for the rate to move. The cap price is the sum of the bars.',
        ],
      },
      {
        key: 'What each model assumes about the smile',
        label: 'Model smiles',
        what: 'x: strike; y: Black implied volatility. Blue: Black (flat by construction); orange: Bachelier prices converted to Black volatilities.',
        read: [
          'The orange line slopes down: a normal model implies a skew, which is closer to what rate markets show.',
        ],
      },
    ],
  },
  {
    id: 'rates-models',
    path: '/rates/models',
    title: 'Short-rate models',
    purpose:
      'Model the whole curve with one random short rate. Compare Vasicek and Hull–White, price European and Bermudan swaptions, and calibrate to caps.',
    workflow: [
      'Read the swaption prices at the top.',
      'Move mean reversion and volatility; watch the rate fans and the Bermudan premium.',
      'Edit cap volatilities in the calibration card and use the fitted parameters.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Dynamics and swaption',
        what: 'Mean reversion a and volatility σ (shared by both models), Vasicek’s long-run level b, the simulation horizon, and the swaption’s expiry and tenor.',
        read: [
          'σ is in basis points a year: 100bp means the rate typically moves about 1% a year.',
        ],
      },
      {
        key: 'payer swaption under Hull–White',
        match: 'suffix',
        label: 'Swaption prices',
        what: 'The European swaption by closed form and by tree, the Bermudan by tree, and the early-exercise premium.',
        read: [
          'The two European prices should agree closely (here within 0.1%): a check on the tree.',
          'Bermudan − European is the value of being able to exercise on several dates.',
        ],
      },
      {
        key: 'Hull–White short rate',
        label: 'Hull–White fan',
        what: 'Simulated short rate over time: the median (line) and the middle 50% and 90% of paths (shaded bands).',
        read: [
          'The median follows the market’s forward curve, steps included. The bands widen, then stabilise because of mean reversion.',
        ],
      },
      {
        key: 'Vasicek short rate',
        label: 'Vasicek fan',
        what: 'The same picture for Vasicek, whose rate is pulled to one constant level b.',
        read: ['Its median ignores the curve’s shape: compare it with the Hull–White fan.'],
      },
      {
        key: 'Does the model fit today’s curve?',
        label: 'Curve fit',
        what: 'Zero curves: market (blue), Hull–White (orange dashed) and Vasicek (green).',
        read: [
          'Hull–White sits exactly on the market curve by construction; Vasicek can only produce a few shapes.',
        ],
      },
      {
        key: 'Calibrate Hull–White to caps',
        label: 'Calibration',
        what: 'Editable market cap volatilities by maturity, the fitted a and σ with their error, and market vs model volatilities.',
        read: ['Two parameters cannot match six quotes; the remaining gap is the model’s limit.'],
        try: 'Press “Use fitted a, σ” to load the calibrated parameters into the model above.',
      },
    ],
  },
]
