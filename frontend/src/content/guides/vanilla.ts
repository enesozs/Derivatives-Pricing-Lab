import type { PageGuide } from './types'

export const VANILLA: PageGuide[] = [
  {
    id: 'vanilla-pricer',
    path: '/vanilla',
    title: 'Vanilla option pricer',
    purpose:
      'Price one call or put, see its Greeks, and check that five different numerical methods agree. Start here: every other page builds on these ideas.',
    workflow: [
      'Choose the contract (call or put, European or American, strike, expiry).',
      'Set the market (spot, rate, dividends) and the volatility.',
      'Read the value and Greeks at the top, then the charts to see how they change with the spot.',
      'Scroll to the method table and convergence charts to see how accurate each method is.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Inputs',
        what: 'Everything the price depends on, grouped as Contract (what is traded), Market (observable today), Model (the volatility assumption) and Numerics (resolution of the numerical methods).',
        read: [
          'Each slider has an exact number box: drag for intuition, type for precision.',
          'Percent inputs are annual and continuously compounded; time is in years.',
          'Numerics only change accuracy and speed, never the theoretical value.',
        ],
        try: 'Move Volatility from 20% to 40% and watch the value almost double for an at-the-money option.',
      },
      {
        key: 'hero',
        label: 'Value and Greeks',
        what: 'The option value per unit of underlying, split into intrinsic value (what exercising now would pay) and time value (the rest), plus the five Greeks.',
        read: [
          'Value 10.45 for a 100-strike call on a 100 stock means the option costs about 10% of the stock.',
          'Delta +0.64: the option gains about 0.64 for a 1 move in the stock, so hedging needs 0.64 shares.',
          'Gamma is how fast delta changes; vega is the value change per 1 volatility point; theta is value lost per calendar day; rho per 1% of rates.',
          'Hover the ⓘ next to each Greek for its definition.',
        ],
      },
      {
        key: 'Value across spot',
        label: 'Value across spot',
        what: 'x: the spot price; y: the option value. Blue is the value today, orange the payoff at expiry; the dot is today’s spot and the vertical line the strike.',
        read: [
          'The gap between blue and orange is time value: largest at the strike, shrinking far away from it.',
          'Deep in the money the blue line runs parallel to the payoff (delta ≈ 1); far out of the money it is flat at zero.',
          'Shorten Time to expiry and the blue curve collapses onto the payoff.',
        ],
      },
      {
        key: 'Delta across spot',
        aliases: ['Gamma across spot', 'Vega across spot', 'Theta across spot', 'Rho across spot'],
        label: 'Greek across spot',
        what: 'The selected Greek (tabs: Delta, Gamma, Vega, Theta, Rho) as a function of spot, with today’s value marked.',
        read: [
          'Delta is an S-curve from 0 to 1 for a call (−1 to 0 for a put): the slope of the value chart.',
          'Gamma and vega peak near the strike: that is where the option is most sensitive and hardest to hedge.',
          'Theta is most negative near the strike: at-the-money options lose value fastest as time passes.',
        ],
        try: 'Pick Gamma, then shorten Time to expiry to 0.1 years: the peak becomes tall and narrow.',
      },
      {
        key: 'Same option, five methods',
        label: 'Method comparison',
        what: 'The same option priced by the closed form, two binomial trees, a PDE grid and Monte Carlo, with each method’s error against the closed form and its run time.',
        read: [
          'Error is the absolute difference from Black–Scholes; 1.4e-6 means agreement to the sixth decimal.',
          'Monte Carlo is the only method with a 95% interval: the true value lies inside it 95% of the time.',
          'For an American option the closed form is unavailable and the tree becomes the reference.',
        ],
      },
      {
        key: 'Grid and tree convergence',
        label: 'Convergence of trees and grids',
        what: 'x: number of steps (doubling each point); y: absolute error, on a log scale. One line per method.',
        read: [
          'On log–log axes a straight line means a power law: steeper = faster convergence.',
          'CRR zig-zags because the strike falls between tree nodes; Leisen–Reimer is smooth and much steeper.',
          'Each doubling multiplies the cost by about 4 for trees, so a steeper line is worth a lot.',
        ],
      },
      {
        key: 'Monte Carlo convergence',
        label: 'Monte Carlo convergence',
        what: 'x: number of simulated paths (log scale); y: the estimate (blue), its 95% interval (shaded) and the exact value (orange).',
        read: [
          'The shaded band narrows like 1/√paths: 4× the paths for half the width.',
          'The estimate wanders inside the band; it should contain the orange line most of the time.',
        ],
      },
    ],
  },
  {
    id: 'vanilla-implied-vol',
    path: '/vanilla/implied-vol',
    title: 'Implied volatility',
    purpose:
      'Run Black–Scholes backwards: given the price an option trades at, find the volatility that produces it. This is how markets quote options.',
    workflow: [
      'Enter the observed option price and the contract.',
      'Read the implied volatility, and check the price lies inside the no-arbitrage range.',
      'Use the chart to see how the solver finds it.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Inputs',
        what: 'The observed price, then the same contract and market inputs as the pricer. Volatility is missing on purpose: it is the output.',
        read: ['Prices are per unit of underlying, like the pricer’s value.'],
      },
      {
        key: 'hero',
        label: 'Implied volatility',
        what: 'The volatility that reproduces the observed price, the number of solver iterations and the residual, and a bar showing where the price sits between its lowest and highest possible values.',
        read: [
          'The left end of the bar is the price with zero volatility, the right end the price with infinite volatility. Outside that range no volatility works and the solver reports an arbitrage.',
          'A residual like −3.9e-12 means the implied volatility reprices the option to 12 decimals.',
        ],
        try: 'Type a price below the left end of the bar to see the arbitrage message.',
      },
      {
        key: 'What the solver inverts',
        label: 'Price against volatility',
        what: 'x: volatility; y: the Black–Scholes price. The blue curve is the model, the orange line the observed price; the dot where they cross is the implied volatility.',
        read: [
          'The curve only rises, so each price above the floor matches exactly one volatility.',
          'Where the curve is flat (very low volatility, deep in or out of the money), small price errors mean large volatility errors.',
        ],
      },
      {
        key: 'How implied volatility works',
        label: 'Summary',
        what: 'Three short notes on why implied volatility exists and what comes next.',
        read: ['Read once; it links this page to the volatility smile in the Volatility area.'],
      },
    ],
  },
  {
    id: 'vanilla-methods',
    path: '/vanilla/methods',
    title: 'Trees & grids',
    purpose:
      'Look inside two numerical methods: a binomial tree node by node, and a PDE grid as it steps back from expiry. American options show where early exercise happens.',
    workflow: [
      'Choose Put and American to see early exercise (the default).',
      'Step through tree sizes and schemes in the tree chart.',
      'Compare the PDE curves at different times, and read the exercise boundary.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Inputs',
        what: 'Contract, market and volatility. No numerics here: each chart has its own controls.',
        read: [
          'American puts are the interesting case: early exercise only pays for puts (or calls with dividends).',
        ],
      },
      {
        key: 'Binomial tree, node by node',
        label: 'Binomial tree',
        what: 'x: time step; y: spot. Each dot is a possible spot at that step, labelled with the option’s value there. Orange dots are where exercising beats holding.',
        read: [
          'Read right to left: values start from the payoff at the last step and are rolled back by discounted expected value.',
          'Orange nodes sit at low spots: for a put, exercise is optimal when the stock has fallen far enough.',
          'The tree’s first node (time 0) holds the price.',
        ],
        try: 'Switch between CRR and Leisen–Reimer at 5 steps: the node positions and the price change.',
      },
      {
        key: 'The PDE solution as time runs out',
        label: 'PDE solution',
        what: 'x: spot; y: option value. One curve per point in the option’s life, from today (lightest) to near expiry (darkest), plus the payoff (orange).',
        read: [
          'Curves sink onto the payoff as expiry approaches: time value disappears.',
          'For an American put the curves touch the payoff on the left, where exercising is optimal.',
        ],
      },
      {
        key: 'Early-exercise boundary',
        label: 'Exercise boundary',
        what: 'x: time from today; y: the critical spot. Below the line (shaded) an American put should be exercised.',
        read: [
          'The boundary rises towards the strike at expiry: near the end, less waiting is worth it.',
          'Raise the rate and the boundary moves up: receiving the strike earlier earns more interest.',
        ],
      },
    ],
  },
  {
    id: 'vanilla-strategies',
    path: '/vanilla/strategies',
    title: 'Option strategies',
    purpose:
      'Combine options (and shares) into one position and see its cost, its profit and loss across prices, and how it reacts to volatility and time.',
    workflow: [
      'Pick a preset (e.g. Long straddle) or build legs yourself.',
      'Read the cost, maximum profit and loss, and breakevens.',
      'Use the P&L chart for the shape, and the stress grid for volatility and time.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Strategy and legs',
        what: 'Presets at the top; each leg is Buy or Sell, Call or Put, with quantity, strike, expiry and exercise style; shares can be added at the bottom.',
        read: [
          'Buy = long (you pay the premium), Sell = short (you receive it).',
          'Legs can have different expiries (a calendar spread); the horizon is the first expiry.',
        ],
      },
      {
        key: 'hero',
        label: 'Cost, limits and Greeks',
        what: 'Net debit (paid to open) or credit (received), maximum profit and loss, breakevens and the whole position’s Greeks.',
        read: [
          'A long straddle has unlimited profit and a loss limited to its cost.',
          'Breakevens are the spot levels at the horizon where P&L is zero.',
          'Position delta near 0 means the position does not care which way the stock moves, only how far.',
        ],
      },
      {
        key: 'Profit and loss across spot',
        label: 'P&L across spot',
        what: 'x: spot; y: profit or loss. Blue at the horizon, orange if the spot moved right now; dots are breakevens.',
        read: [
          'Above zero you make money. The V shape of a straddle profits from big moves either way.',
          'The orange curve is smoother than the blue because the options still have time value.',
        ],
      },
      {
        key: 'Stress test: P&L by spot and volatility',
        label: 'Stress grid',
        what: 'A heatmap: columns are spot levels, rows volatility shifts, colour is P&L (blue profit, red loss, grey zero). The slider moves time forward.',
        read: [
          'Read along a row for spot risk and up a column for volatility risk.',
          'A long straddle turns bluer upwards: it is long volatility.',
          'Move Days from today forward: the red zone grows as time value decays.',
        ],
      },
      {
        key: 'Legs',
        label: 'Leg table',
        what: 'Each leg’s unit price, its value with quantity and side, and its Greeks.',
        read: ['The position Greeks are the sum of the rows.'],
      },
    ],
  },
  {
    id: 'vanilla-hedging',
    path: '/vanilla/hedging',
    title: 'Delta hedging',
    purpose:
      'Sell an option and hedge it by trading the stock. See how much risk remains when you can only re-balance occasionally, pay trading costs, or assume the wrong volatility.',
    workflow: [
      'Keep the defaults: a sold call, re-balanced 52 times.',
      'Read the hedging error, then the P&L distribution.',
      'Change re-balancing, costs and the volatility mismatch one at a time.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Inputs',
        what: 'The option sold, two volatilities (the one the market delivers and the one the hedger assumes), how often the hedge is adjusted and what trading costs.',
        read: [
          'Realised = what the stock actually does in the simulation; Assumed = what the hedger used to price and hedge.',
          'Trading cost is in basis points of each trade’s value.',
        ],
      },
      {
        key: 'hero',
        label: 'Hedging error',
        what: 'The standard deviation of the hedged P&L across simulated paths, with the theory (Derman–Kamal) value and what the P&L spread would be with no hedge at all.',
        read: [
          '0.925 against an unhedged 16.13: hedging removes about 94% of the risk.',
          'The mean hedged P&L is about zero when the two volatilities match; if the market is more volatile than assumed, it turns negative.',
        ],
      },
      {
        key: 'Distribution of hedged P&L',
        label: 'P&L distribution',
        what: 'Histogram of the hedged P&L per option over all simulated paths.',
        read: [
          'With continuous hedging every path would end at zero; the spread is the cost of hedging in steps.',
          'A shift of the centre away from zero is the volatility mismatch at work.',
        ],
      },
      {
        key: 'Hedge more often, err less, slowly',
        label: 'Error against frequency',
        what: 'x: re-balances over the option’s life (log scale); y: the P&L standard deviation (log scale). Simulation in blue, theory in orange.',
        read: [
          'A straight line with slope −½: four times the trades for half the error.',
          'Add trading costs and the line bends up at high frequencies: hedging more starts to cost more than it saves.',
        ],
      },
      {
        key: 'Three sample spot paths',
        label: 'Sample paths',
        what: 'Three simulated stock price paths.',
        read: [
          'Compare with the next chart: the path that crosses the strike most is usually the hardest to hedge.',
        ],
      },
      {
        key: 'Their hedged P&L, marked to market',
        label: 'P&L along the paths',
        what: 'The hedger’s running P&L along the same three paths: cash, shares and the option’s model value.',
        read: [
          'Small jumps at each re-balance accumulate into the final error.',
          'Big jumps happen when the stock moves sharply near the strike, where gamma is highest.',
        ],
      },
    ],
  },
]
