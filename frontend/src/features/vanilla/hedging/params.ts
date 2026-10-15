import type { HedgeRequest, OptionKind } from '@/lib/api'

export interface HedgeParams {
  kind: OptionKind
  position: 'short' | 'long'
  strike: number
  expiry: number
  spot: number
  ratePct: number
  dividendPct: number
  realisedVolPct: number
  hedgeVolPct: number
  rebalances: number
  costBps: number
  paths: number
}

export const DEFAULT_HEDGE: HedgeParams = {
  kind: 'call',
  position: 'short',
  strike: 100,
  expiry: 1,
  spot: 100,
  ratePct: 5,
  dividendPct: 0,
  realisedVolPct: 20,
  hedgeVolPct: 20,
  rebalances: 52,
  costBps: 0,
  paths: 2000,
}

export function toRequest(p: HedgeParams): HedgeRequest {
  return {
    kind: p.kind,
    strike: p.strike,
    expiry: p.expiry,
    spot: p.spot,
    rate: p.ratePct / 100,
    dividend_yield: p.dividendPct / 100,
    realised_volatility: p.realisedVolPct / 100,
    hedge_volatility: p.hedgeVolPct / 100,
    position: p.position,
    rebalances: p.rebalances,
    cost_bps: p.costBps,
    paths: p.paths,
    seed: 42,
  }
}
