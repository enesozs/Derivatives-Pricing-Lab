// Typed client for the FastAPI backend. Types mirror backend/src/derivlab_api/schemas.py;
// keep them in sync when the schemas change.

export type OptionKind = 'call' | 'put'
export type ExerciseStyle = 'european' | 'american'

/** Library units: decimals for rates/vol, years for expiry. */
export interface VanillaInputs {
  kind: OptionKind
  exercise: ExerciseStyle
  strike: number
  expiry: number
  spot: number
  rate: number
  dividend_yield: number
  volatility: number
}

export interface PriceRequest extends VanillaInputs {
  tree_steps: number
  /** PDE space steps; time steps are half of this. */
  pde_space_steps: number
  mc_paths: number
  seed: number
}

export interface Greeks {
  delta: number
  gamma: number
  vega: number
  theta: number
  rho: number
}

export type MethodId = 'analytic' | 'crr' | 'leisen_reimer' | 'pde' | 'monte_carlo'

export interface MethodResult {
  method: MethodId
  label: string
  status: 'ok' | 'unsupported' | 'error'
  value: number | null
  stderr: number | null
  ci_low: number | null
  ci_high: number | null
  abs_error: number | null
  runtime_ms: number | null
  greeks: Greeks | null
  note: string | null
}

export interface PriceResponse {
  reference: number
  reference_label: string
  greeks: Greeks | null
  greeks_label: string
  methods: MethodResult[]
}

export interface ProfileResponse {
  engine_label: string
  spots: number[]
  value: number[]
  payoff: number[]
  delta: (number | null)[]
  gamma: (number | null)[]
  vega: (number | null)[]
  theta: (number | null)[]
  rho: (number | null)[]
}

export interface ConvergencePoint {
  /** Tree steps, or PDE space steps. */
  steps: number
  value: number
  abs_error: number
}

export interface ConvergenceResponse {
  reference: number
  reference_label: string
  crr: ConvergencePoint[]
  leisen_reimer: ConvergencePoint[]
  pde: ConvergencePoint[]
  monte_carlo: { paths: number; value: number; stderr: number }[]
  monte_carlo_note: string | null
}

export type TreeScheme = 'crr' | 'jarrow-rudd' | 'leisen-reimer'

export interface TreeRequest extends VanillaInputs {
  steps: number
  scheme: TreeScheme
}

export interface TreeNode {
  level: number
  index: number
  spot: number
  value: number
  exercised: boolean
}

export interface TreeResponse {
  steps: number
  dt: number
  up: number
  down: number
  probability: number
  nodes: TreeNode[]
}

export interface PDEGridResponse {
  spots: number[]
  payoff: number[]
  slices: { time: number; values: number[] }[]
  boundary_times: number[]
  boundary_spots: (number | null)[]
}

export interface HedgeRequest {
  kind: OptionKind
  strike: number
  expiry: number
  spot: number
  rate: number
  dividend_yield: number
  realised_volatility: number
  hedge_volatility: number
  position: 'short' | 'long'
  rebalances: number
  cost_bps: number
  paths: number
  seed: number
}

export interface Distribution {
  mean: number
  std: number
  p05: number
  p95: number
}

export interface HedgeResponse {
  premium: number
  hedged: Distribution
  unhedged: Distribution
  approx_std: number
  mean_cost: number
  histogram: { edges: number[]; counts: number[] }
  sample_times: number[]
  sample_spots: number[][]
  sample_pnl: number[][]
  frequency: {
    rebalances: number
    mean: number
    std: number
    approx_std: number
    mean_cost: number
  }[]
}

export interface ImpliedVolRequest {
  kind: OptionKind
  exercise: ExerciseStyle
  strike: number
  expiry: number
  spot: number
  rate: number
  dividend_yield: number
  /** Observed option price per unit. */
  price: number
}

export interface ImpliedVolResponse {
  implied_vol: number | null
  iterations: number | null
  residual: number | null
  /** Why no implied volatility exists, when it does not. */
  message: string | null
  engine_label: string
  price_lower: number
  price_upper: number
  curve_vols: number[]
  curve_prices: number[]
}

export interface LegInput {
  kind: OptionKind
  exercise: ExerciseStyle
  strike: number
  expiry: number
  /** Positive = long (bought), negative = short (sold). */
  quantity: number
}

export interface StrategyRequest {
  spot: number
  rate: number
  dividend_yield: number
  volatility: number
  legs: LegInput[]
  underlying_quantity: number
}

