import type { ExerciseStyle, Greeks, OptionKind, PriceRequest, VanillaInputs } from '@/lib/api'

/** UI state, in display units (percent for rates and volatility). */
export interface VanillaParams {
  kind: OptionKind
  exercise: ExerciseStyle
  strike: number
  expiry: number
  spot: number
  ratePct: number
  dividendPct: number
  volPct: number
  treeSteps: number
  mcPaths: number
}

export const DEFAULT_PARAMS: VanillaParams = {
  kind: 'call',
  exercise: 'european',
  strike: 100,
  expiry: 1,
  spot: 100,
  ratePct: 5,
  dividendPct: 0,
  volPct: 20,
  treeSteps: 500,
  mcPaths: 100_000,
}

export function toInputs(p: VanillaParams): VanillaInputs {
  return {
    kind: p.kind,
    exercise: p.exercise,
    strike: p.strike,
    expiry: p.expiry,
    spot: p.spot,
    rate: p.ratePct / 100,
    dividend_yield: p.dividendPct / 100,
    volatility: p.volPct / 100,
  }
}

export function toPriceRequest(p: VanillaParams): PriceRequest {
  return { ...toInputs(p), tree_steps: p.treeSteps, mc_paths: p.mcPaths, seed: 42 }
}

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
