import type { PageGuide } from './types'

export const VOLATILITY: PageGuide[] = [
  {
    id: 'volatility-surface',
    path: '/volatility',
    title: 'Implied volatility surface',
    purpose:
      'Turn real option prices into the volatility surface: one implied volatility for every strike and expiry. This is the market’s view, before any model.',
    workflow: [
      'Choose a data source: the bundled SPY snapshot, synthetic data or a live download.',
      'Pick an expiry in the smile chart and compare quotes with the fitted curve.',
      'Read the term structure, rotate the 3D surface, and check the cleaning table.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Data source',
        what: 'Where the option prices come from, and the interest rate used to discount (forwards are inferred from the prices themselves).',
        read: [
          'SPY snapshot is a real chain saved with the app: the same numbers every time.',
          'Synthetic data is generated from a Heston model and is labelled as such everywhere.',
          'Live fetches delayed quotes from Yahoo Finance; outside market hours prices may be stale.',
        ],
      },
      {
        key: 'Volatility smile',
        match: 'prefix',
        label: 'Smile for one expiry',
        what: 'x: strike; y: implied volatility (%). Dots are market quotes, the orange line the SVI fit; the vertical line is the forward. Tabs select the expiry.',
        read: [
          'The downward slope is the skew: low strikes (crash protection) cost more volatility than high ones.',
          'Dots scattered around the line are noise from bid–ask and stale trades; the fit error is in the title.',
          'Short expiries (6d, 9d) have the steepest curves.',
        ],
        try: 'Click through the expiry tabs from shortest to longest and watch the curve flatten.',
      },
      {
        key: 'Term structure',
        label: 'Term structure',
        what: 'x: years to expiry; y: at-the-money implied volatility.',
        read: [
          'Rising (upward-sloping) is the calm-market norm: more can happen over longer horizons.',
          'Falling (inverted) means the market expects turbulence soon, typical after a shock.',
        ],
      },
      {
        key: 'The volatility surface',
        label: '3D surface',
        what: 'Implied volatility over strike (% of forward) and maturity; drag to rotate. The tab switches to the local volatility surface derived from it.',
        read: [
          'Each slice along strike is one smile; each slice along maturity is a term structure.',
          'Local volatility is steeper and spikier: it is the volatility at one spot and time, not an average.',
        ],
      },
      {
        key: 'From raw quotes to a smile',
        label: 'Cleaning report',
        what: 'For each expiry: quotes used, quotes dropped and why, the forward, the at-the-money volatility, the SVI fit error and arbitrage checks.',
        read: [
          'Most dropped quotes are stale last-trade prices or too far out of the money to be reliable.',
          '“None” under Arbitrage means the fitted smile cannot be exploited with a butterfly or calendar trade.',
        ],
      },
    ],
  },
  {
    id: 'volatility-models',
    path: '/volatility/models',
    title: 'Volatility models',
    purpose:
      'Explore what each model assumes about volatility, and the smile and price distribution that assumption produces.',
    workflow: [
      'Pick a model: BS (constant), Heston (random volatility), Merton (jumps) or SABR.',
      'Move one parameter at a time; each has a one-line explanation under it.',
      'Read the smile chart and the distribution together.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Model and parameters',
        what: 'The model and its parameters, each with a note on what it controls.',
        read: [
          'For Heston: √v₀ is roughly short-dated at-the-money volatility, √θ the long-dated one.',
          'Reset restores the defaults, which are typical equity values.',
        ],
      },
      {
        key: 'The smile this model implies',
        label: 'Smile per expiry',
        what: 'x: strike (% of spot); y: implied volatility. One line per expiry, light (short) to dark (long).',
        read: [
          'A flat line means no smile: Black–Scholes. Any slope or curve is the model’s doing.',
          'Negative correlation (Heston) or negative mean jumps (Merton) tilt the smile down to the right: skew.',
          'Gaps appear where an option is too cheap to imply a volatility reliably.',
        ],
      },
      {
        key: 'Where the model thinks the price will end up',
        label: 'Price distribution',
        what: 'The risk-neutral probability density of the price at the chosen expiry, with today’s spot marked.',
        read: [
          'A long left tail means big falls are more likely than a lognormal would say: that is what makes puts expensive.',
          'The peak sits slightly right of today’s spot because the price grows at the interest rate on average.',
        ],
      },
    ],
  },
  {
    id: 'volatility-calibration',
    path: '/volatility/calibration',
    title: 'Model calibration',
    purpose:
      'Fit a model’s parameters to the whole market surface at once, and see where the model can and cannot match the market.',
    workflow: [
      'Choose the data and the model (Heston fits all expiries at once; SABR one expiry at a time).',
      'Read the fit error and the fitted parameters.',
      'Scan the small multiples for the expiries the model struggles with.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Data and model',
        what: 'The same data sources as the Surface page, and the model to calibrate.',
        read: [
          'Calibration re-runs automatically when the data or model changes; it takes about a second.',
        ],
      },
      {
        key: 'hero',
        label: 'Fit and parameters',
        what: 'The root-mean-square error in volatility points across all quotes, the fitted parameters with their meaning, and the Feller condition check.',
        read: [
          'An RMSE of 0.76 means the model misses market volatilities by about 0.76 points on average.',
          'A violated Feller condition means variance can touch zero: common for equity fits, harmless for pricing with Fourier methods.',
        ],
      },
      {
        key: 'Market vs model, expiry by expiry',
        label: 'Fit per expiry',
        what: 'One small chart per expiry: market quotes (dots) and the calibrated model (line), with each expiry’s error in the corner.',
        read: [
          'Look for systematic misses, not scattered noise: the shortest expiries usually have more skew than Heston can produce.',
          'Every panel shares one set of parameters; improving one expiry usually worsens another.',
        ],
      },
    ],
  },
]
