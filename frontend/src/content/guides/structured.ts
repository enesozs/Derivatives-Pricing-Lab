import type { PageGuide } from './types'

export const STRUCTURED: PageGuide[] = [
  {
    id: 'structured-autocallable',
    path: '/structured',
    title: 'Autocallable notes',
    purpose:
      'Value an autocallable note, the most popular structured product, and see when it ends, what investors receive, and what drives its coupon.',
    workflow: [
      'Read the note’s value: below 100% means the issuer earns a margin at this coupon.',
      'Press “Set the fair coupon” to make it worth exactly 100%.',
      'Change volatility, barriers or the number of underlyings and watch the fair coupon.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Term sheet, underlyings, model',
        what: 'The note’s terms (levels in % of the initial fixing), single stock or worst-of, the model and the market.',
        read: [
          'Autocall level: redeem early if the stock is at or above it on an observation date.',
          'Coupon barrier: coupons are paid only above it. Protection barrier: below it at maturity, the investor takes the loss.',
          'Memory coupons: missed coupons are paid later if the stock recovers.',
        ],
      },
      {
        key: 'hero',
        label: 'Value and key numbers',
        what: 'The note’s value in % of notional (Monte Carlo, with its interval), the fair coupon, the chance of losing capital, the expected life and the chance of an early call.',
        read: [
          '99.89% at an 8% coupon: almost fair; the fair coupon is 8.14%.',
          'Expected life 1.0 year out of 3: most notes are called early.',
          'These probabilities are risk-neutral (pricing) probabilities, not forecasts.',
        ],
      },
      {
        key: 'When does the note end?',
        label: 'Redemption dates',
        what: 'One bar per observation date: the probability of being redeemed then. The last bar splits into repaid at par (blue) and capital loss (orange).',
        read: [
          'A tall first bar: the note usually ends at the first observation.',
          'The orange slice is the risk the investor is paid for.',
        ],
      },
      {
        key: 'What the investor ends up with',
        label: 'Return distribution',
        what: 'Histogram of total return per path: coupons received plus redemption minus the 100 invested.',
        read: [
          'A tall cluster of small gains and a thin tail of large losses: the profile of having sold a put.',
        ],
      },
      {
        key: 'Fair coupon against volatility',
        label: 'Coupon vs volatility',
        what: 'x: volatility; y: the fair coupon, with the current volatility marked.',
        read: ['Rising: high coupons are a sign of high volatility, i.e. risk.'],
      },
      {
        key: 'Fair coupon against correlation',
        label: 'Coupon vs correlation',
        what: 'For worst-of notes: x: correlation between the stocks; y: the fair coupon.',
        read: [
          'Falling: low correlation makes the worst stock worse, so the investor demands more coupon.',
        ],
      },
    ],
  },
  {
    id: 'structured-reverse-convertible',
    path: '/structured/reverse-convertible',
    title: 'Reverse convertibles',
    purpose:
      'Take a reverse convertible apart into a bond, coupons and a sold put, and see what the investor gets back.',
    workflow: [
      'Read the decomposition: bond + coupons − put = note.',
      'Press “Set the fair coupon”.',
      'Add or remove the barrier and change the volatility.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Term sheet and model',
        what: 'Maturity, coupon, conversion strike and an optional knock-in barrier (levels in % of the initial fixing).',
        read: [
          'With a barrier, the investor only converts into shares if the stock also touched the barrier during the note’s life.',
        ],
      },
      {
        key: 'hero',
        label: 'Value',
        what: 'The note’s value in % of notional, the fair coupon, the value of the put sold, and the chance of touching the barrier.',
        read: [
          'Above 100% means the coupon is more than the risk justifies; issuers price below 100%.',
        ],
      },
      {
        key: 'What the note is made of',
        label: 'Decomposition',
        what: 'The three pieces: a zero-coupon bond, the coupon stream, minus the put the investor has sold.',
        read: [
          'Every number here can be checked separately: the put value is the same as on the vanilla or exotic pricer.',
        ],
      },
      {
        key: 'What you get back at maturity',
        label: 'Payoff at maturity',
        what: 'x: final stock level (% of initial); y: total received (% of notional). Blue if the barrier was never touched, orange if it was.',
        read: [
          'Above the strike: 100 plus coupons. Below it (after a touch): shares worth less, falling one-for-one with the stock.',
        ],
      },
      {
        key: 'Fair coupon against volatility',
        label: 'Coupon vs volatility',
        what: 'x: volatility; y: the fair coupon.',
        read: ['The coupon is mostly put premium, so it rises with volatility.'],
      },
    ],
  },
  {
    id: 'structured-cliquet',
    path: '/structured/cliquet',
    title: 'Cliquets',
    purpose:
      'Price a cliquet (a sum of capped periodic returns) under two models that agree today but disagree about the future, and see the size of that model risk.',
    workflow: [
      'Compare the Black–Scholes and Heston values.',
      'Change the local cap and the guaranteed minimum.',
      'Increase vol of variance and watch the model gap grow.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Contract and models',
        what: 'Maturity, reset frequency, local cap and floor per period, the guaranteed total minimum, and the two models’ parameters.',
        read: [
          'Example: quarterly returns capped at 2% each, floored at 0%, total guaranteed at least 2%.',
        ],
      },
      {
        key: 'hero',
        label: 'Two values',
        what: 'The value under Black–Scholes and under Heston, and the gap between them in % of notional.',
        read: [
          'The gap is model risk: neither number is “right”; the market does not tell us future smiles.',
        ],
      },
      {
        key: 'The building block: a forward-start option',
        label: 'Forward-start option',
        what: 'An at-the-money option whose strike is set in a year: closed form, and Monte Carlo under both models.',
        read: [
          'Black–Scholes closed form and Monte Carlo should agree; Heston differs because it predicts a different future smile.',
        ],
      },
      {
        key: 'Value against the local cap',
        label: 'Value vs cap',
        what: 'x: local cap (%); y: value, one line per model.',
        read: [
          'Each extra point of cap is worth less than the last: high period returns are rare.',
        ],
      },
      {
        key: 'Total payoff across paths',
        label: 'Payoff distribution',
        what: 'Histogram of the total payoff per path, both models on the same bins.',
        read: [
          'The spike on the left is the guaranteed minimum paying out; the right edge is every period hitting the cap.',
        ],
      },
    ],
  },
  {
    id: 'structured-variance',
    path: '/structured/variance',
    title: 'Variance swaps',
    purpose:
      'Find the fair strike of a variance swap from a strip of options, see where replication works and where it breaks (jumps), and compare with a volatility swap.',
    workflow: [
      'Read the fair variance strike (in volatility points) and the exact model value.',
      'Increase the number of options and watch the replication error shrink.',
      'Switch to Jumps to see replication fail.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Model and strip',
        what: 'The model, the contract maturity, the number of options in the replicating strip and the range of strikes it covers.',
        read: [
          'Strike range is in standard deviations around the forward: wider catches more of the tails.',
        ],
      },
      {
        key: 'hero',
        label: 'Fair strikes',
        what: 'The replicated variance strike as a volatility (√K_var), the model’s exact value, the replication error, a simulation check and the volatility swap strike.',
        read: [
          'Variance swaps are quoted in volatility points: 25.17 means a variance of 0.2517².',
          'The volatility swap strike is lower: the convexity adjustment.',
        ],
      },
      {
        key: 'The smile the options are priced on',
        label: 'Smile',
        what: 'Black–Scholes implied volatility of each option in the strip, with the forward marked.',
        read: [
          'A steep put skew means the low strikes (heavily weighted) are expensive, so variance is expensive.',
        ],
      },
      {
        key: 'The replicating strip',
        label: 'Strip contributions',
        what: 'Each bar is one out-of-the-money option’s share of the fair variance: puts (blue) below the forward, calls (orange) above.',
        read: ['Most value sits near the money; puts outweigh calls because of the 1/K² weights.'],
      },
      {
        key: 'More options, smaller error',
        label: 'Replication convergence',
        what: 'x: options in the strip (log scale); y: replicated strike, against the exact value (dashed).',
        read: [
          'The gap falls with the square of the strike spacing; the VIX faces the same issue with listed strikes.',
        ],
      },
      {
        key: 'Realised volatility across paths',
        label: 'Realised volatility',
        what: 'Histogram of the volatility realised on each simulated path, with dashed lines at the volatility-swap strike (left) and √K_var (right).',
        read: [
          'The wider this distribution (vol of vol), the bigger the gap between the two lines.',
        ],
      },
    ],
  },
  {
    id: 'structured-risk',
    path: '/structured/risk',
    title: 'Portfolio risk',
    purpose:
      'Risk-manage a book that mixes options, barriers and notes: combined Greeks, a stress grid, and stress scenarios comparing exact revaluation with the Greeks’ estimate.',
    workflow: [
      'Load a preset book (or build one).',
      'Read the book Greeks, then the per-position table.',
      'Use the stress grid and the scenario table to find where the book loses money.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Positions',
        what: 'One card per position: product, quantity (options) or notional (notes; negative = short), strike, barrier, years and coupon. Presets fill in typical books.',
        read: ['“Note issuer”: a bank that sold notes to clients and bought some puts back.'],
      },
      {
        key: 'Book Greeks',
        label: 'Book Greeks',
        what: 'The whole book’s sensitivities in currency: per 1% spot move, P&L from a 1% move due to gamma, per volatility point, per 1% of rates.',
        read: [
          'Delta −6,050 per 1%: like being short 6,050 shares; the book loses if the market rises.',
        ],
      },
      {
        key: 'Positions',
        label: 'Per-position table',
        what: 'Each position’s value and Greeks, with the book total last.',
        read: ['Find which position drives each risk: here the notes dominate vega.'],
      },
      {
        key: 'Stress grid: book P&L by spot and volatility',
        label: 'Stress grid',
        what: 'Columns: spot moves (−30% to +30%); rows: volatility moves; colour: book P&L (blue profit, red loss). Hover a cell for its value.',
        read: [
          'Find the red corner: that is the scenario to worry about. For the note issuer: falling volatility, worst with the spot flat or slightly lower (the bottom middle).',
        ],
      },
      {
        key: 'Scenarios: full revaluation against the Greeks',
        label: 'Scenario table',
        what: 'Named stress scenarios: exact P&L by full revaluation, the Greeks’ estimate, and the difference.',
        read: [
          'Small moves: estimates are close. A crash: they can be off by 20% or more, so risk is measured by revaluing.',
        ],
      },
    ],
  },
]
