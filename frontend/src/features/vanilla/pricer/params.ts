import type { ExerciseStyle, OptionKind, PriceRequest, VanillaInputs } from '@/lib/api'

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
  pdeSpaceSteps: number
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
  pdeSpaceSteps: 400,
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
  return {
    ...toInputs(p),
    tree_steps: p.treeSteps,
    pde_space_steps: p.pdeSpaceSteps,
    mc_paths: p.mcPaths,
    seed: 42,
  }
}
