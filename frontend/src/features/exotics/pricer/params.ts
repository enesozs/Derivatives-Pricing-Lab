import type { ExoticRequest, OptionKind, ProductSpec } from '@/lib/api'
import { DEFAULT_MODEL, type ModelParams, toModelSpec } from '@/components/model-section'

export type ProductType = ProductSpec['type']
export type Monitoring = 'continuous' | 'daily' | 'weekly' | 'monthly'

export interface ExoticParams {
  product: ProductType
  kind: OptionKind
  strike: number
  expiry: number
  // Digital
  payout: 'cash' | 'asset'
  cash: number
  // Barrier
  barrier: number
  direction: 'up' | 'down'
  knock: 'in' | 'out'
  monitoring: Monitoring
  // Asian
  fixings: number
  averaging: 'arithmetic' | 'geometric'
  // Asian and lookback
  strikeType: 'fixed' | 'floating'
  // Market and model
  spot: number
  ratePct: number
  dividendPct: number
  model: ModelParams
  mcPaths: number
}

export const DEFAULT_EXOTIC: ExoticParams = {
  product: 'barrier',
  kind: 'call',
  strike: 100,
  expiry: 1,
  payout: 'cash',
  cash: 10,
  barrier: 85,
  direction: 'down',
  knock: 'out',
  monitoring: 'continuous',
  fixings: 12,
  averaging: 'arithmetic',
  strikeType: 'fixed',
  spot: 100,
  ratePct: 5,
  dividendPct: 2,
  model: DEFAULT_MODEL,
  mcPaths: 50_000,
}

export const PRODUCT_INTROS: Record<ProductType, string> = {
  digital:
    'All or nothing: pays a fixed amount (or the asset itself) if the option finishes in the money, however far.',
  barrier:
    'A vanilla option that is switched off (knock-out) or on (knock-in) if the price ever touches the barrier. Cheaper than the vanilla because it can die.',
  asian:
    'Pays on the average price over a set of fixing dates. Averaging tames volatility, so it is cheaper than a vanilla and hard to manipulate at expiry.',
  lookback:
    'Pays on the best price seen: floating strike buys at the low (call) or sells at the high (put). Perfect hindsight is expensive.',
}

export function observations(monitoring: Monitoring, expiry: number): number | null {
  const perYear = { continuous: 0, daily: 252, weekly: 52, monthly: 12 }[monitoring]
  return perYear ? Math.max(1, Math.round(perYear * expiry)) : null
}

export function toProductSpec(p: ExoticParams): ProductSpec {
  const obs = observations(p.monitoring, p.expiry)
  switch (p.product) {
    case 'digital':
      return {
        type: 'digital',
        kind: p.kind,
        strike: p.strike,
        expiry: p.expiry,
        payout: p.payout,
        cash: p.cash,
      }
    case 'barrier':
      return {
        type: 'barrier',
        kind: p.kind,
        strike: p.strike,
        expiry: p.expiry,
        barrier: p.barrier,
        direction: p.direction,
        knock: p.knock,
        observations: obs,
      }
    case 'asian':
      return {
        type: 'asian',
        kind: p.kind,
        strike: p.strike,
        expiry: p.expiry,
        fixings: p.fixings,
        averaging: p.averaging,
        strike_type: p.strikeType,
      }
    case 'lookback':
      return {
        type: 'lookback',
        kind: p.kind,
        expiry: p.expiry,
        strike_type: p.strikeType,
        strike: p.strike,
        observations: obs,
      }
  }
}

export function toRequest(p: ExoticParams): ExoticRequest {
  return {
    product: toProductSpec(p),
    spot: p.spot,
    rate: p.ratePct / 100,
    dividend_yield: p.dividendPct / 100,
    model: toModelSpec(p.model),
    mc_paths: p.mcPaths,
    seed: 42,
  }
}