export interface StrategyResponse {
  /** Cost to enter: positive = debit paid, negative = credit received. */
  net_value: number
  greeks: Greeks | null
  legs: { unit_value: number; position_value: number; greeks: Greeks | null }[]
  engine_label: string
  horizon: number
  spots: number[]
  pnl_today: number[]
  pnl_horizon: number[]
  breakevens: number[]
  /** null = unbounded. */
  max_profit: number | null
  max_loss: number | null
}

export interface ScenarioRequest extends StrategyRequest {
  /** Years from today at which to revalue. */
  elapsed: number
}

export interface ScenarioResponse {
  elapsed: number
  spots: number[]
  vol_shifts: number[]
  /** pnl[i][j]: P&L with volatility shifted by vol_shifts[i] at spots[j]. */
  pnl: number[][]
}

// --- Volatility -------------------------------------------------------------------------------

export type SourceKind = 'snapshot' | 'synthetic' | 'live'

export interface SourceRequest {
  source: SourceKind
  snapshot?: string | null
  ticker: string
  /** Risk-free rate for discounting; forwards come from put–call parity. */
  rate: number
}

export interface SourcesResponse {
  snapshots: { id: string; ticker: string; as_of: string; description: string }[]
  live_available: boolean
}

export interface SmilePoint {
  strike: number
  log_moneyness: number
  implied_vol: number
  kind: OptionKind
  price_source: 'mid' | 'last'
}

export interface SVIFitOut {
  a: number
  b: number
  rho: number
  m: number
  sigma: number
  rmse: number
  butterfly_violations: number
  k_min: number
  k_max: number
}

export interface SurfaceSlice {
  expiry: string
  t: number
  forward: number
  discount: number
  forward_method: 'parity' | 'fallback'
  atm_vol: number
  dropped: Record<string, number>
  points: SmilePoint[]
  svi: SVIFitOut
  fit_k: number[]
  fit_vol: number[]
}

export interface SurfaceResponse {
  meta: {
    ticker: string
    spot: number
    as_of: string
    source: SourceKind
    description: string
    synthetic: boolean
    price_basis: 'mid' | 'last' | 'mixed'
  }
  slices: SurfaceSlice[]
  calendar_violations: { t_short: number; t_long: number; count: number }[]
  grid: {
    log_moneyness: number[]
    maturities: number[]
    implied_vol: number[][]
    local_vol: number[][]
    local_vol_fallbacks: number
  }
}

export type CalibrationModel = 'heston' | 'sabr'

export interface CalibrationRequest extends SourceRequest {
  model: CalibrationModel
  beta: number
}

export interface CalibrationResponse {
  model: CalibrationModel
  parameters: Record<string, number>[]
  rmse: number
  runtime_ms: number
  feller_satisfied: boolean | null
  slices: {
    expiry: string
    t: number
    forward: number
    strikes: number[]
    log_moneyness: number[]
    market_vol: number[]
    model_vol: (number | null)[]
    rmse: number
  }[]
}

export type ModelParams =
  | { model: 'black_scholes'; volatility: number }
  | { model: 'heston'; v0: number; kappa: number; theta: number; xi: number; rho: number }
  | {
      model: 'merton'
      volatility: number
      intensity: number
      jump_mean: number
      jump_volatility: number
    }
  | { model: 'sabr'; alpha: number; beta: number; rho: number; nu: number }

export interface ModelSmileRequest {
  params: ModelParams
  spot: number
  rate: number
  dividend_yield: number
  expiries: number[]
}

export interface ModelSmileResponse {
  model: string
  density_spots: number[]
  smiles: {
    t: number
    strikes: number[]
    implied_vol: (number | null)[]
    density: number[] | null
  }[]
  reference_density: number[]
}

// --- Exotics ---------------------------------------------------------------------------------

export type ProductSpec =
  | {
      type: 'digital'
      kind: OptionKind
      strike: number
      expiry: number
      payout: 'cash' | 'asset'
      cash: number
    }
  | {
      type: 'barrier'
      kind: OptionKind
      strike: number
      expiry: number
      barrier: number
      direction: 'up' | 'down'
      knock: 'in' | 'out'
      /** null = continuous monitoring. */
      observations: number | null
    }
  | {
      type: 'asian'
      kind: OptionKind
      strike: number
      expiry: number
      fixings: number
      averaging: 'arithmetic' | 'geometric'
      strike_type: 'fixed' | 'floating'
    }
  | {
      type: 'lookback'
      kind: OptionKind
      expiry: number
      strike_type: 'fixed' | 'floating'
      strike: number
      observations: number | null
    }

export type ExoticModelSpec =
  | { type: 'black_scholes'; volatility: number }
  | { type: 'heston'; v0: number; kappa: number; theta: number; xi: number; rho: number }

