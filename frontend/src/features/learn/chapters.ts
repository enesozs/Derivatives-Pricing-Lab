/** The course: one chapter per docs/ note, each with guided experiments in the lab. */

export interface Experiment {
  title: string
  /** Page to open. */
  to: string
  /** What to do there, in order (control names as they appear on the page). */
  steps: string[]
  /** What to look for, and why it happens. */
  notice: string
}

export interface Chapter {
  id: string
  title: string
  summary: string
  /** Main page of the matching area. */
  area: string
  areaLabel: string
  experiments: Experiment[]
}

export const CHAPTERS: Chapter[] = [
  {
    id: '01-vanilla-options',
    title: 'Vanilla options',
    summary:
      'Calls and puts, Black–Scholes, the Greeks, and four ways to compute a price: closed form, trees, PDE grids and Monte Carlo. Then strategies and delta hedging.',
    area: '/vanilla',
    areaLabel: 'Vanilla',
    experiments: [
      {
        title: 'Every method agrees, at different speeds',
        to: '/vanilla',
        steps: [
          'Keep the default at-the-money call.',
          'Compare the prices from the five methods in the method table.',
          'Switch Exercise style to American and set the option type to Put.',
        ],
        notice:
          'For the European call every method lands on the same value; they differ only in error and time. For the American put the closed form drops out (there is none) and the tree and PDE price the early-exercise premium.',
      },
      {
        title: 'Why trees zig-zag',
        to: '/vanilla/methods',
        steps: [
          'Look at Grid and tree convergence.',
          'Switch Tree scheme between CRR, Jarrow–Rudd and Leisen–Reimer.',
        ],
        notice:
          'CRR’s error oscillates as the strike falls between tree nodes; Leisen–Reimer centres the tree on the strike and converges smoothly and much faster.',
      },
      {
        title: 'Implied volatility is the market’s language',
        to: '/vanilla/implied-vol',
        steps: [
          'Raise the Observed price.',
          'Watch the implied volatility and What the solver inverts.',
        ],
        notice:
          'Price and volatility are one-to-one: the solver finds the single volatility that reproduces the price. Traders quote options in volatility because it is comparable across strikes and expiries.',
      },
      {
        title: 'Hedging is never perfect',
        to: '/vanilla/hedging',
        steps: [
          'Note the spread of Distribution of hedged P&L.',
          'Increase Re-balances over the life, then add Trading costs.',
        ],
        notice:
          'The P&L spread shrinks like 1/√(re-balances), the Derman–Kamal rule, but costs grow with every trade. Real hedging is a trade-off between the two.',
      },
    ],
  },
  {
    id: '02-volatility',
    title: 'Volatility beyond a constant',
    summary:
      'Real option prices imply a different volatility at every strike and expiry: the smile and the surface. SVI, local volatility, Heston, SABR and calibration.',
    area: '/volatility',
    areaLabel: 'Volatility',
    experiments: [
      {
        title: 'The smile is real',
        to: '/volatility',
        steps: [
          'Use the SPY snapshot data source.',
          'Look at the smile for a short and a long expiry.',
        ],
        notice:
          'Low strikes trade at higher implied volatility: the market pays up for crash protection. Short expiries have the steepest skew, flattening with maturity.',
      },
      {
        title: 'Correlation makes the skew',
        to: '/volatility/models',
        steps: ['Choose Heston.', 'Move Correlation ρ from −0.9 to +0.5.'],
        notice:
          'With negative spot–vol correlation, volatility rises when the stock falls, fattening the left tail: a downward skew. Positive correlation tilts it the other way.',
      },
      {
        title: 'Vol of vol makes the smile',
        to: '/volatility/models',
        steps: ['With Heston, set ρ near 0.', 'Increase Vol of variance ξ.'],
        notice:
          'Random volatility fattens both tails, so both wings rise: a symmetric smile. Its curvature grows with ξ.',
      },
      {
        title: 'Fitting a model to the market',
        to: '/volatility/calibration',
        steps: ['Calibrate Heston to the surface.', 'Read Market vs model, expiry by expiry.'],
        notice:
          'Five parameters cannot fit every expiry exactly: short-dated skews are usually too steep for Heston. That residual is why jumps and local volatility exist.',
      },
    ],
  },
  {
    id: '03-exotics',
    title: 'Exotic options',
    summary:
      'Payoffs that depend on the path: barriers, Asians, lookbacks and digitals, priced in closed form, on PDE grids and by Monte Carlo. American options by simulation.',
    area: '/exotics',
    areaLabel: 'Exotics',
    experiments: [
      {
        title: 'A barrier is a discount for a risk',
        to: '/exotics',
        steps: [
          'Choose Barrier, Down, Out, and move the barrier closer to the spot.',
          'Compare with the vanilla value.',
        ],
        notice:
          'The closer the barrier, the likelier the knock-out, and the cheaper the option. In + out always equals the vanilla (in–out parity).',
      },
      {
        title: 'Model risk in exotics',
        to: '/exotics',
        steps: ['Keep the barrier option.', 'Switch the model from Black–Scholes to Heston.'],
        notice:
          'Same volatility level, noticeably different price: the barrier depends on how volatility moves near the barrier, which the two models disagree on.',
      },
      {
        title: 'Averaging calms things down',
        to: '/exotics',
        steps: ['Choose Asian, Arithmetic.', 'Compare its value with the vanilla.'],
        notice:
          'An average moves less than the final price, so the Asian is worth less: roughly a vanilla with volatility divided by √3.',
      },
      {
        title: 'When to exercise early',
        to: '/exotics/american',
        steps: [
          'Look at Where the simulation chooses to exercise.',
          'Increase the Risk-free rate.',
        ],
        notice:
          'Longstaff–Schwartz learns the exercise boundary by regression; higher rates make early exercise of a put more valuable, pushing the boundary up.',
      },
    ],
  },
  {
    id: '04-multi-asset',
    title: 'Multi-asset options and correlation',
    summary:
      'Options on several underlyings: exchange, spread, basket, best-of and worst-of options, and quantos. Correlation becomes a price input you cannot hedge.',
    area: '/multi-asset',
    areaLabel: 'Multi-asset',
    experiments: [
      {
        title: 'Correlation cuts both ways',
        to: '/multi-asset',
        steps: [
          'Switch Product between Basket and Best-of.',
          'Read Price against correlation for each.',
        ],
        notice:
          'A basket gets dearer as correlation rises (less diversification); a best-of gets cheaper (less chance that one asset breaks away).',
      },
      {
        title: 'Seeing correlation',
        to: '/multi-asset',
        steps: [
          'Look at Joint scenarios at expiry.',
          'Move the correlation from 0 to 0.9 and to negative values.',
        ],
        notice: 'Independent assets give a round cloud; correlated ones a tilted ellipse.',
      },
      {
        title: 'The quanto adjustment',
        to: '/multi-asset/quanto',
        steps: ['Move Asset–FX correlation from −0.9 to +0.9.'],
        notice:
          'Paying a foreign stock’s payoff at a fixed exchange rate shifts its drift by −ρσσ. The Monte Carlo check confirms the closed form.',
      },
    ],
  },
  {
    id: '05-rates',
    title: 'Interest-rate derivatives',
    summary:
      'Discount curves and bootstrapping, swaps and bonds, caps and swaptions under Black and Bachelier, and short-rate models with Bermudan swaptions.',
    area: '/rates',
    areaLabel: 'Rates',
    experiments: [
      {
        title: 'One curve prices everything',
        to: '/rates',
        steps: ['Press +25bp under Parallel shift.', 'Open Swaps & bonds and Caps & swaptions.'],
        notice:
          'Every Rates page reprices on the edited curve. A payer swap gains when rates rise; bond prices fall.',
      },
      {
        title: 'Convexity is free money (almost)',
        to: '/rates/linear',
        steps: ['Look at Price against yield.', 'Increase the bond’s maturity to 30 years.'],
        notice:
          'Duration alone underprices the bond for every move; long bonds are much more convex, so the gap widens.',
      },
      {
        title: 'Two volatility languages',
        to: '/rates/options',
        steps: [
          'Switch between Black (lognormal) and Bachelier (normal).',
          'Read the equivalent vol.',
        ],
        notice:
          'The same price can be quoted as a % volatility or a bp volatility. Converting across strikes shows the skew each model implies.',
      },
      {
        title: 'The value of choice',
        to: '/rates/models',
        steps: ['Read the early-exercise premium.', 'Increase Mean reversion a.'],
        notice:
          'A Bermudan swaption can be exercised on several dates, worth more than any single European. Strong mean reversion damps future volatility, shrinking that premium.',
      },
    ],
  },
  {
    id: '06-structured',
    title: 'Structured products and portfolio risk',
    summary:
      'Notes sold to investors (autocallables, reverse convertibles, cliquets), variance swaps, and stress-testing a whole book.',
    area: '/structured',
    areaLabel: 'Structured',
    experiments: [
      {
        title: 'A high coupon is a sold put',
        to: '/structured/reverse-convertible',
        steps: ['Press Set the fair coupon.', 'Raise the model’s Volatility level.'],
        notice:
          'The note decomposes into bond + coupons − put. More volatility makes the put dearer, so a fair note needs a higher coupon: high coupons signal risk.',
      },
      {
        title: 'Worst-of means short correlation',
        to: '/structured',
        steps: ['Choose Worst of 3.', 'Read Fair coupon against correlation.'],
        notice:
          'Lower correlation makes the worst performer worse, so the investor needs a higher coupon. The issuing bank ends up long correlation.',
      },
      {
        title: 'Same smile today, different tomorrow',
        to: '/structured/cliquet',
        steps: ['Compare the Black–Scholes and Heston values.', 'Increase Vol of variance ξ.'],
        notice:
          'A cliquet is a strip of forward-starting options; its price depends on the smile the model predicts in the future, which is where the models disagree.',
      },
      {
        title: 'When the Greeks lie',
        to: '/structured/risk',
        steps: [
          'Load the Note issuer preset.',
          'Compare full revaluation with the Greek estimate in the crash scenario.',
        ],
        notice:
          'Delta and gamma describe small moves. In a crash the Greeks themselves change, and barriers switch on: only full revaluation gets it right.',
      },
    ],
  },
  {
    id: '07-credit',
    title: 'Credit and counterparty risk',
    summary:
      'Default probabilities from CDS spreads, the credit triangle, and CVA: the price of the chance your counterparty defaults while owing you money.',
    area: '/credit',
    areaLabel: 'Credit',
    experiments: [
      {
        title: 'Spreads are default probabilities',
        to: '/credit',
        steps: ['Read the 5Y default probability.', 'Press Distress ×3.'],
        notice:
          'Spread ≈ default rate × (1 − recovery). Tripling spreads roughly triples the hazard rate, and survival falls much faster.',
      },
      {
        title: 'Recovery changes the reading, not the price',
        to: '/credit',
        steps: ['Lower the Recovery rate to 10%.', 'Watch the hazard rates and the upfront.'],
        notice:
          'Spreads are fixed by the market; a lower recovery means each default costs more, so fewer defaults are needed to explain the same spread.',
      },
      {
        title: 'The exposure hump',
        to: '/credit/xva',
        steps: [
          'Look at Exposure profile.',
          'Increase Rate volatility σ, then shorten the Maturity.',
        ],
        notice:
          'Exposure grows as rates diffuse and shrinks as payments are made. More volatility means more potential exposure and more CVA.',
      },
      {
        title: 'Collateral kills CVA',
        to: '/credit/xva',
        steps: ['Switch Collateral to Threshold.', 'Lower the threshold towards zero.'],
        notice:
          'Exposure above the threshold is collateralised, so CVA falls sharply. This is why interbank trades are collateralised.',
      },
    ],
  },
]

export function chapterById(id: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.id === id)
}

const sources = import.meta.glob<string>('../../../../docs/*.md', {
  query: '?raw',
  import: 'default',
})

/** The chapter's markdown, loaded on demand (each note is its own small chunk). */
export function loadChapterText(id: string): Promise<string> {
  const loader = sources[`../../../../docs/${id}.md`]
  if (!loader) return Promise.reject(new Error(`No chapter ${id}`))
  return loader()
}
