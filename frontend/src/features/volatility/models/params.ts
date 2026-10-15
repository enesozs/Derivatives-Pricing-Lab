import type { ModelParams } from '@/lib/api'

export type ModelId = ModelParams['model']

export interface ParamSpec {
  key: string
  label: string
  min: number
  max: number
  step: number
  digits: number
  hint: string
}

export const MODEL_LABELS: Record<ModelId, string> = {
  black_scholes: 'Black–Scholes',
  heston: 'Heston',
  merton: 'Merton jumps',
  sabr: 'SABR',
}

export const MODEL_INTROS: Record<ModelId, string> = {
  black_scholes:
    'One constant volatility: every strike and expiry has the same implied vol. The flat line real markets never show.',
  heston:
    'Variance is itself random and mean-reverting, and moves opposite to the price. That creates skew, and the term structure follows the variance’s pull towards its long-run level.',
  merton:
    'Black–Scholes plus sudden jumps. Jumps fatten the tails, which steepens short-dated smiles most: a few days can contain a crash.',
  sabr: 'A per-expiry smile formula (Hagan) favoured on trading desks: level, skew and curvature each have their own knob.',
}

export const PARAM_SPECS: Record<ModelId, ParamSpec[]> = {
  black_scholes: [
    {
      key: 'volatility',
      label: 'Volatility σ',
      min: 0.05,
      max: 1,
      step: 0.01,
      digits: 2,
      hint: 'The single, constant volatility.',
    },
  ],
  heston: [
    {
      key: 'v0',
      label: 'Initial variance v₀',
      min: 0.005,
      max: 0.25,
      step: 0.005,
      digits: 3,
      hint: 'Today’s variance; √v₀ ≈ short-dated ATM vol.',
    },
    {
      key: 'theta',
      label: 'Long-run variance θ',
      min: 0.005,
      max: 0.25,
      step: 0.005,
      digits: 3,
      hint: 'Where variance reverts to; √θ ≈ long-dated ATM vol.',
    },
    {
      key: 'kappa',
      label: 'Mean reversion κ',
      min: 0.1,
      max: 10,
      step: 0.1,
      digits: 1,
      hint: 'Speed of the pull towards θ; shapes the term structure.',
    },
    {
      key: 'xi',
      label: 'Vol of variance ξ',
      min: 0.05,
      max: 2,
      step: 0.05,
      digits: 2,
      hint: 'How random variance is; more ξ = more smile curvature.',
    },
    {
      key: 'rho',
      label: 'Correlation ρ',
      min: -0.95,
      max: 0.95,
      step: 0.05,
      digits: 2,
      hint: 'Price–variance correlation; negative ρ tilts the smile into a skew.',
    },
  ],
  merton: [
    {
      key: 'volatility',
      label: 'Diffusion vol σ',
      min: 0.05,
      max: 0.6,
      step: 0.01,
      digits: 2,
      hint: 'The continuous part of the randomness.',
    },
    {
      key: 'intensity',
      label: 'Jumps per year λ',
      min: 0,
      max: 5,
      step: 0.1,
      digits: 1,
      hint: 'Expected number of jumps in a year.',
    },
    {
      key: 'jump_mean',
      label: 'Mean jump μⱼ',
      min: -0.4,
      max: 0.2,
      step: 0.01,
      digits: 2,
      hint: 'Average log jump size; negative = crashes.',
    },
    {
      key: 'jump_volatility',
      label: 'Jump size spread σⱼ',
      min: 0.01,
      max: 0.5,
      step: 0.01,
      digits: 2,
      hint: 'Dispersion of jump sizes.',
    },
  ],
  sabr: [
    {
      key: 'alpha',
      label: 'Level α',
      min: 0.05,
      max: 1,
      step: 0.01,
      digits: 2,
      hint: 'Overall volatility level (with β = 1, ≈ ATM vol).',
    },
    {
      key: 'beta',
      label: 'Backbone β',
      min: 0,
      max: 1,
      step: 0.05,
      digits: 2,
      hint: '1 = lognormal, 0 = normal: how the smile moves with the forward.',
    },
    {
      key: 'rho',
      label: 'Skew ρ',
      min: -0.95,
      max: 0.95,
      step: 0.05,
      digits: 2,
      hint: 'Correlation between forward and vol: tilts the smile.',
    },
    {
      key: 'nu',
      label: 'Vol of vol ν',
      min: 0,
      max: 2,
      step: 0.05,
      digits: 2,
      hint: 'Curvature of the smile.',
    },
  ],
}

export const DEFAULT_MODEL_PARAMS: Record<ModelId, ModelParams> = {
  black_scholes: { model: 'black_scholes', volatility: 0.2 },
  heston: { model: 'heston', v0: 0.03, kappa: 2, theta: 0.045, xi: 0.6, rho: -0.7 },
  merton: {
    model: 'merton',
    volatility: 0.15,
    intensity: 0.5,
    jump_mean: -0.12,
    jump_volatility: 0.12,
  },
  sabr: { model: 'sabr', alpha: 0.2, beta: 1, rho: -0.5, nu: 0.6 },
}

export const EXPIRIES = [0.08, 0.25, 0.5, 1, 2]
