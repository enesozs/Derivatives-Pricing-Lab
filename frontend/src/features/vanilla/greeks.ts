import type { Greeks } from '@/lib/api'

/** Display metadata for the Greeks; the only place library units are converted for the UI. */
export interface GreekMeta {
  key: keyof Greeks
  label: string
  symbol: string
  /** Library units are per 1.0 change; the UI shows market-convention units. */
  scale: number
  unit: string
  description: string
}

export const GREEKS: GreekMeta[] = [
  {
    key: 'delta',
    label: 'Delta',
    symbol: 'Δ',
    scale: 1,
    unit: 'per $1 in spot',
    description: 'Change in option value for a $1 move in the underlying. Also the hedge ratio.',
  },
  {
    key: 'gamma',
    label: 'Gamma',
    symbol: 'Γ',
    scale: 1,
    unit: 'Δ per $1 in spot',
    description: 'How fast delta changes as spot moves. Largest at the money, near expiry.',
  },
  {
    key: 'vega',
    label: 'Vega',
    symbol: 'ν',
    scale: 1 / 100,
    unit: 'per 1 vol point',
    description: 'Change in value when volatility rises by one percentage point (20% → 21%).',
  },
  {
    key: 'theta',
    label: 'Theta',
    symbol: 'Θ',
    scale: 1 / 365,
    unit: 'per calendar day',
    description: 'Change in value as one day passes with nothing else moving. Usually negative.',
  },
  {
    key: 'rho',
    label: 'Rho',
    symbol: 'ρ',
    scale: 1 / 100,
    unit: 'per 1% in rates',
    description: 'Change in value when the risk-free rate rises by one percentage point.',
  },
]
