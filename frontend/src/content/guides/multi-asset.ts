import type { PageGuide } from './types'

export const MULTI_ASSET: PageGuide[] = [
  {
    id: 'multi-asset-correlation',
    path: '/multi-asset',
    title: 'Correlation lab',
    purpose:
      'Price options on two to five assets and see how the correlation between them moves the price, the main risk of every multi-asset product.',
    workflow: [
      'Choose a product (basket, exchange, spread, best-of, worst-of).',
      'Set each asset and the correlation.',
      'Read the correlation sensitivity, the price-vs-correlation curve, and the scenario cloud.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Product and assets',
        what: 'The product, the number of assets with each one’s spot, volatility and dividend, and one correlation shared by every pair.',
        read: [
          'With three or more assets the correlation cannot go below −1/(n−1): they cannot all move against each other.',
          'Closed forms exist for two assets; beyond that the page uses Monte Carlo.',
        ],
      },
      {
        key: 'hero',
        label: 'Value and methods',
        what: 'The option value, its sensitivity to correlation (value change per +0.10), and a closed form next to Monte Carlo.',
        read: [
          'A positive sensitivity means the holder gains when correlation rises (baskets, worst-ofs).',
          'When the closed form is an approximation, the Monte Carlo row shows how close it is.',
        ],
      },
      {
        key: 'Price against correlation',
        label: 'Price against correlation',
        what: 'x: correlation; y: value, with the current correlation marked.',
        read: [
          'Rising: the product likes assets moving together (basket, worst-of).',
          'Falling: it likes them diverging (exchange, spread, best-of).',
        ],
      },
      {
        key: 'Joint scenarios at expiry',
        label: 'Scenario cloud',
        what: 'Each dot is one simulated outcome for assets 1 and 2 (log-returns); blue dots are scenarios where the option pays.',
        read: [
          'Round cloud: independent. Tilted ellipse: correlated. A line: perfectly correlated.',
          'The blue region shows the payoff’s shape: for a best-of, a corner where either asset is high.',
        ],
      },
    ],
  },
  {
    id: 'multi-asset-quanto',
    path: '/multi-asset/quanto',
    title: 'Quanto options',
    purpose:
      'Price an option on a foreign stock paid in your own currency at a fixed exchange rate, and see why the stock–currency correlation changes its price.',
    workflow: [
      'Set the option and the foreign stock.',
      'Set both interest rates, the FX volatility and the asset–FX correlation.',
      'Compare with the zero-correlation value and the Monte Carlo check.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Contract, asset, currencies',
        what: 'The option, the foreign stock (in its own currency), and the two currencies: rates, FX volatility and the asset–FX correlation.',
        read: ['The FX rate is domestic currency per unit of foreign currency.'],
      },
      {
        key: 'hero',
        label: 'Value and adjustment',
        what: 'The quanto value, the drift adjustment −ρ σ_S σ_FX, the value without correlation, and a Monte Carlo check that simulates stock and FX together.',
        read: [
          'A −1.20%/yr adjustment makes the stock grow more slowly under the pricing measure, so a call is cheaper.',
        ],
      },
      {
        key: 'Price against correlation',
        label: 'Price against correlation',
        what: 'x: asset–FX correlation; y: quanto value, with the current correlation marked.',
        read: [
          'A straight-ish falling line for a call: the more the stock and its currency rise together, the less a fixed rate is worth to the holder.',
        ],
      },
    ],
  },
]
