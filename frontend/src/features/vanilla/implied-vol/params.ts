import type { ExerciseStyle, ImpliedVolRequest, OptionKind } from '@/lib/api'

export interface ImpliedVolParams {
  kind: OptionKind
  exercise: ExerciseStyle
  strike: number
  expiry: number
  spot: number
  ratePct: number
  dividendPct: number
  price: number
}

export const DEFAULT_IV_PARAMS: ImpliedVolParams = {
  kind: 'call',
  exercise: 'european',
  strike: 100,
  expiry: 1,
  spot: 100,
  ratePct: 5,
  dividendPct: 0,
  price: 12.5,
}

export function toRequest(p: ImpliedVolParams): ImpliedVolRequest {
  return {
    kind: p.kind,
    exercise: p.exercise,
    strike: p.strike,
    expiry: p.expiry,
    spot: p.spot,
    rate: p.ratePct / 100,
    dividend_yield: p.dividendPct / 100,
    price: p.price,
  }
}
