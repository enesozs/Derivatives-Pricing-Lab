import type { PageGuide } from './types'

export const EXOTICS: PageGuide[] = [
  {
    id: 'exotics-pricer',
    path: '/exotics',
    title: 'Exotic options',
    purpose:
      'Price options whose payoff depends on the path (digitals, barriers, Asians, lookbacks), compare each with the plain vanilla, and see the payoff rule act on simulated paths.',
    workflow: [
      'Choose the product and its features (barrier level, averaging…).',
      'Compare its value with the equivalent vanilla.',
      'Switch the model to Heston to see model risk, and check which methods agree.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Product, model, market',
        what: 'The product type and its options, the model (Black–Scholes or Heston at the same volatility level), market inputs and Monte Carlo paths.',
        read: [
          'Barrier options: Down/Up is where the barrier sits, Out/In whether touching it kills or activates the option.',
          'Monitoring: Continuous checks the barrier at every instant; Daily/Weekly/Monthly only on those dates (cheaper to touch less often).',
        ],
      },
      {
        key: 'hero',
        label: 'Value and Greeks',
        what: 'The exotic’s value, the equivalent vanilla’s value and the ratio between them, and Greeks (closed form or bump-and-revalue).',
        read: [
          'Exotic / vanilla 89%: the knock-out feature removes 11% of the value.',
          'The Greeks label says how they were computed; Monte Carlo Greeks are noisier.',
        ],
      },
      {
        key: 'Value across spot',
        label: 'Value across spot',
        what: 'x: spot today; y: value of the exotic (blue) and the vanilla (orange). Vertical lines mark the barrier and the strike. The Delta tab shows the hedge ratio instead.',
        read: [
          'A down-and-out call is worth zero at and below the barrier and tracks the vanilla far above it.',
          'Delta can jump near a barrier: that is why barrier options are hard to hedge.',
        ],
      },
      {
        key: 'How the payoff works, path by path',
        label: 'Simulated paths',
        what: 'Simulated price paths under the chosen model, coloured by what the payoff rule did: blue never touched the barrier, grey touched it. Lines mark strike and barrier.',
        read: [
          'For a knock-out, grey paths pay nothing however they end.',
          'For Asians the paths show the averaging; for lookbacks the running extreme.',
        ],
      },
      {
        key: 'Which methods can price it',
        label: 'Method table',
        what: 'Each pricing method’s value, 95% interval (Monte Carlo), run time and status.',
        read: [
          '“Not available” means no method of that kind exists for this product and model, not an error.',
          'Under Heston only Monte Carlo can price exotics.',
        ],
      },
    ],
  },
  {
    id: 'exotics-american',
    path: '/exotics/american',
    title: 'American options by simulation',
    purpose:
      'Price an American option with Monte Carlo using Longstaff–Schwartz regression, and compare it with the exact tree and the exercise boundary.',
    workflow: [
      'Keep the American put; read its value against the tree reference.',
      'Look at where the simulation exercises.',
      'Increase paths and exercise dates and watch the estimate converge.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Inputs',
        what: 'Contract, model and market, plus the simulation settings: paths, exercise dates and the regression’s polynomial degree.',
        read: [
          'Exercise dates turn the American into a Bermudan; 50 dates a year is close to continuous.',
        ],
      },
      {
        key: 'hero',
        label: 'Value and premium',
        what: 'The Longstaff–Schwartz value with its 95% interval, the tree reference, the European value and the early-exercise premium.',
        read: [
          'Premium = American − European: what the right to exercise early is worth.',
          'A small gap below the tree is expected: fewer exercise dates and an imperfect regression.',
        ],
      },
      {
        key: 'Where the simulation chooses to exercise',
        label: 'Exercise decisions',
        what: 'x: time; y: spot. Grey dots are paths exercised at that date; blue is the boundary the regression implies, orange the exact PDE boundary.',
        read: [
          'The dots should sit below the boundary; the blue line should track the orange one.',
        ],
      },
      {
        key: 'Convergence in paths',
        label: 'Convergence',
        what: 'x: paths; y: the estimate with its 95% interval, and the tree value.',
        read: ['The interval narrows with more paths; a small bias to the tree remains.'],
      },
    ],
  },
]
