import type { PageGuide } from './types'

export const CREDIT: PageGuide[] = [
  {
    id: 'credit-cds',
    path: '/credit',
    title: 'Credit default swaps',
    purpose:
      'Turn CDS spreads into default probabilities, and price a standard CDS contract: par spread, upfront payment and spread sensitivity.',
    workflow: [
      'Read the 5Y par spread and the chance of default within 5 years.',
      'Edit spreads or press “Distress ×3”, and watch survival and hazard rates.',
      'Switch the coupon between 100bp and 500bp to see the upfront change.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Spreads and assumptions',
        what: 'Par CDS spreads by maturity (in basis points a year), the recovery rate, the interest rate, and the contract (maturity and standard coupon).',
        read: ['A 115bp spread: the buyer pays 1.15% of the notional a year for protection.'],
      },
      {
        key: 'hero',
        label: 'Contract',
        what: 'The par spread for the contract, the default probability to its maturity, the upfront at the standard coupon, the risky annuity (RPV01), the protection leg and the CS01.',
        read: [
          'Upfront 0.67%: trading a 115bp name at a 100bp coupon, the buyer pays 0.67% of notional at the start to make up the difference.',
          'CS01 4,423: the buyer of 10M of protection gains 4,423 if every spread widens by 1bp.',
        ],
      },
      {
        key: 'Survival probability',
        label: 'Survival curve',
        what: 'x: years; y: probability the company has not defaulted yet (%). The dashed line is the contract maturity.',
        read: ['90.7% at 5 years: a 9.3% chance of default within 5 years (risk-neutral).'],
      },
      {
        key: 'Hazard rate',
        label: 'Hazard rate',
        what: 'x: years; y: the default rate in each period, given survival so far (% a year).',
        read: ['Flat between quote maturities, stepping up with an upward-sloping spread curve.'],
      },
      {
        key: 'Bootstrapped default curve',
        label: 'Node table',
        what: 'For each quote: the spread, the hazard rate of its segment, the credit-triangle estimate, survival and repricing error.',
        read: [
          'Credit triangle: spread ÷ (1 − recovery) ≈ average hazard rate. 115bp ÷ 0.6 ≈ 1.9% a year.',
        ],
      },
    ],
  },
  {
    id: 'credit-xva',
    path: '/credit/xva',
    title: 'Counterparty risk (xVA)',
    purpose:
      'Measure how much a client could owe on a swap over time (exposure), and price the risk that they default while owing it (CVA), and our own default (DVA).',
    workflow: [
      'Read CVA in currency and as a running spread.',
      'Look at the exposure profile and the scenario paths.',
      'Change the counterparty spread, rate volatility and collateral.',
    ],
    regions: [
      {
        key: 'panel',
        label: 'Trade, model, credit, collateral',
        what: 'The swap (side, maturity; at the money, 10M), the Hull–White rate model, both parties’ CDS spreads and recoveries, and an optional collateral threshold.',
        read: [
          'The collateral threshold is the exposure the counterparty may run up before posting collateral.',
        ],
      },
      {
        key: 'hero',
        label: 'CVA and DVA',
        what: 'CVA in currency and as basis points a year on the fixed rate, DVA, the net adjustment, the risk-free value, and the simulation check.',
        read: [
          'CVA 32,066 on a 10M swap ≈ 3.8bp a year: what a bank adds to the rate to charge for the risk.',
          'Net adjustment = −CVA + DVA, added to the swap’s risk-free value.',
        ],
      },
      {
        key: 'Exposure profile',
        label: 'Exposure profile',
        what: 'x: years; y: what the counterparty could owe. Blue: expected exposure; orange: 95% potential future exposure (a bad case).',
        read: [
          'The hump: zero today, growing as rates move, shrinking as payments are made.',
          'The sawtooth drops are payment dates.',
        ],
      },
      {
        key: 'The swap’s value in a few scenarios',
        label: 'Scenario paths',
        what: 'The swap’s value along eight simulated rate paths.',
        read: [
          'Above zero the counterparty owes us (exposure); below zero we owe them (what DVA is about).',
        ],
      },
      {
        key: 'Where the adjustment comes from',
        label: 'CVA by year',
        what: 'Per year of default: CVA (blue, above zero) and DVA (orange, below zero).',
        read: [
          'Middle years contribute most: exposure is highest there and default has had time to happen.',
        ],
      },
    ],
  },
]
