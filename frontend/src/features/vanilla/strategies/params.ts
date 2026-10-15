import type { OptionKind, StrategyRequest } from '@/lib/api'

export type Side = 'long' | 'short'

export interface Leg {
  id: number
  side: Side
  kind: OptionKind
  strike: number
  expiry: number
  /** Number of options, always positive; `side` carries the sign. */
  quantity: number
}

export interface StrategyParams {
  preset: string
  spot: number
  ratePct: number
  dividendPct: number
  volPct: number
  legs: Leg[]
  /** Signed units of the underlying (+1 = long one share). */
  underlying: number
}

let nextId = 1
export const newLegId = () => nextId++

function leg(side: Side, kind: OptionKind, strike: number, quantity = 1, expiry = 1): Leg {
  return { id: newLegId(), side, kind, strike, expiry, quantity }
}

interface Preset {
  name: string
  description: string
  build: (k: number, w: number) => { legs: Leg[]; underlying?: number }
}

/** Classic strategies around an at-the-money strike `k` with wing width `w`. */
export const PRESETS: Preset[] = [
  {
    name: 'Long call',
    description: 'Bullish, limited loss.',
    build: (k) => ({ legs: [leg('long', 'call', k)] }),
  },
  {
    name: 'Long put',
    description: 'Bearish, limited loss.',
    build: (k) => ({ legs: [leg('long', 'put', k)] }),
  },
  {
    name: 'Covered call',
    description: 'Own the stock, sell upside for income.',
    build: (k, w) => ({ legs: [leg('short', 'call', k + w)], underlying: 1 }),
  },
  {
    name: 'Protective put',
    description: 'Own the stock, insure the downside.',
    build: (k, w) => ({ legs: [leg('long', 'put', k - w)], underlying: 1 }),
  },
  {
    name: 'Bull call spread',
    description: 'Cheaper bullish bet, capped profit.',
    build: (k, w) => ({ legs: [leg('long', 'call', k), leg('short', 'call', k + w)] }),
  },
  {
    name: 'Bear put spread',
    description: 'Cheaper bearish bet, capped profit.',
    build: (k, w) => ({ legs: [leg('long', 'put', k), leg('short', 'put', k - w)] }),
  },
  {
    name: 'Long straddle',
    description: 'Profits from a big move either way.',
    build: (k) => ({ legs: [leg('long', 'call', k), leg('long', 'put', k)] }),
  },
  {
    name: 'Long strangle',
    description: 'Cheaper straddle, needs a bigger move.',
    build: (k, w) => ({ legs: [leg('long', 'put', k - w), leg('long', 'call', k + w)] }),
  },
  {
    name: 'Butterfly',
    description: 'Bets the price stays near the middle strike.',
    build: (k, w) => ({
      legs: [leg('long', 'call', k - w), leg('short', 'call', k, 2), leg('long', 'call', k + w)],
    }),
  },
  {
    name: 'Iron condor',
    description: 'Collects premium if the price stays in a range.',
    build: (k, w) => ({
      legs: [
        leg('long', 'put', k - 2 * w),
        leg('short', 'put', k - w),
        leg('short', 'call', k + w),
        leg('long', 'call', k + 2 * w),
      ],
    }),
  },
  {
    name: 'Calendar spread',
    description: 'Sells fast time decay, owns slow time decay.',
    build: (k) => ({ legs: [leg('short', 'call', k, 1, 0.25), leg('long', 'call', k, 1, 1)] }),
  },
]

export function applyPreset(params: StrategyParams, name: string): StrategyParams {
  const preset = PRESETS.find((p) => p.name === name)
  if (!preset) return params
  const k = Math.max(5, Math.round(params.spot / 5) * 5)
  const w = Math.max(5, Math.round((0.1 * k) / 5) * 5)
  const { legs, underlying = 0 } = preset.build(k, w)
  return { ...params, preset: name, legs, underlying }
}

export const DEFAULT_STRATEGY: StrategyParams = applyPreset(
  { preset: '', spot: 100, ratePct: 5, dividendPct: 0, volPct: 20, legs: [], underlying: 0 },
  'Long straddle',
)

export function toRequest(p: StrategyParams): StrategyRequest {
  return {
    spot: p.spot,
    rate: p.ratePct / 100,
    dividend_yield: p.dividendPct / 100,
    volatility: p.volPct / 100,
    underlying_quantity: p.underlying,
    legs: p.legs.map((l) => ({
      kind: l.kind,
      exercise: 'european',
      strike: l.strike,
      expiry: l.expiry,
      quantity: l.side === 'long' ? l.quantity : -l.quantity,
    })),
  }
}

export function describeLeg(l: Leg): string {
  const side = l.side === 'long' ? 'Long' : 'Short'
  const kind = l.kind === 'call' ? 'call' : 'put'
  return `${side} ${l.quantity} × ${l.strike} ${kind} · ${l.expiry.toFixed(2)}y`
}