export interface ExoticRequest {
  product: ProductSpec
  spot: number
  rate: number
  dividend_yield: number
  model: ExoticModelSpec
  mc_paths: number
  seed: number
}

export interface ExoticMethod {
  method: 'analytic' | 'monte_carlo' | 'pde'
  label: string
  status: 'ok' | 'unsupported' | 'error'
  value: number | null
  stderr: number | null
  ci_low: number | null
  ci_high: number | null
  runtime_ms: number | null
  note: string | null
}

export interface ExoticPriceResponse {
  value: number
  value_label: string
  vanilla_value: number | null
  greeks: Greeks | null
  greeks_label: string | null
  methods: ExoticMethod[]
}

export interface ExoticProfileResponse {
  engine_label: string
  spots: number[]
  value: number[]
  delta: number[]
  vanilla_value: number[] | null
  vanilla_delta: number[] | null
}

export interface ExoticPathsResponse {
  times: number[]
  paths: number[][]
  payoffs: number[]
  hit: boolean[] | null
  fixing_times: number[] | null
  averages: number[] | null
  extremes: number[][] | null
}

export interface AmericanMCRequest {
  kind: OptionKind
  strike: number
  expiry: number
  spot: number
  rate: number
  dividend_yield: number
  model: ExoticModelSpec
  paths: number
  exercise_dates: number
  degree: number
}

export interface AmericanMCResponse {
  lsm_value: number
  lsm_stderr: number
  reference_value: number | null
  reference_label: string | null
  european_value: number
  exercise_times: number[]
  lsm_boundary: (number | null)[]
  reference_times: number[]
  reference_boundary: (number | null)[]
  exercise_points: number[][]
  convergence: { paths: number; value: number; stderr: number }[]
  runtime_ms: number
}

export class ApiError extends Error {}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ApiError('Cannot reach the pricing API. Is the backend running?')
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    const message =
      typeof detail?.detail === 'string' ? detail.detail : `Request failed (${response.status})`
    throw new ApiError(message)
  }
  return (await response.json()) as T
}

export const api = {
  price: (req: PriceRequest, signal?: AbortSignal) =>
    post<PriceResponse>('/vanilla/price', req, signal),
  profile: (req: VanillaInputs, signal?: AbortSignal) =>
    post<ProfileResponse>('/vanilla/profile', req, signal),
  convergence: (req: VanillaInputs, signal?: AbortSignal) =>
    post<ConvergenceResponse>('/vanilla/convergence', req, signal),
  impliedVol: (req: ImpliedVolRequest, signal?: AbortSignal) =>
    post<ImpliedVolResponse>('/vanilla/implied-vol', req, signal),
  strategy: (req: StrategyRequest, signal?: AbortSignal) =>
    post<StrategyResponse>('/strategies/analyze', req, signal),
  scenarios: (req: ScenarioRequest, signal?: AbortSignal) =>
    post<ScenarioResponse>('/strategies/scenarios', req, signal),
  tree: (req: TreeRequest, signal?: AbortSignal) =>
    post<TreeResponse>('/vanilla/tree', req, signal),
  pdeGrid: (req: VanillaInputs, signal?: AbortSignal) =>
    post<PDEGridResponse>('/vanilla/pde-grid', req, signal),
  deltaHedge: (req: HedgeRequest, signal?: AbortSignal) =>
    post<HedgeResponse>('/hedging/delta', req, signal),
  volSources: async (signal?: AbortSignal): Promise<SourcesResponse> => {
    const response = await fetch('/api/volatility/sources', { signal })
    if (!response.ok) throw new ApiError(`Request failed (${response.status})`)
    return (await response.json()) as SourcesResponse
  },
  volSurface: (req: SourceRequest, signal?: AbortSignal) =>
    post<SurfaceResponse>('/volatility/surface', req, signal),
  calibrate: (req: CalibrationRequest, signal?: AbortSignal) =>
    post<CalibrationResponse>('/volatility/calibrate', req, signal),
  modelSmile: (req: ModelSmileRequest, signal?: AbortSignal) =>
    post<ModelSmileResponse>('/volatility/model-smile', req, signal),
  exoticPrice: (req: ExoticRequest, signal?: AbortSignal) =>
    post<ExoticPriceResponse>('/exotics/price', req, signal),
  exoticProfile: (req: ExoticRequest, signal?: AbortSignal) =>
    post<ExoticProfileResponse>('/exotics/profile', req, signal),
  exoticPaths: (req: ExoticRequest, signal?: AbortSignal) =>
    post<ExoticPathsResponse>('/exotics/paths', req, signal),
  americanMC: (req: AmericanMCRequest, signal?: AbortSignal) =>
    post<AmericanMCResponse>('/exotics/american', req, signal),
}
